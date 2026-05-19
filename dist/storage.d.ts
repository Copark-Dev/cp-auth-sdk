export interface TokenStorage {
    getAccess(): string | null;
    getRefresh(): string | null;
    getExpiresAt(): number | null;
    set(access: string, refresh: string | undefined, expiresIn: number): void;
    clear(): void;
}
export type StorageKind = "localStorage" | "memory";
export declare function createStorage(spec: StorageKind | TokenStorage): TokenStorage;
//# sourceMappingURL=storage.d.ts.map