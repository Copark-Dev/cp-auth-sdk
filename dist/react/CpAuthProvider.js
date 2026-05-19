"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useMemo, useState, } from "react";
import { detectInAppBrowser, buildChromeIntentUrl, } from "../in-app-browser.js";
import { InAppBrowserModal } from "./components/InAppBrowserModal.js";
const ctx = createContext(null);
const DEFAULT_GATED = ["google", "apple"];
export function CpAuthProvider({ children, strict = true, gatedProviders = DEFAULT_GATED, }) {
    const [inAppInfo, setInAppInfo] = useState(null);
    const guardOAuth = useCallback((provider) => {
        if (!gatedProviders.includes(provider))
            return "proceed";
        if (typeof navigator === "undefined")
            return "proceed";
        const info = detectInAppBrowser(navigator.userAgent, { strict });
        if (!info.isInApp)
            return "proceed";
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
    }, [gatedProviders, strict]);
    const dismissInApp = useCallback(() => setInAppInfo(null), []);
    const value = useMemo(() => ({ guardOAuth, inAppInfo, dismissInApp }), [guardOAuth, inAppInfo, dismissInApp]);
    return (_jsxs(ctx.Provider, { value: value, children: [children, inAppInfo && (_jsx(InAppBrowserModal, { info: inAppInfo, onClose: dismissInApp }))] }));
}
export function useCpAuth() {
    const v = useContext(ctx);
    if (!v)
        throw new Error("useCpAuth must be used inside a <CpAuthProvider>. Wrap your app root.");
    return v;
}
//# sourceMappingURL=CpAuthProvider.js.map