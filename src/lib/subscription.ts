import { SubscriptionTier } from "@prisma/client";

type SubscriptionTierInfo = {
    tier: SubscriptionTier;
    expiresAt: Date | null;
};

/**
 * 🟢 무료 BASIC 멤버십 제공 로직
 * 2026년 1월 22일 이전 가입자에게 2월 21일까지 무료 BASIC 제공 (한국 시간 기준)
 * 
 * 조건:
 * - 가입일(createdAt)이 2026-01-22 이전 (한국 시간 기준)
 * - 현재 날짜가 2026-02-21 이전 (한국 시간 기준)
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
    // 🟢 한국 시간(KST, UTC+9) 기준: 1월 22일 00:00:00 KST = 2026-01-21T15:00:00.000Z (UTC)
    const FREE_BASIC_START_DATE = new Date("2026-01-22T15:00:00.000Z");
    // 🟢 한국 시간(KST, UTC+9) 기준: 2월 21일 23:59:59 KST = 2026-02-21T14:59:59.999Z (UTC)
    const FREE_BASIC_END_DATE = new Date("2026-02-21T14:59:59.999Z");
    const now = new Date();

    // 🟢 [Fix]: 환불 후에도 무료 BASIC이 적용되지 않도록 만료일이 null이면 무료 BASIC 제공 안 함
    // 환불 시 subscriptionExpiresAt이 null로 설정되므로, 이 경우 무료 BASIC 로직을 적용하지 않음
    const wasRefunded = currentExpiresAt === null && currentTier === "FREE";
    
    // 조건 확인:
    // 1. 가입일이 1월 22일 이전인가? (한국 시간 기준)
    // 2. 현재 날짜가 2월 21일 이전인가? (한국 시간 기준)
    // 3. 현재 등급이 FREE인가?
    // 4. 환불되지 않았는가? (만료일이 null이면 환불된 것으로 간주)
    const isEligibleForFreeBasic =
        !wasRefunded &&
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
