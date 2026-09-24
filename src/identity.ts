// Identity (adult / real-person) verification via CP Platform.
//
// Flow — the API key never leaves your server:
//   1. Server: startVerification({ userRef })     → { verificationId, txId, sdk }
//   2. Client: runIdentityVerification(sdk)        → PortOne browser SDK window
//              (or open `authUrl` when the provider is the test sandbox)
//   3. Server: confirmVerification(verificationId, { txId, userRef })
//              → { verified, isAdult, birthYear, ciHash, verifiedAt }
//
// Rules that matter:
//   - Always confirm on the server. The client-side SDK result is NOT proof —
//     CP re-checks with the provider on confirm.
//   - Keep the txId you got from startVerification server-side and use that
//     one on confirm; don't trust a txId sent back by the client.
//   - Pass userRef on confirm so a session started for one user can't be
//     completed for another (CP answers 403 USER_REF_MISMATCH).
//   - `ciHash` is stable per (person, app): use it for one-account-per-person
//     checks, never send it to the client.
//   - In production, reject results where `sandbox` is true or `mode` is
//     "test" — test mode always succeeds with deterministic fake identities.

const DEFAULT_PAY_URL = "https://pay.cp-platform.com";

export interface CpIdentityConfig {
  /** Server-side API key with the `identity.verify` permission. */
  apiKey: string;
  /** Defaults to https://pay.cp-platform.com. */
  payUrl?: string;
  fetch?: typeof fetch;
}

export interface CpIdentitySandbox {
  /** YYYY-MM-DD or YYYYMMDD. */
  birthday?: string;
  outcome?: "success" | "fail";
  /** Same personKey → same ciHash (for duplicate-account tests). */
  personKey?: string;
}

export interface StartVerificationInput {
  /** Your internal user id. Derive it from your session, not from the client. */
  userRef: string;
  /** Where the provider window returns on mobile / redirect flows. */
  successUrl?: string;
  failUrl?: string;
  requestUrl?: string;
  /** Test mode only — rejected (400) in live mode. */
  sandbox?: CpIdentitySandbox;
}

export interface CpIdentitySdkBlock {
  scriptUrl: string;
  call: string;
  /** Public values only (storeId, identityVerificationId, channelKey, redirectUrl). */
  params?: Record<string, unknown>;
}

export interface StartVerificationResult {
  verificationId: string;
  mode: "test" | "live";
  provider: "portone" | "toss_cert" | "sandbox";
  sandbox: boolean;
  txId: string;
  /** Set for the sandbox (redirect straight to successUrl/failUrl). */
  authUrl: string | null;
  sdk: CpIdentitySdkBlock | null;
  successUrl: string | null;
  failUrl: string | null;
  expiresAt: string | null;
}

export interface VerificationResult {
  verificationId: string;
  status: "pending" | "verified" | "failed" | "expired";
  verified: boolean;
  isAdult: boolean | null;
  birthYear: number | null;
  /** Per-app HMAC of the person's CI. Server-side only. */
  ciHash: string | null;
  verifiedAt: string | null;
  mode: "test" | "live";
  sandbox: boolean;
  failureCode?: string | null;
  [key: string]: unknown;
}

export interface IdentityAvailability {
  mode: "test" | "live";
  provider: "portone" | "toss_cert" | "sandbox";
  sandbox: boolean;
  /** false → start/confirm would end in 503 IDENTITY_NOT_CONFIGURED. */
  available: boolean;
}

export class CpIdentityApiError extends Error {
  status: number;
  /** e.g. IDENTITY_NOT_CONFIGURED (503), USER_REF_MISMATCH (403), NOT_COMPLETED (409). */
  code: string;
  constructor(status: number, code: string, message: string) {
    super(`[cp-identity ${status} ${code}] ${message}`);
    this.status = status;
    this.code = code;
  }
}

