"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  detectInAppBrowser,
  buildChromeIntentUrl,
  type InAppBrowserInfo,
} from "../in-app-browser.js";
import type { OAuthProvider } from "../types.js";
import { InAppBrowserModal } from "./components/InAppBrowserModal.js";

// Result of guardOAuth:
//   "proceed"   — Safe to start your OAuth flow.
//   "redirected" — Android in-app webview, escaped to Chrome. Page is
//                  unloading; caller should NOT continue.
//   "blocked"   — iOS in-app webview. Modal is showing. Caller should NOT
//                  continue (user will retry after opening Safari).
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

const ctx = createContext<CpAuthContextValue | null>(null);

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

const DEFAULT_GATED: OAuthProvider[] = ["google", "apple"];

export function CpAuthProvider({
  children,
  strict = true,
  gatedProviders = DEFAULT_GATED,
}: CpAuthProviderProps) {
  const [inAppInfo, setInAppInfo] = useState<InAppBrowserInfo | null>(null);

  const guardOAuth = useCallback(
    (provider: OAuthProvider): GuardResult => {
      if (!gatedProviders.includes(provider)) return "proceed";
      if (typeof navigator === "undefined") return "proceed";

      const info = detectInAppBrowser(navigator.userAgent, { strict });
      if (!info.isInApp) return "proceed";

      if (info.isAndroid && typeof window !== "undefined") {
        // Android in-app: programmatically escape to Chrome. Page is
        // about to unload — caller must not continue.
        window.location.href = buildChromeIntentUrl(window.location.href);
        return "redirected";
      }

      // iOS in-app (or rare desktop-marked-in-app): show modal. Apple
      // OS blocks JS-initiated Safari launch from the web, so the user
      // must do it manually.
      setInAppInfo(info);
      return "blocked";
    },
    [gatedProviders, strict],
  );

  const dismissInApp = useCallback(() => setInAppInfo(null), []);

  const value = useMemo<CpAuthContextValue>(
    () => ({ guardOAuth, inAppInfo, dismissInApp }),
    [guardOAuth, inAppInfo, dismissInApp],
  );

  return (
    <ctx.Provider value={value}>
      {children}
      {inAppInfo && (
        <InAppBrowserModal info={inAppInfo} onClose={dismissInApp} />
      )}
    </ctx.Provider>
  );
}

export function useCpAuth(): CpAuthContextValue {
  const v = useContext(ctx);
  if (!v)
    throw new Error(
      "useCpAuth must be used inside a <CpAuthProvider>. Wrap your app root.",
    );
  return v;
}
