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
export declare class CpIdentityApiError extends Error {
    status: number;
    /** e.g. IDENTITY_NOT_CONFIGURED (503), USER_REF_MISMATCH (403), NOT_COMPLETED (409). */
    code: string;
    constructor(status: number, code: string, message: string);
}
/** Server-side client. Never ship the API key to a browser or app bundle. */
export declare class CpIdentityClient {
    private readonly payUrl;
    private readonly apiKey;
    private readonly fetchImpl;
    constructor(config: CpIdentityConfig);
    startVerification(input: StartVerificationInput): Promise<StartVerificationResult>;
    confirmVerification(verificationId: string, body: {
        txId: string;
        userRef?: string;
    }): Promise<VerificationResult>;
    getVerification(verificationId: string): Promise<VerificationResult>;
    private request;
}
export interface ClientIdentityOutcome {
    /** The provider window closed without an error. Still confirm on the server. */
    completed: boolean;
    /** Provider error code/message when it failed or the user cancelled. */
    code?: string;
    message?: string;
    /** Mobile browsers navigate to redirectUrl instead of resolving here. */
    redirected?: boolean;
}
/**
 * Browser only. Runs the provider window for a verification started on your
 * server. For the test sandbox (`authUrl` set, no `sdk`) it navigates to
 * `authUrl`. The returned outcome is a UX hint — confirm on the server.
 */
export declare function runIdentityVerification(start: Pick<StartVerificationResult, "sdk" | "authUrl" | "provider">): Promise<ClientIdentityOutcome>;
//# sourceMappingURL=identity.d.ts.map