/** Server-side client. Never ship the API key to a browser or app bundle. */
export class CpIdentityClient {
  private readonly payUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: CpIdentityConfig) {
    if (!config.apiKey) throw new Error("CpIdentityClient: apiKey is required");
    this.apiKey = config.apiKey;
    this.payUrl = (config.payUrl ?? DEFAULT_PAY_URL).replace(/\/$/, "");
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error(
        "CpIdentityClient: global fetch is unavailable. Provide one via config.fetch.",
      );
    }
  }

  /**
   * Can this key complete a verification right now? Creates nothing. Use it to
   * switch your gate on automatically; in production don't count sandbox as available.
   */
  getAvailability(): Promise<IdentityAvailability> {
    return this.request<IdentityAvailability>("GET", "/identity/availability");
  }

  startVerification(
    input: StartVerificationInput,
  ): Promise<StartVerificationResult> {
    return this.request<StartVerificationResult>(
      "POST",
      "/identity/verifications",
      input,
    );
  }

  confirmVerification(
    verificationId: string,
    body: { txId: string; userRef?: string },
  ): Promise<VerificationResult> {
    return this.request<VerificationResult>(
      "POST",
      `/identity/verifications/${encodeURIComponent(verificationId)}/confirm`,
      body,
    );
  }

  getVerification(verificationId: string): Promise<VerificationResult> {
    return this.request<VerificationResult>(
      "GET",
      `/identity/verifications/${encodeURIComponent(verificationId)}`,
    );
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const r = await this.fetchImpl(`${this.payUrl}${path}`, {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!r.ok) {
      let code = "HTTP_ERROR";
      let message = r.statusText;
      try {
        const j = (await r.json()) as { detail?: unknown };
        const d = j.detail;
        if (d && typeof d === "object") {
          const o = d as { code?: unknown; message?: unknown };
          if (typeof o.code === "string") code = o.code;
          if (typeof o.message === "string") message = o.message;
        } else if (typeof d === "string") {
          message = d;
        }
      } catch {
        /* non-JSON body */
      }
      throw new CpIdentityApiError(r.status, code, message);
    }
    return (await r.json()) as T;
  }
}

// ─── Browser helper ───────────────────────────────────────────────────

export interface ClientIdentityOutcome {
  /** The provider window closed without an error. Still confirm on the server. */
  completed: boolean;
  /** Provider error code/message when it failed or the user cancelled. */
  code?: string;
  message?: string;
  /** Mobile browsers navigate to redirectUrl instead of resolving here. */
  redirected?: boolean;
}

type PortOneGlobal = {
  requestIdentityVerification: (
    params: Record<string, unknown>,
  ) => Promise<{ code?: string; message?: string } | undefined>;
};

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${src}"]`,
  );
  if (existing && (window as unknown as { PortOne?: unknown }).PortOne)
    return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = existing ?? document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    if (!existing) document.head.appendChild(s);
  });
}

/**
 * Browser only. Runs the provider window for a verification started on your
 * server. For the test sandbox (`authUrl` set, no `sdk`) it navigates to
 * `authUrl`. The returned outcome is a UX hint — confirm on the server.
 */
export async function runIdentityVerification(
  start: Pick<StartVerificationResult, "sdk" | "authUrl" | "provider">,
): Promise<ClientIdentityOutcome> {
  if (typeof window === "undefined") {
    throw new Error("runIdentityVerification must run in a browser");
  }
  if (start.provider === "portone" && start.sdk?.params) {
    await loadScript(start.sdk.scriptUrl);
    const portone = (window as unknown as { PortOne?: PortOneGlobal }).PortOne;
    if (!portone) throw new Error("PortOne SDK did not load");
    const res = await portone.requestIdentityVerification(start.sdk.params);
    if (res === undefined) return { completed: false, redirected: true };
    if (res.code)
      return { completed: false, code: res.code, message: res.message };
    return { completed: true };
  }
  if (start.authUrl) {
    window.location.assign(start.authUrl);
    return { completed: false, redirected: true };
  }
  throw new Error(
    `unsupported identity provider for the browser helper: ${start.provider}`,
  );
}
