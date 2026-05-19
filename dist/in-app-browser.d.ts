export type InAppBrowserInfo = {
    isInApp: boolean;
    appName: string | null;
    isAndroid: boolean;
    isIOS: boolean;
    /** True when detection came from the whitelist fallback (unknown app). */
    unknownInApp: boolean;
};
export type DetectOptions = {
    /**
     * When true, anything that's a mobile UA but doesn't match a known
     * clean browser (Safari/Chrome/Samsung/Firefox/Edge/Opera/Brave) is
     * treated as in-app even without a blacklist hit. Default false to
     * minimize false positives on niche-but-legitimate browsers.
     */
    strict?: boolean;
};
export declare function detectInAppBrowser(userAgent: string, opts?: DetectOptions): InAppBrowserInfo;
export declare function buildChromeIntentUrl(href: string): string;
//# sourceMappingURL=in-app-browser.d.ts.map