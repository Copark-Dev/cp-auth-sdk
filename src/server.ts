// Backend helpers for product servers (Node / Express / Next API routes /
// Fastify / etc.). Wraps cp-auth's REST API so individual products don't
// have to maintain their own httpx/fetch wrappers around the same endpoints.
//
// Pair with /jwt for token verification — typical flow:
//   1. Frontend redirects user to Google → callback hits your /oauth/callback
//   2. exchangeOAuthCode(code, codeVerifier) → cp-platform tokens
//   3. getCpUserInfo(accessToken) → email / phone / cp_user_id
//   4. Your DB: getOrCreateLocalUser by cp_user_id mapping
//   5. Optionally mint your own session JWT, or just hand the cp access
//      token to the frontend and call verifyCpJwt() on subsequent requests.

const DEFAULT_AUTH_URL = "https://auth.cp-platform.com";

export interface CpServerConfig {
  /** Defaults to https://auth.cp-platform.com. Override for staging/local. */
  authUrl?: string;
  /** Fetch implementation. Defaults to global fetch. Override for SSR
   *  contexts where a custom fetch is desirable (logging, retries). */
  fetch?: typeof fetch;
}

export interface CpTokenSet {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
}

export interface CpUserInfo {
  /** auth.users.id on the cp-platform Supabase project. */
  sub: string;
  email: string | null;
  phone: string | null;
  email_verified?: boolean;
  phone_verified?: boolean;
  nickname?: string | null;
  avatar_url?: string | null;
  /** Anything else the userinfo endpoint returns. */
  [key: string]: unknown;
}

export class CpServerApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`[cp-auth ${status}] ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

export class CpServerClient {
  private readonly authUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: CpServerConfig = {}) {
    this.authUrl = (config.authUrl ?? DEFAULT_AUTH_URL).replace(/\/$/, "");
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error(
        "CpServerClient: global fetch is unavailable. Provide one via config.fetch.",
      );
    }
  }

  /**
   * Exchange the `code` returned by cp-auth's OAuth callback for a token
   * set. For provider=google / kakao the cp-auth server handled PKCE
   * internally — pass codeVerifier only for email/magic-link flows where
   * the SDK generated it in-browser.
   */
  async exchangeOAuthCode(
    code: string,
    codeVerifier?: string,
  ): Promise<CpTokenSet> {
    return this.post<CpTokenSet>("/auth/oauth/exchange", {
      code,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    });
  }

  /** Refresh a cp-auth token set using the refresh token. */
  async refreshToken(refreshToken: string): Promise<CpTokenSet> {
    return this.post<CpTokenSet>("/auth/refresh", {
      refresh_token: refreshToken,
    });
  }

  /**
   * Fetch the user info associated with a cp-auth access token. Backends
   * usually call this once on first sight of a new cp_user_id to populate
   * their own user row.
   */
  async getUserInfo(accessToken: string): Promise<CpUserInfo> {
    const r = await this.fetchImpl(`${this.authUrl}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) throw await this.toError(r);
    return (await r.json()) as CpUserInfo;
  }

  /** Revoke a session globally. Best-effort — failures are not catastrophic. */
  async logout(accessToken: string): Promise<void> {
    await this.fetchImpl(`${this.authUrl}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined);
  }

  // ─── Internals ─────────────────────────────────────────────────────

  private async post<T>(path: string, body: unknown): Promise<T> {
    const r = await this.fetchImpl(`${this.authUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw await this.toError(r);
    return (await r.json()) as T;
  }

  private async toError(r: Response): Promise<CpServerApiError> {
    let detail = r.statusText;
    try {
      const j = (await r.json()) as { detail?: string };
      if (typeof j.detail === "string") detail = j.detail;
    } catch {
      /* ignore non-JSON bodies */
    }
    return new CpServerApiError(r.status, detail);
  }
}
