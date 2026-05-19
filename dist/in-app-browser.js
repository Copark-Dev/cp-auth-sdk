// In-app browser detection. Two layers:
//
//   1. Blacklist (PATTERNS): named apps that Google's OAuth policy blocks.
//      Captures the popular global + Korean apps that account for ~99% of
//      real user traffic. Each pattern returns the human-readable app name
//      so callers can show e.g. "Threads 앱 안에서 열려있어요".
//
//   2. Whitelist (looksLikeNormalBrowser): conservative match of known-clean
//      mobile browsers (iOS Safari, Chrome Mobile, Samsung Internet, Firefox,
//      Edge, Opera). Anything that's a mobile UA but doesn't match the
//      whitelist is treated as in-app in "strict" mode — covers long-tail
//      apps (small banks, niche communities) that aren't in the blacklist
//      and any future webview-equipped app we haven't seen yet.
//
// Callers default to blacklist + named-app reporting; set strict:true to
// also catch unknown in-app webviews via the whitelist fallback.
// Order matters: more specific patterns first. Generic Android WebView
// (`; wv)`) is the catch-all and stays at the end.
const PATTERNS = [
    // ── Meta family ─────────────────────────────────────────────
    [/FBAN|FBAV|FB_IAB|FB4A/i, "Facebook"],
    [/Instagram/i, "Instagram"],
    // Threads ships "Barcelona" (Meta codename) in UA on many builds.
    [/Threads|Barcelona/i, "Threads"],
    // ── Global messengers / socials ─────────────────────────────
    [/MicroMessenger/i, "WeChat"],
    [/TwitterAndroid|Twitter for/i, "X"],
    [/BytedanceWebview|TikTok|musical_ly/i, "TikTok"],
    [/Snapchat/i, "Snapchat"],
    [/Pinterest/i, "Pinterest"],
    [/Reddit/i, "Reddit"],
    [/Discord(?!Bot)/i, "Discord"],
    [/TelegramAndroid|Telegram\//i, "Telegram"],
    [/Slack-Mobile|SlackChromium|Slack\//i, "Slack"],
    // ── Korean messaging / portals ──────────────────────────────
    [/KAKAOTALK/i, "KakaoTalk"],
    [/KakaoStory/i, "KakaoStory"],
    [/NAVER\(inapp|NaverSearchApp|NaverMail|naver\(inapp/i, "Naver"],
    [/DaumApps/i, "Daum"],
    [/Line\//i, "LINE"],
    [/BAND\//i, "BAND"],
    [/EveryTime|everytime\//i, "EveryTime"],
    [/Blind\//i, "Blind"],
    // ── Korean banking / payments ───────────────────────────────
    [/KAKAOBANK/i, "KakaoBank"],
    [/KakaoPay|kakao_pay/i, "KakaoPay"],
    [/Toss\/|TOSS\/|TossPay/i, "Toss"],
    [/KbStarBanking|KBpay|KB-Pay/i, "KB"],
    [/WooribankM|wooribank/i, "Woori"],
    [/ShinhanS|shinhansol/i, "Shinhan"],
    [/HanaBank|HanaWallet/i, "Hana"],
    [/NHBank|NHallone/i, "NH"],
    [/IBKonebanking|i-ONE/i, "IBK"],
    // ── Korean commerce ─────────────────────────────────────────
    [/Coupang\/|coupang\//i, "Coupang"],
    [/Baemin\//i, "Baemin"],
    [/Karrot\//i, "Karrot"],
    [/11st\/|11ST/i, "11st"],
    [/SSGCOM|SSG\//i, "SSG"],
    [/EmartMall|Emart\//i, "Emart"],
    [/LotteMembers|LOTTE/i, "Lotte"],
    [/GMarket\/|gmarket\//i, "Gmarket"],
    // ── Generic Android WebView (must stay last) ────────────────
    [/; wv\)/i, "WebView"],
];
// Conservative whitelist: matches UA strings produced by full, OS-level
// mobile browsers (Safari, Chrome Mobile, Samsung Internet, Firefox,
// Edge, Opera, Brave). We don't try to enumerate desktop browsers —
// desktop UAs never enter the in-app path because the mobile checks
// below short-circuit non-mobile UAs in detectInAppBrowser.
const WHITELIST_BROWSERS = [
    // iOS Safari: ends with " Mobile/<build> Safari/<ver>"
    /Version\/[\d.]+ Mobile\/[A-Za-z0-9]+ Safari\/[\d.]+/,
    // Chrome Mobile: "Chrome/X Mobile Safari/Y" (excluded if `wv)` present)
    /Chrome\/[\d.]+ Mobile Safari\/[\d.]+/,
    // Samsung Internet
    /SamsungBrowser\/[\d.]+/,
    // Firefox iOS / Android
    /FxiOS\/[\d.]+|Firefox\/[\d.]+/,
    // Edge mobile (Android: EdgA, iOS: EdgiOS)
    /EdgA?\/[\d.]+|EdgiOS\/[\d.]+/,
    // Opera mobile
    /OPR\/[\d.]+|OPiOS\/[\d.]+/,
    // Brave (uses Chrome UA + adds Brave/ in some builds, but mostly invisible)
    /Brave\/[\d.]+/,
    // Chromium-based mobile (DuckDuckGo, etc.)
    /DuckDuckGo\/[\d.]+/,
];
function looksLikeNormalMobileBrowser(ua) {
    // Reject if it's a known generic webview — the wv) flag is the strongest
    // negative signal and overrides any whitelist match.
    if (/; wv\)/.test(ua))
        return false;
    return WHITELIST_BROWSERS.some((re) => re.test(ua));
}
export function detectInAppBrowser(userAgent, opts = {}) {
    const ua = userAgent || "";
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isMobile = isAndroid || isIOS;
    // 1) Try blacklist first — gives us a known app name.
    for (const [pattern, name] of PATTERNS) {
        if (pattern.test(ua)) {
            return {
                isInApp: true,
                appName: name,
                isAndroid,
                isIOS,
                unknownInApp: false,
            };
        }
    }
    // 2) Strict mode: mobile UA without whitelist match → assume in-app.
    if (opts.strict && isMobile && !looksLikeNormalMobileBrowser(ua)) {
        return {
            isInApp: true,
            appName: null,
            isAndroid,
            isIOS,
            unknownInApp: true,
        };
    }
    return {
        isInApp: false,
        appName: null,
        isAndroid,
        isIOS,
        unknownInApp: false,
    };
}
// Build an Android Chrome intent URL that forces the link to leave whatever
// in-app webview is hosting the page. iOS has no equivalent — Apple does
// not expose a way for web JS to launch Safari, so iOS callers must fall
// back to a "please open in Safari" prompt.
export function buildChromeIntentUrl(href) {
    const u = new URL(href);
    const path = u.host + u.pathname + u.search;
    const scheme = u.protocol.replace(":", "");
    return `intent://${path}#Intent;scheme=${scheme};package=com.android.chrome;end`;
}
//# sourceMappingURL=in-app-browser.js.map