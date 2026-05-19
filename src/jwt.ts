// Backend JWT verification helper. Lives in product backends
// (Next.js middleware, Express routes, ...) to verify cp-auth-issued
// access_tokens before honoring API calls.
//
// Tokens are Supabase ES256 JWTs signed by the cp-platform Supabase
// project. We verify via the project's JWKS endpoint.

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const DEFAULT_ISSUER = "https://oefybpntdguqyjrhurng.supabase.co/auth/v1";
const DEFAULT_JWKS_URL =
  "https://oefybpntdguqyjrhurng.supabase.co/auth/v1/.well-known/jwks.json";
const DEFAULT_AUDIENCE = "authenticated";

export type CpJwtVerifyOptions = {
  /** Defaults to the cp-platform Supabase project's auth issuer. */
  issuer?: string;
  /** Defaults to the cp-platform Supabase project's JWKS endpoint. */
  jwksUrl?: string;
  /** Defaults to "authenticated". */
  audience?: string;
};

export type CpVerifiedToken = {
  /** auth.users.id on the cp-platform Supabase project. */
  cpUserId: string;
  email: string | null;
  phone: string | null;
  payload: JWTPayload;
};

let cachedVerifier: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedKey: string | null = null;

function getVerifier(jwksUrl: string) {
  if (cachedKey === jwksUrl && cachedVerifier) return cachedVerifier;
  cachedKey = jwksUrl;
  cachedVerifier = createRemoteJWKSet(new URL(jwksUrl));
  return cachedVerifier;
}

/**
 * Verify a cp-auth access token. Throws on tamper / expiry / wrong issuer.
 * Returns the cp-platform user_id along with the raw payload — backends
 * typically use cpUserId to look up their own internal user (e.g.
 * `SELECT id FROM profiles WHERE cp_user_id = ?`).
 */
export async function verifyCpJwt(
  token: string,
  opts: CpJwtVerifyOptions = {},
): Promise<CpVerifiedToken> {
  const jwksUrl = opts.jwksUrl ?? DEFAULT_JWKS_URL;
  const issuer = opts.issuer ?? DEFAULT_ISSUER;
  const audience = opts.audience ?? DEFAULT_AUDIENCE;

  const verifier = getVerifier(jwksUrl);
  const { payload } = await jwtVerify(token, verifier, {
    issuer,
    audience,
    algorithms: ["ES256"],
  });

  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) throw new Error("JWT missing sub claim");

  return {
    cpUserId: sub,
    email: typeof payload.email === "string" ? payload.email : null,
    phone: typeof payload.phone === "string" ? payload.phone : null,
    payload,
  };
}
