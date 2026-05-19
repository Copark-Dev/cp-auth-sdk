# @cp-platform/auth-sdk

Federated-identity SDK for external products built on top of CP Platform (`your-product`, `another-product`, …).

Wraps cp-auth's REST API, handles in-app browser OAuth gating (Threads / Instagram / KakaoTalk / …), and ships a backend JWT verifier for product servers.

---

## Why this exists

External products want their own UI, brand, and DB but a **single user pool** with cp-platform. So:

- **Identity (auth.users)** lives in the cp-platform Supabase project.
- **Business data** stays in the product's own database, unchanged.
- A small mapping column (`cp_user_id`) on the product's `profiles` ties the two together.

This SDK gives products everything they need to plug into that model without re-implementing the auth surface for every product.

---

## Install

```bash
npm i @cp-platform/auth-sdk
# peer deps:
npm i jose           # required only if you use /jwt subexport (backend)
npm i react          # required only if you use /react subexport
```

## Use — Frontend

```ts
import { CpAuthClient, detectInAppBrowser } from "@cp-platform/auth-sdk";

const auth = new CpAuthClient({
  authUrl: "https://auth.cp-platform.com",
  productOrigin: "https://your-product.example.com",
});

// Email / password
await auth.login(email, password);
await auth.signup({ email, password, phone, phone_consent: true });
await auth.requestPasswordReset(email);
await auth.confirmPasswordReset(tokenFromEmail, newPassword);
await auth.verifyEmail(tokenFromEmail);
await auth.logout();

// Current session
auth.isLoggedIn();
const user = await auth.getMe();
const token = await auth.ensureAccessToken(); // auto-refreshes near expiry

// OAuth — handles in-app browser gating for you
const r = await auth.startOAuth("google");
if (r.blocked) {
  // r.info.appName e.g. "Threads" — show your UI / our <InAppBrowserModal/>
} else {
  window.location.href = r.url;
}
```

## Use — In-app browser modal (React)

Drop-in unstyled-ish modal:

```tsx
import { InAppBrowserModal } from "@cp-platform/auth-sdk/react";
import { detectInAppBrowser } from "@cp-platform/auth-sdk";

const info = detectInAppBrowser(navigator.userAgent);
if (info.isInApp) {
  return <InAppBrowserModal info={info} onClose={() => …} />;
}
```

Override copy / theming via the `copy` prop or fork the component — it's ~100 lines.

## Use — React Native / Expo

The core client works in RN with two adjustments: a storage adapter (because `localStorage` doesn't exist) and skipping the in-app-browser code path (native apps use `SFSafariViewController` / `Chrome Custom Tabs`, which Google's OAuth policy already allows).

### 1. AsyncStorage adapter

```ts
// auth-storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TokenStorage } from "@cp-platform/auth-sdk";

// TokenStorage is synchronous, so we hydrate the AsyncStorage values into
// an in-memory cache at app boot, then mirror writes through to disk.
const cache: Record<string, string | null> = {
  access: null,
  refresh: null,
  expiresAt: null,
};

const K = {
  access: "cp_auth_access_token",
  refresh: "cp_auth_refresh_token",
  expiresAt: "cp_auth_token_expires_at",
};

export async function hydrate() {
  const [a, r, e] = await AsyncStorage.multiGet([
    K.access,
    K.refresh,
    K.expiresAt,
  ]);
  cache.access = a[1];
  cache.refresh = r[1];
  cache.expiresAt = e[1];
}

export const storage: TokenStorage = {
  getAccess: () => cache.access,
  getRefresh: () => cache.refresh,
  getExpiresAt: () => (cache.expiresAt ? parseInt(cache.expiresAt, 10) : null),
  set: (access, refresh, expiresIn) => {
    const exp = String(Date.now() + expiresIn * 1000);
    cache.access = access;
    if (refresh) cache.refresh = refresh;
    cache.expiresAt = exp;
    AsyncStorage.multiSet([
      [K.access, access],
      ...(refresh ? [[K.refresh, refresh] as [string, string]] : []),
      [K.expiresAt, exp],
    ]);
  },
  clear: () => {
    cache.access = null;
    cache.refresh = null;
    cache.expiresAt = null;
    AsyncStorage.multiRemove([K.access, K.refresh, K.expiresAt]);
  },
};
```

For higher security (touch ID gated key, etc.) swap `AsyncStorage` for `expo-secure-store` / `react-native-keychain` — same shape.

### 2. Construct the client with your adapter

```ts
// App.tsx
import { CpAuthClient } from "@cp-platform/auth-sdk";
import { storage, hydrate } from "./auth-storage";

await hydrate(); // call once at boot, before any auth call

export const auth = new CpAuthClient({
  authUrl: "https://auth.cp-platform.com",
  productOrigin: "com.yourproduct.app://", // deep link scheme — used as OAuth redirect target
  storage,
});
```

### 3. OAuth on mobile

Mobile apps don't have the in-app browser problem — open the cp-auth OAuth URL with `expo-web-browser` (Custom Tabs / SFSafariViewController under the hood), receive the callback via deep link, then exchange the code:

```ts
import * as WebBrowser from "expo-web-browser";

const r = await auth.startOAuth("google", "/auth/callback");
if (!r.blocked) {
  // RN UA won't trigger the in-app gate
  const result = await WebBrowser.openAuthSessionAsync(
    r.url,
    "com.yourproduct.app://auth/callback",
  );
  // result.url contains the OAuth callback — extract code + complete the flow on your backend
}
```

The `detectInAppBrowser` / `<InAppBrowserModal>` helpers are web-only and don't need to be imported in RN code.

---

## Use — Backend JWT verification

```ts
import { verifyCpJwt } from "@cp-platform/auth-sdk/jwt";

const { cpUserId, email } = await verifyCpJwt(bearerToken);
// SELECT id FROM profiles WHERE cp_user_id = $1
```

Defaults point at the production cp-platform Supabase JWKS endpoint — no config needed for normal use. Override `jwksUrl` / `issuer` for staging / local supabase.

---

## Migration from self-hosted Supabase auth

If your product already runs its own `auth.users` (like `your-product` did):

1. Add `cp_user_id UUID UNIQUE` to your `profiles` (or equivalent) table.
2. For each existing user, look up their cp-platform UUID (by email) and `UPDATE … SET cp_user_id = …`.
3. Replace your `supabase.auth.*` calls with `CpAuthClient`.
4. In your backend, verify incoming tokens with `verifyCpJwt` and resolve `cp_user_id` → your internal `user_id` via the mapping column.
5. New users that sign in through cp-auth but have no row yet → auto-create on first request (`INSERT … (cp_user_id, …)` and return the new internal id).

You don't move any business data. The mapping column is the entire migration.

---

## What this SDK does NOT do

- Doesn't ship UI for login / signup / reset pages — those stay in your product (keep your brand).
- Doesn't replace your business database access.
- Doesn't manage refresh token rotation server-side — refresh is purely client.
- iOS in-app webview → outside browser is not solvable on the web platform; the modal can only ask the user to do it manually.
