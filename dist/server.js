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
export class CpServerApiError extends Error {
    status;
    detail;
    constructor(status, detail) {
        super(`[cp-auth ${status}] ${detail}`);
        this.status = status;
        this.detail = detail;
    }
}
export class CpServerClient {
    authUrl;
    fetchImpl;
    constructor(config = {}) {
        this.authUrl = (config.authUrl ?? DEFAULT_AUTH_URL).replace(/\/$/, "");
        this.fetchImpl = config.fetch ?? globalThis.fetch;
        if (!this.fetchImpl) {
            throw new Error("CpServerClient: global fetch is unavailable. Provide one via config.fetch.");
        }
    }
    /**
     * Exchange the `code` returned by cp-auth's OAuth callback for a token
     * set. For provider=google / kakao the cp-auth server handled PKCE
     * internally — pass codeVerifier only for email/magic-link flows where
     * the SDK generated it in-browser.
     */
    async exchangeOAuthCode(code, codeVerifier) {
        return this.post("/auth/oauth/exchange", {
            code,
            ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
        });
    }
    /** Refresh a cp-auth token set using the refresh token. */
    async refreshToken(refreshToken) {
        return this.post("/auth/refresh", {
            refresh_token: refreshToken,
        });
    }
    /**
     * Fetch the user info associated with a cp-auth access token. Backends
     * usually call this once on first sight of a new cp_user_id to populate
     * their own user row.
     */
    async getUserInfo(accessToken) {
        const r = await this.fetchImpl(`${this.authUrl}/oauth/userinfo`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!r.ok)
            throw await this.toError(r);
        return (await r.json());
    }
    /** Revoke a session globally. Best-effort — failures are not catastrophic. */
    async logout(accessToken) {
        await this.fetchImpl(`${this.authUrl}/auth/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => undefined);
    }
    // ─── Internals ─────────────────────────────────────────────────────
    async post(path, body) {
        const r = await this.fetchImpl(`${this.authUrl}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!r.ok)
            throw await this.toError(r);
        return (await r.json());
    }
    async toError(r) {
        let detail = r.statusText;
        try {
            const j = (await r.json());
            if (typeof j.detail === "string")
                detail = j.detail;
        }
        catch {
            /* ignore non-JSON bodies */
        }
        return new CpServerApiError(r.status, detail);
    }
}
//# sourceMappingURL=server.js.map