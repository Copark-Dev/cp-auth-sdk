import type { CpAuthConfig, OAuthProvider, SignupResult, TokenResponse, CpAuthUser } from "./types.js";
import { detectInAppBrowser } from "./in-app-browser.js";
declare class CpAuthApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail: string);
}
export declare class CpAuthClient {
    private readonly authUrl;
    private readonly productOrigin;
    private readonly storage;
    private refreshInflight;
    constructor(config: CpAuthConfig);
    getAccessToken(): string | null;
    isLoggedIn(): boolean;
    /** Returns a valid access token, refreshing if it expires soon. */
    ensureAccessToken(): Promise<string | null>;
    private refresh;
    login(email: string, password: string): Promise<TokenResponse>;
    signup(args: {
        email: string;
        password: string;
        phone: string;
        phone_consent: boolean;
        nickname?: string;
    }): Promise<SignupResult>;
    logout(): Promise<void>;
    getMe(): Promise<CpAuthUser>;
    requestPasswordReset(email: string): Promise<void>;
    confirmPasswordReset(token: string, newPassword: string): Promise<void>;
    verifyEmail(token: string, type?: string): Promise<TokenResponse>;
    /**
     * Kick off an OAuth login. Three modes when an in-app browser is
     * detected and the provider is one Google blocks (google/apple):
     *
     *   - `onInApp: "modal"` (default) — return `{ blocked: true, info }`
     *     so the caller can show <InAppBrowserModal/> or equivalent UI.
     *   - `onInApp: "auto-escape"` — on Android, navigate the page
     *     immediately to a Chrome intent URL so the user lands in Chrome
     *     without seeing any modal. iOS falls back to `blocked: true`
     *     because Apple blocks programmatic Safari escape. Saves user
     *     from one extra tap on Android (the most common case).
     *   - `onInApp: "ignore"` — opt out of the gate entirely. Useful for
     *     test fixtures and native apps where in-app detection doesn't
     *     apply (SFSafariViewController / Custom Tabs handle OAuth fine).
     *
     * Kakao never triggers the gate (works in-app on iOS via
     * SFSafariViewController and on Android via Custom Tabs).
     *
     * Set `strict: true` to also catch unknown in-app webviews not in
     * the blacklist (Toss / Coupang / less common banks / Discord on
     * older builds / etc.). Default off to avoid false positives on
     * fringe-but-legitimate browsers.
     */
    startOAuth(provider: OAuthProvider, redirectPathOrOpts?: string | {
        redirectPath?: string;
        onInApp?: "modal" | "auto-escape" | "ignore";
        strict?: boolean;
    }): Promise<{
        blocked: true;
        info: ReturnType<typeof detectInAppBrowser>;
    } | {
        blocked: false;
        url: string;
    } | {
        blocked: false;
        redirected: true;
    }>;
    /** Convenience for forcing an Android-in-app caller out to Chrome. */
    buildChromeIntent(href?: string): string;
    private post;
    private toError;
}
export { CpAuthApiError };
//# sourceMappingURL=client.d.ts.map