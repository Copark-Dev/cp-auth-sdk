import { type JWTPayload } from "jose";
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
/**
 * Verify a cp-auth access token. Throws on tamper / expiry / wrong issuer.
 * Returns the cp-platform user_id along with the raw payload — backends
 * typically use cpUserId to look up their own internal user (e.g.
 * `SELECT id FROM profiles WHERE cp_user_id = ?`).
 */
export declare function verifyCpJwt(token: string, opts?: CpJwtVerifyOptions): Promise<CpVerifiedToken>;
//# sourceMappingURL=jwt.d.ts.map