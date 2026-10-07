import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { getExcludedStatsUserIds } from "@/lib/statsExclude";
import { signupChannel } from "@/lib/signupAttribution";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/** GET /api/admin/stats/metrics?days=7|30 — 핵심 숫자 한 화면용 (테스트 계정 제외) */
export async function GET(request: NextRequest) {
    if (!verifyAdminJwt(request)) return NextResponse.json({ error: "ADMIN_ONLY" }, { status: 401 });
    try {
        const days = request.nextUrl.searchParams.get("days") === "30" ? 30 : 7;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const excluded = await getExcludedStatsUserIds(prisma);
        const notExcluded = excluded.length > 0 ? { notIn: excluded } : undefined;
        const ex = excluded.length > 0 ? excluded : [-1];

        const [signupRows, activeRows, aiRecommendations, courseStarts, completions, memories, shares] =
            await Promise.all([
                prisma.user.findMany({
                    where: { createdAt: { gte: since }, id: notExcluded },
                    select: { signupUtmSource: true, signupReferrer: true, signupLanding: true },
                }),
                // 활동 사용자: 코스 보기·저장·시작 등 행동, 로그인, AI 추천 중 하나라도 한 사람
                prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
                    SELECT COUNT(DISTINCT uid) AS count FROM (
                        SELECT "userId" AS uid FROM user_interactions WHERE "createdAt" >= ${since}
                        UNION SELECT user_id FROM login_logs WHERE login_at >= ${since}
                        UNION SELECT user_id FROM ai_recommendation_usages WHERE used_at >= ${since}
                    ) t WHERE uid NOT IN (${Prisma.join(ex)})`),
                prisma.aiRecommendationUsage.count({ where: { usedAt: { gte: since }, userId: notExcluded } }),
                // 코스 확정 = 코스 시작(진행 중 코스로 설정)
                prisma.userInteraction.count({
                    where: { action: "start", createdAt: { gte: since }, userId: notExcluded },
                }),
                prisma.completedCourse.count({ where: { completedAt: { gte: since }, userId: notExcluded } }),
                prisma.review.count({ where: { isPublic: false, createdAt: { gte: since }, userId: notExcluded } }),
                prisma.sharedCourse.count({
                    where: {
                        createdAt: { gte: since },
                        ...(excluded.length > 0
                            ? { OR: [{ sharedByUserId: null }, { sharedByUserId: { notIn: excluded } }] }
                            : {}),
                    },
                }),
            ]);

        const byChannel = new Map<string, number>();
        for (const u of signupRows) {
            const ch = signupChannel(u);
            byChannel.set(ch, (byChannel.get(ch) ?? 0) + 1);
        }

        return NextResponse.json({
            days,
            since,
            signups: signupRows.length,
            activeUsers: Number(activeRows[0]?.count ?? 0),
            aiRecommendations,
            courseStarts,
            completions,
            memories,
            shares,
            signupsByChannel: [...byChannel].map(([channel, count]) => ({ channel, count })).sort((a, b) => b.count - a.count),
        });
    } catch (error) {
        captureApiError(error);
        console.error("[admin metrics]", error);
        return NextResponse.json({ error: "집계 실패" }, { status: 500 });
    }
}
