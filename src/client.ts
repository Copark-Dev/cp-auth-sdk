// Thin client around cp-auth's REST API. Lives on the product domain
// (your-product.example.com, another-product.example.com, ...) and calls auth.cp-platform.com
// directly. Cross-origin cookies don't reach us, so tokens are returned
// in the response body and stashed via the storage layer.

import type {
  CpAuthConfig,
  OAuthProvider,
  SignupResult,
  TokenResponse,
  CpAuthUser,
} from "./types.js";
import { createStorage, type TokenStorage } from "./storage.js";
import { detectInAppBrowser, buildChromeIntentUrl } from "./in-app-browser.js";

const REFRESH_SKEW_MS = 60_000; // refresh 1 min before expiry

class CpAuthApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`[cp-auth ${status}] ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

export class CpAuthClient {
  private readonly authUrl: string;
  private readonly productOrigin: string;
  private readonly storage: TokenStorage;
  private refreshInflight: Promise<TokenResponse | null> | null = null;

  constructor(config: CpAuthConfig) {
    this.authUrl = config.authUrl.replace(/\/$/, "");
    this.productOrigin =
      config.productOrigin ??
      (typeof window !== "undefined" ? window.location.origin : "");
    this.storage = createStorage(config.storage ?? "localStorage");
  }

  // ─── Token lifecycle ───────────────────────────────────────────────

  getAccessToken(): string | null {
    return this.storage.getAccess();
  }

  isLoggedIn(): boolean {
    const t = this.storage.getAccess();
    const exp = this.storage.getExpiresAt();
    if (!t || !exp) return false;
    return Date.now() < exp;
  }

  /** Returns a valid access token, refreshing if it expires soon. */
  async ensureAccessToken(): Promise<string | null> {
    const t = this.storage.getAccess();
    const exp = this.storage.getExpiresAt();
    if (!t) return null;
    if (exp && Date.now() < exp - REFRESH_SKEW_MS) return t;
    const refreshed = await this.refresh();
    return refreshed?.access_token ?? null;
  }

  private async refresh(): Promise<TokenResponse | null> {
    // Coalesce concurrent refresh attempts to avoid burning the refresh token.
    if (this.refreshInflight) return this.refreshInflight;
    const rt = this.storage.getRefresh();
    if (!rt) return null;
    this.refreshInflight = (async () => {
      try {
        const tr = await this.post<TokenResponse>("/auth/refresh", {
          refresh_token: rt,
        });
        this.storage.set(tr.access_token, tr.refresh_token, tr.expires_in);
        return tr;
      } catch {
        this.storage.clear();
        return null;
      } finally {
        this.refreshInflight = null;
      }
    })();
    return this.refreshInflight;
  }

  // ─── Auth flows ────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<TokenResponse> {
    const tr = await this.post<TokenResponse>("/auth/login", {
      email,
      password,
    });
    this.storage.set(tr.access_token, tr.refresh_token, tr.expires_in);
    return tr;
  }

  async signup(args: {
    email: string;
    password: string;
    phone: string;
    phone_consent: boolean;
    nickname?: string;
  }): Promise<SignupResult> {
    const raw = await this.post<{
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      message?: string;
    }>("/auth/signup", args);

    if (raw.access_token) {
      this.storage.set(
        raw.access_token,
        raw.refresh_token,
        raw.expires_in ?? 3600,
      );
      return {
        status: "authenticated",
        access_token: raw.access_token,
        refresh_token: raw.refresh_token,
        token_type: "bearer",
        expires_in: raw.expires_in ?? 3600,
      };
    }
    return {
      status: "verification_required",
      email: args.email,
      message: raw.message,
    };
  }

  async logout(): Promise<void> {
    try {
      const t = this.storage.getAccess();
      if (t) {
        await fetch(`${this.authUrl}/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${t}` },
        });
      }
    } finally {
      this.storage.clear();
    }
  }

  async getMe(): Promise<CpAuthUser> {
    const t = await this.ensureAccessToken();
    if (!t) throw new CpAuthApiError(401, "Not authenticated");
    const r = await fetch(`${this.authUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!r.ok) throw await this.toError(r);
    return r.json() as Promise<CpAuthUser>;
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.post("/auth/password/reset", { email });
  }

  async confirmPasswordReset(
    token: string,
    newPassword: string,
  ): Promise<void> {
    await this.post("/auth/password/reset/confirm", {
      token,
      new_password: newPassword,
    });
  }

  async verifyEmail(
    token: string,
    type: string = "signup",
  ): Promise<TokenResponse> {
    const tr = await this.post<TokenResponse>("/auth/email-verify", {
      token,
      type,
    });
    this.storage.set(tr.access_token, tr.refresh_token, tr.expires_in);
    return tr;
  }

  // ─── OAuth ─────────────────────────────────────────────────────────

  /**
   * Kick off an OAuth login. Detects in-app browsers and short-circuits
   * with `{ blocked: true, info }` for Google/Apple — caller should show
   * a "open in Safari/Chrome" UI in that case instead of redirecting.
   * Kakao still works inside in-app webviews so it's never blocked.
   */
  async startOAuth(
    provider: OAuthProvider,
    redirectPath: string = "/auth/callback",
  ): Promise<
    | { blocked: true; info: ReturnType<typeof detectInAppBrowser> }
    | { blocked: false; url: string }
  > {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const info = detectInAppBrowser(ua);
    if (info.isInApp && (provider === "google" || provider === "apple")) {
      return { blocked: true, info };
    }
    const callbackUrl = `${this.productOrigin}${redirectPath}`;
    const r = await fetch(
      `${this.authUrl}/auth/oauth/url?provider=${provider}&redirect_url=${encodeURIComponent(callbackUrl)}`,
      { method: "POST" },
    );
    if (!r.ok) throw await this.toError(r);
    const data = (await r.json()) as { url: string };
    return { blocked: false, url: data.url };
  }

  /** Convenience for forcing an Android-in-app caller out to Chrome. */
  buildChromeIntent(href?: string): string {
    const resolved =
      href ?? (typeof window !== "undefined" ? window.location.href : "");
    if (!resolved) {
      throw new Error(
        "buildChromeIntent: no href available — pass one explicitly when running outside a browser (React Native, Node, etc.)",
      );
    }
    return buildChromeIntentUrl(resolved);
  }

  // ─── Internals ─────────────────────────────────────────────────────

  private async post<T>(path: string, body: unknown): Promise<T> {
    const r = await fetch(`${this.authUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw await this.toError(r);
    return (await r.json()) as T;
  }

  private async toError(r: Response): Promise<CpAuthApiError> {
    let detail = r.statusText;
    try {
      const j = (await r.json()) as { detail?: string };
      if (typeof j.detail === "string") detail = j.detail;
    } catch {
      /* ignore non-JSON bodies */
    }
    return new CpAuthApiError(r.status, detail);
  }
}

export { CpAuthApiError };
