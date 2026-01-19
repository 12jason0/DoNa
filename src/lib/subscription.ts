import { SubscriptionTier } from "@prisma/client";

type SubscriptionTierInfo = {
    tier: SubscriptionTier;
    expiresAt: Date | null;
};

/**
 * 🟢 무료 BASIC 멤버십 제공 로직
 * 2월 22일 이전 가입자에게 3월 21일까지 무료 BASIC 제공
 * 
 * 조건:
 * - 가입일(createdAt)이 2024-02-22 이전
 * - 현재 날짜가 2024-03-21 이전
 * - 기존 등급이 FREE
 * 
 * @param currentTier 현재 등급
 * @param createdAt 가입일
 * @param currentExpiresAt 현재 만료일 (이미 BASIC이면 유지)
 * @returns 계산된 등급과 만료일
 */
export function calculateEffectiveSubscription(
    currentTier: SubscriptionTier,
    createdAt: Date,
    currentExpiresAt: Date | null = null
): SubscriptionTierInfo {
    const FREE_BASIC_START_DATE = new Date("2024-02-22T00:00:00.000Z");
    const FREE_BASIC_END_DATE = new Date("2024-03-21T23:59:59.999Z");
    const now = new Date();

    // 조건 확인:
    // 1. 가입일이 2월 22일 이전인가?
    // 2. 현재 날짜가 3월 21일 이전인가?
    // 3. 현재 등급이 FREE인가?
    const isEligibleForFreeBasic =
        createdAt < FREE_BASIC_START_DATE &&
        now < FREE_BASIC_END_DATE &&
        currentTier === "FREE";

    if (isEligibleForFreeBasic) {
        return {
            tier: "BASIC",
            expiresAt: FREE_BASIC_END_DATE,
        };
    }

    // 조건에 해당하지 않으면 기존 값 반환
    return {
        tier: currentTier,
        expiresAt: currentExpiresAt,
    };
}
