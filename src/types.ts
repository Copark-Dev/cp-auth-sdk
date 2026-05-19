import type { TokenStorage } from "./storage.js";

export type CpAuthConfig = {
  /**
   * Base URL of cp-auth. Production: https://auth.cp-platform.com
   * Local development: http://localhost:8000
   */
  authUrl: string;
  /**
   * Where to land users after they click the email-reset / email-confirm
   * links Supabase sends. Must be on YOUR product's domain — cp-auth
   * forwards Supabase here with token in the query string.
   * e.g. https://your-product.example.com  (web)  or  com.yourproduct.app://callback  (RN deep link)
   */
  productOrigin?: string;
  /**
   * Token storage. Either a built-in kind or your own adapter implementing
   * `TokenStorage`. Defaults to "localStorage" on the web, automatically
   * falls back to "memory" if window is undefined.
   *
   * React Native: pass an AsyncStorage-backed adapter — see README.
   * Node / SSR: omit (memory) or pass your own.
   */
  storage?: "localStorage" | "memory" | TokenStorage;
};

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type: "bearer";
  expires_in: number;
};

export type SignupResult =
  | ({ status: "authenticated" } & TokenResponse)
  | { status: "verification_required"; email: string; message?: string };

export type CpAuthUser = {
  id: string;
  email: string | null;
  phone: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  created_at: string;
};

export type OAuthProvider = "google" | "kakao" | "apple" | "github";

export type CpAuthError = {
  status: number;
  detail: string;
};
