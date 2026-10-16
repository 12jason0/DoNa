import prisma from "@/lib/db";
import { defaultCache } from "@/lib/cache";
import { getExcludedStatsUserIds } from "@/lib/statsExclude";
import { pickHeroByGrade } from "@/lib/courseListOrder";

/**
 * "지금 많이 선택한 코스": 최근 30일 코스 상세를 연 고유 회원 수 많은 순 (웹·앱 공통, 5분 캐시)
 * ponytail: 로그인 회원만 셈 (user_interactions.userId가 필수라 비로그인 조회는 기록이 없음).
 * 비로그인까지 세려면 course_views 같은 조회 기록 테이블 추가
 */
export async function getHotCourseIds(): Promise<number[]> {
    const key = "hot_courses_30d_v1";
    const cached = await defaultCache.get<number[]>(key);
    if (cached) return cached;
    const excluded = await getExcludedStatsUserIds(prisma as any);
    // 공개·만료는 호출하는 쪽 목록(공개+만료 안 된 코스)과 맞춰 거름 → 여기선 넉넉히 50개
    const rows = await prisma.$queryRaw<{ id: number }[]>`
        SELECT ui."courseId" AS id
        FROM user_interactions ui
        JOIN courses c ON c.id = ui."courseId" AND c."isPublic" = true
        WHERE ui.action = 'view'
          AND ui."createdAt" >= NOW() - INTERVAL '30 days'
          AND NOT (ui."userId" = ANY(${excluded}::int[]))
        GROUP BY ui."courseId"
        ORDER BY COUNT(DISTINCT ui."userId") DESC, ui."courseId" DESC
        LIMIT 50`;
    const ids = rows.map((r) => Number(r.id));
    await defaultCache.set(key, ids, 5 * 60 * 1000);
    return ids;
}

/**
 * ordered: 공개+만료 안 된 기본 목록 순서 그대로. hotIds 순으로 최대 5개,
 * 모자라면 기본 목록 첫 20개에서 pickHeroByGrade로 채움 (같은 코스 두 번 X)
 */
export function composeHotHero<T extends { id: string | number; grade?: string | null }>(ordered: T[], hotIds: number[]): T[] {
    const byId = new Map(ordered.map((c) => [Number(c.id), c]));
    const hot = hotIds.map((id) => byId.get(id)).filter((c): c is T => !!c).slice(0, 5);
    const used = new Set(hot.map((c) => Number(c.id)));
    const fill = pickHeroByGrade(ordered.slice(0, 20).filter((c) => !used.has(Number(c.id))));
    return [...hot, ...fill].slice(0, 5);
}
