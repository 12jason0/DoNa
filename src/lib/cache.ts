// src/lib/cache.ts
// 🟢 2순위: Redis 캐시 지원. UPSTASH 미설정 시 기존 메모리 캐시로 폴백 (서버리스 인스턴스 간 일관성 확보)

import { Redis } from "@upstash/redis";

const CACHE_PREFIX = "cache:";
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5분
const MAX_MEMORY_ENTRIES = 1000;

type MemoryEntry = { value: unknown; expiresAt: number };

let redis: Redis | null = null;
const memoryStore = new Map<string, MemoryEntry>();

function getRedis(): Redis | null {
    if (redis !== null) return redis;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    redis = new Redis({ url, token });
    return redis;
}

function evictMemoryIfNeeded(): void {
    if (memoryStore.size <= MAX_MEMORY_ENTRIES) return;
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
        if (entry.expiresAt <= now) memoryStore.delete(key);
    }
    if (memoryStore.size <= MAX_MEMORY_ENTRIES) return;
    const over = memoryStore.size - MAX_MEMORY_ENTRIES;
    const keys = Array.from(memoryStore.keys()).slice(0, over);
    keys.forEach((k) => memoryStore.delete(k));
}

/** 비동기 캐시 인터페이스 (Redis 또는 메모리) */
export const defaultCache = {
    async get<T>(key: string): Promise<T | undefined> {
        const r = getRedis();
        if (r) {
            try {
                const raw = await r.get<string>(CACHE_PREFIX + key);
                if (raw == null) return undefined;
                return typeof raw === "string" ? (JSON.parse(raw) as T) : (raw as T);
            } catch {
                return undefined;
            }
        }
        const entry = memoryStore.get(key) as MemoryEntry | undefined;
        if (!entry) return undefined;
        if (entry.expiresAt <= Date.now()) {
            memoryStore.delete(key);
            return undefined;
        }
        return entry.value as T;
    },

    async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
        const ttl = ttlMs ?? DEFAULT_TTL_MS;
        const r = getRedis();
        if (r) {
            try {
                const serialized = JSON.stringify(value);
                await r.set(CACHE_PREFIX + key, serialized, { px: ttl });
            } catch {
                // Redis 실패 시 무시 (메모리에는 넣지 않음)
            }
            return;
        }
        const expiresAt = Date.now() + ttl;
        memoryStore.set(key, { value, expiresAt });
        evictMemoryIfNeeded();
    },

    has(key: string): boolean {
        const entry = memoryStore.get(key);
        if (!entry) return false;
        if (entry.expiresAt <= Date.now()) {
            memoryStore.delete(key);
            return false;
        }
        return true;
    },

    delete(key: string): void {
        memoryStore.delete(key);
        const r = getRedis();
        if (r) void r.del(CACHE_PREFIX + key).catch(() => {});
    },

    clear(): void {
        memoryStore.clear();
    },
};

/** 하위 호환: 기존 동기 get을 쓰는 코드가 있을 수 있어 레거시용 동기 래퍼 (비권장) */
export class SimpleTTLCache {
    private store = new Map<string, MemoryEntry>();
    private readonly defaultTtlMs: number;
    private readonly maxEntries: number;

    constructor(options?: { defaultTtlMs?: number; maxEntries?: number }) {
        this.defaultTtlMs = Math.max(1, options?.defaultTtlMs ?? DEFAULT_TTL_MS);
        this.maxEntries = Math.max(10, options?.maxEntries ?? MAX_MEMORY_ENTRIES);
    }

    get<T>(key: string): T | undefined {
        const entry = this.store.get(key) as MemoryEntry | undefined;
        if (!entry) return undefined;
        if (entry.expiresAt <= Date.now()) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value as T;
    }

    set<T>(key: string, value: T, ttlMs?: number): void {
        const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
        this.store.set(key, { value, expiresAt });
        if (this.store.size > this.maxEntries) {
            const keys = Array.from(this.store.keys()).slice(0, this.store.size - this.maxEntries);
            keys.forEach((k) => this.store.delete(k));
        }
    }

    has(key: string): boolean {
        const entry = this.store.get(key);
        if (!entry) return false;
        if (entry.expiresAt <= Date.now()) {
            this.store.delete(key);
            return false;
        }
        return true;
    }

    delete(key: string): void {
        this.store.delete(key);
    }

    clear(): void {
        this.store.clear();
    }
}
