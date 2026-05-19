// Token storage abstraction. The default is localStorage on the web.
//
// React Native / Expo / Node / SSR contexts don't have window — pass a
// custom adapter (e.g. one backed by AsyncStorage or expo-secure-store)
// via CpAuthConfig.storageAdapter. Anything that implements TokenStorage
// works. Mobile callers should prefer the async-safe sync wrapper pattern
// since this interface is synchronous — see README for an AsyncStorage
// example using an in-memory cache hydrated at boot.
const ACCESS_KEY = "cp_auth_access_token";
const REFRESH_KEY = "cp_auth_refresh_token";
const EXPIRY_KEY = "cp_auth_token_expires_at";
class LocalStorageBacked {
    getAccess() {
        try {
            return typeof window !== "undefined"
                ? window.localStorage.getItem(ACCESS_KEY)
                : null;
        }
        catch {
            return null;
        }
    }
    getRefresh() {
        try {
            return typeof window !== "undefined"
                ? window.localStorage.getItem(REFRESH_KEY)
                : null;
        }
        catch {
            return null;
        }
    }
    getExpiresAt() {
        try {
            if (typeof window === "undefined")
                return null;
            const v = window.localStorage.getItem(EXPIRY_KEY);
            return v ? parseInt(v, 10) : null;
        }
        catch {
            return null;
        }
    }
    set(access, refresh, expiresIn) {
        try {
            if (typeof window === "undefined")
                return;
            window.localStorage.setItem(ACCESS_KEY, access);
            if (refresh)
                window.localStorage.setItem(REFRESH_KEY, refresh);
            window.localStorage.setItem(EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
        }
        catch {
            // swallow — quota / private mode / no window
        }
    }
    clear() {
        try {
            if (typeof window === "undefined")
                return;
            window.localStorage.removeItem(ACCESS_KEY);
            window.localStorage.removeItem(REFRESH_KEY);
            window.localStorage.removeItem(EXPIRY_KEY);
        }
        catch { }
    }
}
class MemoryBacked {
    access = null;
    refresh = null;
    expiresAt = null;
    getAccess() {
        return this.access;
    }
    getRefresh() {
        return this.refresh;
    }
    getExpiresAt() {
        return this.expiresAt;
    }
    set(access, refresh, expiresIn) {
        this.access = access;
        this.refresh = refresh ?? null;
        this.expiresAt = Date.now() + expiresIn * 1000;
    }
    clear() {
        this.access = null;
        this.refresh = null;
        this.expiresAt = null;
    }
}
export function createStorage(spec) {
    if (typeof spec === "object" && spec !== null)
        return spec;
    if (spec === "memory" || typeof window === "undefined")
        return new MemoryBacked();
    return new LocalStorageBacked();
}
//# sourceMappingURL=storage.js.map