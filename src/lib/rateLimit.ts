/**
 * Rate limiting via Upstash Redis (1순위 보안)
 * 환경변수 미설정 시 제한 없음 (로컬 개발용)
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitType = "auth_login" | "recommendation" | "payment" | "api_generic" | "review" | "upload";

let redis: Redis | null = null;
const limiters: Partial<Record<RateLimitType, Ratelimit>> = {};

function getRedis(): Redis | null {
    if (redis !== null) return redis;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    redis = new Redis({ url, token });
    return redis;
}

function getLimiter(type: RateLimitType): Ratelimit | null {
    if (limiters[type]) return limiters[type]!;
    const r = getRedis();
    if (!r) return null;
    switch (type) {
        case "auth_login":
            limiters[type] = new Ratelimit({
                redis: r,
                limiter: Ratelimit.slidingWindow(10, "1 m"),
                prefix: "rl:login",
            });
            break;
        case "recommendation":
            limiters[type] = new Ratelimit({
                redis: r,
                limiter: Ratelimit.slidingWindow(30, "1 m"),
                prefix: "rl:rec",
            });
            break;
        case "payment":
            limiters[type] = new Ratelimit({
                redis: r,
                limiter: Ratelimit.slidingWindow(20, "1 m"),
                prefix: "rl:pay",
            });
            break;
        case "api_generic":
            limiters[type] = new Ratelimit({
                redis: r,
                limiter: Ratelimit.slidingWindow(100, "1 m"),
                prefix: "rl:api",
            });
            break;
        case "review":
            limiters[type] = new Ratelimit({
                redis: r,
                limiter: Ratelimit.slidingWindow(20, "1 m"),
                prefix: "rl:review",
            });
            break;
        case "upload":
            limiters[type] = new Ratelimit({
                redis: r,
                limiter: Ratelimit.slidingWindow(30, "1 m"),
                prefix: "rl:upload",
            });
            break;
        default:
            return null;
    }
    return limiters[type]!;
}

export type RateLimitResult =
    | { success: true; limit: number; remaining: number; reset: number }
    | { success: false; limit: number; remaining: number; reset: number };

/**
 * 식별자(IP 또는 userId)에 대해 rate limit 확인.
 * Redis 미설정 시 항상 success: true 반환.
 */
export async function checkRateLimit(
    type: RateLimitType,
    identifier: string
): Promise<RateLimitResult> {
    const limiter = getLimiter(type);
    if (!limiter) {
        return { success: true, limit: 999, remaining: 999, reset: Date.now() + 60000 };
    }
    const result = await limiter.limit(identifier);
    return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
    };
}

/** 요청에서 식별자 추출 (IP 우선, 없으면 anonymous) */
export function getIdentifierFromRequest(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwarded?.split(",")[0]?.trim() || realIp || "anonymous";
    return ip;
}
