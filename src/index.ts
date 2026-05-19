// Public surface of @cp-platform/auth-sdk.

export { CpAuthClient, CpAuthApiError } from "./client.js";
export {
  detectInAppBrowser,
  buildChromeIntentUrl,
  type InAppBrowserInfo,
} from "./in-app-browser.js";
export type {
  CpAuthConfig,
  TokenResponse,
  SignupResult,
  CpAuthUser,
  OAuthProvider,
  CpAuthError,
} from "./types.js";
