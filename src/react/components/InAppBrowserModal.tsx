// Drop-in modal for in-app browser users. Default export is unstyled with
// minimal inline CSS so it works without a design system — products are
// expected to fork / theme it. The behavior (Chrome intent on Android,
// clipboard fallback on iOS, close-anyway) is the load-bearing part.

import { useState, type CSSProperties } from "react";
import {
  buildChromeIntentUrl,
  type InAppBrowserInfo,
} from "../../in-app-browser.js";

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

const defaultCopy = {
  title: (app: string) =>
    app ? `${app} 앱 안에서 열려있어요` : "앱 안에서 열려있어요",
  desc: "Google·Apple 로그인은 보안 정책상 일부 앱의 내장 브라우저에서 차단됩니다. 외부 브라우저로 열거나 다른 로그인 방법을 이용해주세요.",
  openChrome: "Chrome으로 열기",
  copyUrl: "주소 복사하기",
  copied: "복사 완료 — Safari에 붙여넣어 주세요",
  iosHint: "복사 후 Safari를 열고 주소창에 붙여넣으세요.",
  close: "닫기",
};

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    padding: 24,
    background: "#121820",
    color: "#fafafa",
    borderRadius: "24px 24px 0 0",
    boxShadow: "0 -10px 40px rgba(0,0,0,0.4)",
  },
  title: { fontSize: 18, fontWeight: 700, margin: "0 0 8px" },
  desc: { fontSize: 14, lineHeight: 1.6, color: "#a1a1aa", margin: "0 0 20px" },
  btnPrimary: {
    display: "block",
    width: "100%",
    padding: "14px 16px",
    marginBottom: 10,
    borderRadius: 12,
    border: 0,
    cursor: "pointer",
    background: "#2E5BFF",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
  },
  btnSecondary: {
    display: "block",
    width: "100%",
    padding: "14px 16px",
    marginBottom: 10,
    borderRadius: 12,
    cursor: "pointer",
    background: "transparent",
    color: "#fafafa",
    border: "1px solid rgba(255,255,255,0.12)",
    fontSize: 14,
    fontWeight: 500,
  },
  btnGhost: {
    display: "block",
    width: "100%",
    padding: 12,
    border: 0,
    background: "transparent",
    color: "#8a8a94",
    fontSize: 12,
    cursor: "pointer",
  },
  hint: {
    fontSize: 12,
    color: "#8a8a94",
    lineHeight: 1.5,
    margin: "10px 0 16px",
  },
};

export function InAppBrowserModal({
  info,
  onClose,
  targetUrl,
  copy,
}: InAppBrowserModalProps) {
  const [copied, setCopied] = useState(false);
  const url =
    targetUrl ?? (typeof window !== "undefined" ? window.location.href : "");
  const c = { ...defaultCopy, ...copy };

  const handleChrome = () => {
    window.location.href = buildChromeIntentUrl(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "absolute";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div
      style={styles.overlay}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{c.title(info.appName ?? "")}</h2>
        <p style={styles.desc}>{c.desc}</p>
        {info.isAndroid && (
          <button
            type="button"
            style={styles.btnPrimary}
            onClick={handleChrome}
          >
            {c.openChrome}
          </button>
        )}
        <button
          type="button"
          style={info.isAndroid ? styles.btnSecondary : styles.btnPrimary}
          onClick={handleCopy}
        >
          {copied ? c.copied : c.copyUrl}
        </button>
        {info.isIOS && <p style={styles.hint}>{c.iosHint}</p>}
        <button type="button" style={styles.btnGhost} onClick={onClose}>
          {c.close}
        </button>
      </div>
    </div>
  );
}
