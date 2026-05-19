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
export declare class CpServerApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail: string);
}
export declare class CpServerClient {
    private readonly authUrl;
    private readonly fetchImpl;
    constructor(config?: CpServerConfig);
    /**
     * Exchange the `code` returned by cp-auth's OAuth callback for a token
     * set. For provider=google / kakao the cp-auth server handled PKCE
     * internally — pass codeVerifier only for email/magic-link flows where
     * the SDK generated it in-browser.
     */
    exchangeOAuthCode(code: string, codeVerifier?: string): Promise<CpTokenSet>;
    /** Refresh a cp-auth token set using the refresh token. */
    refreshToken(refreshToken: string): Promise<CpTokenSet>;
    /**
     * Fetch the user info associated with a cp-auth access token. Backends
     * usually call this once on first sight of a new cp_user_id to populate
     * their own user row.
     */
    getUserInfo(accessToken: string): Promise<CpUserInfo>;
    /** Revoke a session globally. Best-effort — failures are not catastrophic. */
    logout(accessToken: string): Promise<void>;
    private post;
    private toError;
}
//# sourceMappingURL=server.d.ts.map