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
export class CpIdentityApiError extends Error {
    status;
    /** e.g. IDENTITY_NOT_CONFIGURED (503), USER_REF_MISMATCH (403), NOT_COMPLETED (409). */
    code;
    constructor(status, code, message) {
        super(`[cp-identity ${status} ${code}] ${message}`);
        this.status = status;
        this.code = code;
    }
}
/** Server-side client. Never ship the API key to a browser or app bundle. */
export class CpIdentityClient {
    payUrl;
    apiKey;
    fetchImpl;
    constructor(config) {
        if (!config.apiKey)
            throw new Error("CpIdentityClient: apiKey is required");
        this.apiKey = config.apiKey;
        this.payUrl = (config.payUrl ?? DEFAULT_PAY_URL).replace(/\/$/, "");
        this.fetchImpl = config.fetch ?? globalThis.fetch;
        if (!this.fetchImpl) {
            throw new Error("CpIdentityClient: global fetch is unavailable. Provide one via config.fetch.");
        }
    }
    startVerification(input) {
        return this.request("POST", "/identity/verifications", input);
    }
    confirmVerification(verificationId, body) {
        return this.request("POST", `/identity/verifications/${encodeURIComponent(verificationId)}/confirm`, body);
    }
    getVerification(verificationId) {
        return this.request("GET", `/identity/verifications/${encodeURIComponent(verificationId)}`);
    }
    async request(method, path, body) {
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
                const j = (await r.json());
                const d = j.detail;
                if (d && typeof d === "object") {
                    const o = d;
                    if (typeof o.code === "string")
                        code = o.code;
                    if (typeof o.message === "string")
                        message = o.message;
                }
                else if (typeof d === "string") {
                    message = d;
                }
            }
            catch {
                /* non-JSON body */
            }
            throw new CpIdentityApiError(r.status, code, message);
        }
        return (await r.json());
    }
}
function loadScript(src) {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing && window.PortOne)
        return Promise.resolve();
    return new Promise((resolve, reject) => {
        const s = existing ?? document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`failed to load ${src}`));
        if (!existing)
            document.head.appendChild(s);
    });
}
/**
 * Browser only. Runs the provider window for a verification started on your
 * server. For the test sandbox (`authUrl` set, no `sdk`) it navigates to
 * `authUrl`. The returned outcome is a UX hint — confirm on the server.
 */
export async function runIdentityVerification(start) {
    if (typeof window === "undefined") {
        throw new Error("runIdentityVerification must run in a browser");
    }
    if (start.provider === "portone" && start.sdk?.params) {
        await loadScript(start.sdk.scriptUrl);
        const portone = window.PortOne;
        if (!portone)
            throw new Error("PortOne SDK did not load");
        const res = await portone.requestIdentityVerification(start.sdk.params);
        if (res === undefined)
            return { completed: false, redirected: true };
        if (res.code)
            return { completed: false, code: res.code, message: res.message };
        return { completed: true };
    }
    if (start.authUrl) {
        window.location.assign(start.authUrl);
        return { completed: false, redirected: true };
    }
    throw new Error(`unsupported identity provider for the browser helper: ${start.provider}`);
}
//# sourceMappingURL=identity.js.map