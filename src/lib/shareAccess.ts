import prisma from "@/lib/db";

/** 공유 링크 열람권 유효 기간 */
export const SHARE_ACCESS_DAYS = 3;

/**
 * 사용자가 지금 이 코스를 열람할 수 있는지 — /api/courses/[id]의 hasAccess 규칙과 동일
 * (단, 만료일이 지난 구독은 cron 반영 전이라도 권한 없음으로 봄)
 */
export async function userHasCourseAccess(userId: number | null | undefined, courseId: number): Promise<boolean> {
    if (!userId) return false;
    const [course, user, unlock] = await Promise.all([
        prisma.course.findUnique({ where: { id: courseId }, select: { grade: true, isPublic: true } }),
        prisma.user.findUnique({
            where: { id: userId },
            select: { subscriptionTier: true, subscriptionExpiresAt: true },
        }),
        prisma.courseUnlock.findFirst({ where: { userId, courseId }, select: { id: true } }),
    ]);
    if (!course || !user) return false;
    if (unlock) return true;
    if (!course.isPublic) return false;
    const grade = course.grade || "FREE";
    if (grade === "FREE") return true;
    const subActive = !user.subscriptionExpiresAt || user.subscriptionExpiresAt > new Date();
    const tier = subActive ? user.subscriptionTier : "FREE";
    return tier === "PREMIUM" || (tier === "BASIC" && grade === "BASIC");
}

/** 같은 코스 공유 링크 생성 한도 (사람당, 한국 날짜 기준 하루) */
export const SHARE_DAILY_LIMIT = 5;

const KST_OFFSET_MS = 9 * 3600_000;

/** 한국 시간 기준 그날 0시 (UTC Date) */
export function kstDayStart(at: Date = new Date()): Date {
    const kst = new Date(at.getTime() + KST_OFFSET_MS);
    return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_OFFSET_MS);
}
