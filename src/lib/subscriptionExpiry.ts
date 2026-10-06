import prisma from "@/lib/db";

/**
 * 구독 만료 안전장치 — RevenueCat 웹훅(EXPIRATION)이 누락돼도 만료된 사람이 유료로 남지 않게.
 * 대상: 만료일이 지났는데 BASIC/PREMIUM인 사용자 (만료일이 비어 있는 무기한 부여는 제외 — lt 조건이라 null은 안 걸림)
 * RevenueCat에서 활성 구독이 정말 없을 때만 FREE. 조회 실패·키 없음이면 아무도 안 내림.
 * 코스 열람권(CourseUnlock)은 건드리지 않음.
 */

/** RevenueCat v1 subscriber 응답 중 쓰는 부분 */
export type RcSubscriber = {
    subscriptions?: Record<
        string,
        {
            expires_date?: string | null;
            grace_period_expires_date?: string | null;
            refunded_at?: string | null;
        }
    >;
};

/** 우리 구독 상품 (Google Play는 "상품:기본요금제"로 올 수 있어 콜론 앞만 비교) */
const SUBSCRIPTION_PRODUCTS = new Set(["kr.io.dona.ai_basic_monthly", "kr.io.dona.premium_monthly"]);

/** 활성 구독이 하나라도 있으면 true (만료 전이거나 결제 유예 기간 중, 환불 안 됨) */
export function hasActiveSubscription(subscriber: RcSubscriber, now: Date = new Date()): boolean {
    for (const [productId, sub] of Object.entries(subscriber.subscriptions ?? {})) {
        if (!SUBSCRIPTION_PRODUCTS.has(productId.split(":")[0])) continue;
        if (sub.refunded_at) continue;
        const until = [sub.expires_date, sub.grace_period_expires_date]
            .filter((d): d is string => !!d)
            .map((d) => new Date(d).getTime());
        // expires_date가 없으면(평생) 활성
        if (!sub.expires_date || until.some((t) => t > now.getTime())) return true;
    }
    return false;
}

/** 실제 RevenueCat 조회. 실패하면 null (→ 그 사용자는 건드리지 않음) */
export async function fetchRevenueCatSubscriber(appUserId: string): Promise<RcSubscriber | null> {
    const key = process.env.REVENUECAT_SECRET_API_KEY;
    if (!key) return null;
    try {
        const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
            headers: { Authorization: `Bearer ${key}` },
            cache: "no-store",
        });
        if (!res.ok) return null;
        const body = await res.json();
        return body?.subscriber ?? null;
    } catch {
        return null;
    }
}

export type ExpiryResult = {
    checked: number;
    downgraded: { userId: number; previousTier: string; expiresAt: string }[];
    keptActive: number[];
    skipped: number[];
};

export async function downgradeExpiredSubscriptions(
    fetchSubscriber: (appUserId: string) => Promise<RcSubscriber | null> = fetchRevenueCatSubscriber,
    now: Date = new Date(),
): Promise<ExpiryResult> {
    const candidates = await prisma.user.findMany({
        where: { subscriptionTier: { in: ["BASIC", "PREMIUM"] }, subscriptionExpiresAt: { lt: now } },
        select: { id: true, subscriptionTier: true, subscriptionExpiresAt: true },
    });
    const result: ExpiryResult = { checked: candidates.length, downgraded: [], keptActive: [], skipped: [] };

    for (const u of candidates) {
        const subscriber = await fetchSubscriber(String(u.id));
        if (!subscriber) {
            result.skipped.push(u.id);
            console.warn("[구독 만료 점검] RevenueCat 조회 실패 — 유지", { userId: u.id });
            continue;
        }
        if (hasActiveSubscription(subscriber, now)) {
            result.keptActive.push(u.id);
            console.log("[구독 만료 점검] RevenueCat 활성 구독 있음 — 유지 (웹훅 누락 가능성)", { userId: u.id });
            continue;
        }
        // 조회하는 사이 웹훅 갱신이 들어왔으면 안 바뀌게: 등급·만료일이 그대로일 때만
        const { count } = await prisma.user.updateMany({
            where: { id: u.id, subscriptionTier: u.subscriptionTier, subscriptionExpiresAt: u.subscriptionExpiresAt },
            data: { subscriptionTier: "FREE", isAutoRenewal: false },
        });
        if (count === 1) {
            const row = {
                userId: u.id,
                previousTier: u.subscriptionTier,
                expiresAt: u.subscriptionExpiresAt!.toISOString(),
            };
            result.downgraded.push(row);
            console.log("[구독 만료 점검] FREE로 변경", row);
        }
    }
    return result;
}
