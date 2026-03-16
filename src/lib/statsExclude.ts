import type { PrismaClient } from "@prisma/client";

/**
 * 조회수·집계에서 제외할 테스트/내부 계정 닉네임 (users.username = nickname)
 * 이 유저들의 view 기록은 남기지 않고, 관리자 통계 집계에서도 제외함.
 */
export const EXCLUDED_STATS_USERNAMES = ["승용", "오승용", "아아아아", "용용"] as const;

/**
 * 제외 대상 유저 ID 목록 조회 (캐시 없이 매번 DB 조회)
 */
export async function getExcludedStatsUserIds(prisma: PrismaClient): Promise<number[]> {
    const users = await prisma.user.findMany({
        where: { username: { in: [...EXCLUDED_STATS_USERNAMES] } },
        select: { id: true },
    });
    return users.map((u) => u.id);
}

/**
 * 해당 userId가 제외 대상인지 확인 (이름 기준, DB 1회 조회)
 */
export async function isExcludedStatsUser(
    prisma: PrismaClient,
    userId: number
): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
    });
    if (!user) return false;
    return EXCLUDED_STATS_USERNAMES.includes(user.username as any);
}
