import { type ReactNode } from "react";
import { type InAppBrowserInfo } from "../in-app-browser.js";
import type { OAuthProvider } from "../types.js";
export type GuardResult = "proceed" | "redirected" | "blocked";
export interface CpAuthContextValue {
    /**
     * Gate an OAuth click. Returns "proceed" when the caller should run
     * its own OAuth flow. Returns "redirected" when we navigated the page
     * to a Chrome intent URL (Android in-app). Returns "blocked" when we
     * showed the iOS in-app modal — caller stops and the user picks up
     * after opening Safari.
     *
     * Kakao is always "proceed" — Kakao works inside in-app webviews.
     */
    guardOAuth: (provider: OAuthProvider) => GuardResult;
    /** Last detected in-app info, if any. */
    inAppInfo: InAppBrowserInfo | null;
    /** Imperatively dismiss the modal (rarely needed; modal owns its X). */
    dismissInApp: () => void;
}
export interface CpAuthProviderProps {
    children: ReactNode;
    /**
     * Strict in-app detection — catches mobile UAs outside the named
     * blacklist (long-tail apps, future webviews). Recommended on.
     */
    strict?: boolean;
    /**
     * Providers that should be gated. Google/Apple by default (Google's
     * disallowed_useragent policy). Kakao is always allowed because it
     * works inside in-app webviews.
     */
    gatedProviders?: OAuthProvider[];
}
export declare function CpAuthProvider({ children, strict, gatedProviders, }: CpAuthProviderProps): import("react/jsx-runtime").JSX.Element;
export declare function useCpAuth(): CpAuthContextValue;
//# sourceMappingURL=CpAuthProvider.d.ts.map