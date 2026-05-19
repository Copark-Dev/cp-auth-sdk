import { type InAppBrowserInfo } from "../../in-app-browser.js";
export type InAppBrowserModalProps = {
    info: InAppBrowserInfo;
    onClose: () => void;
    /** Defaults to current page. */
    targetUrl?: string;
    /** Override copy. Each field is optional. */
    copy?: {
        title?: (appName: string) => string;
        desc?: string;
        openChrome?: string;
        copyUrl?: string;
        copied?: string;
        iosHint?: string;
        close?: string;
    };
};
export declare function InAppBrowserModal({ info, onClose, targetUrl, copy, }: InAppBrowserModalProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=InAppBrowserModal.d.ts.map