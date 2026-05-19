// Detect in-app browsers that Google blocks for OAuth (disallowed_useragent).
// Mirrors cp-platform's frontend detection so guard behavior is identical
// across the entire product family.

export type InAppBrowserInfo = {
  isInApp: boolean;
  appName: string | null;
  isAndroid: boolean;
  isIOS: boolean;
};

// Order matters: generic WebView fallback must remain last.
const PATTERNS: Array<[RegExp, string]> = [
  [/FBAN|FBAV|FB_IAB|FB4A/i, "Facebook"],
  [/Instagram/i, "Instagram"],
  // Threads carries "Barcelona" (Meta's internal codename); the visible
  // "Threads" string is missing from many builds. Match both.
  [/Threads|Barcelona/i, "Threads"],
  [/KAKAOTALK/i, "KakaoTalk"],
  [/NAVER\(inapp/i, "Naver"],
  [/Line\//i, "LINE"],
  [/TwitterAndroid|Twitter for/i, "X"],
  [/BytedanceWebview|TikTok/i, "TikTok"],
  [/DaumApps/i, "Daum"],
  [/MicroMessenger/i, "WeChat"],
  [/; wv\)/i, "WebView"],
];

export function detectInAppBrowser(userAgent: string): InAppBrowserInfo {
  const ua = userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  for (const [pattern, name] of PATTERNS) {
    if (pattern.test(ua)) {
      return { isInApp: true, appName: name, isAndroid, isIOS };
    }
  }
  return { isInApp: false, appName: null, isAndroid, isIOS };
}

// Build an Android Chrome intent URL that forces the link to leave whatever
// in-app webview is hosting the page. iOS has no equivalent — Apple does
// not expose a way for web JS to launch Safari, so iOS callers must fall
// back to a "please open in Safari" prompt.
export function buildChromeIntentUrl(href: string): string {
  const u = new URL(href);
  const path = u.host + u.pathname + u.search;
  const scheme = u.protocol.replace(":", "");
  return `intent://${path}#Intent;scheme=${scheme};package=com.android.chrome;end`;
}
