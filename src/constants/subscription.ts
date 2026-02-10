/** 베이직 멤버십 월 요금 (원) */
export const BASIC_MONTHLY_PRICE = 4900;

/**
 * 등급별 추억 앨범 개수 한도
 * FREE: 5개, BASIC: 10개, PREMIUM: 무제한
 */
export const ALBUM_LIMIT_BY_TIER = {
    FREE: 5,
    BASIC: 10,
    PREMIUM: Number.POSITIVE_INFINITY,
} as const;

export type SubscriptionTierKey = keyof typeof ALBUM_LIMIT_BY_TIER;

export function getAlbumLimit(tier: string): number {
    const key = tier in ALBUM_LIMIT_BY_TIER ? (tier as SubscriptionTierKey) : "FREE";
    return ALBUM_LIMIT_BY_TIER[key];
}

/**
 * 등급별 나만의 추억(개인 리뷰) 개수 한도
 * FREE: 3개, BASIC: 10개, PREMIUM: 무제한
 */
export const MEMORY_LIMIT_BY_TIER = {
    FREE: 3,
    BASIC: 10,
    PREMIUM: Number.POSITIVE_INFINITY,
} as const;

export type MemoryLimitTierKey = keyof typeof MEMORY_LIMIT_BY_TIER;

export function getMemoryLimit(tier: string): number {
    const key = tier in MEMORY_LIMIT_BY_TIER ? (tier as MemoryLimitTierKey) : "FREE";
    return MEMORY_LIMIT_BY_TIER[key];
}
