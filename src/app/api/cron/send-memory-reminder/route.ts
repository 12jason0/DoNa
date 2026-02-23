import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { getKSTTodayRange } from "@/lib/kst";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUSH_CONCURRENCY = 5;
const MAX_ERRORS_IN_RESPONSE = 20;

/**
 * [Vercel Cron] 매일 21:00 KST 실행
 * 오늘 데이트 시작했고, 기록 안 남긴 유저에게 푸시 발송
 * - N+1 제거: 배치 Review 조회
 * - remindedAt으로 중복 발송 방지
 * - 동시성 제한
 * - errors 응답
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET || "default-secret-change-in-production";
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { start, end } = getKSTTodayRange();

        // 1) 오늘 startedAt이고, 아직 오늘 리마인더 안 보낸 ActiveCourse 조회
        const actives = await prisma.activeCourse.findMany({
            where: {
                startedAt: { gte: start, lte: end },
                OR: [{ remindedAt: null }, { remindedAt: { lt: start } }],
            },
            include: {
                user: { select: { id: true, username: true } },
                course: { select: { id: true, title: true } },
            },
        });

        if (actives.length === 0) {
            return NextResponse.json({
                success: true,
                activesCount: 0,
                sent: 0,
                skipped: 0,
                errors: [],
            });
        }

        // 2) 배치 조회: (userId, courseId) 쌍 중 "나만의 추억" 있는 쌍
        const pairs = actives.map((a) => ({ userId: a.userId, courseId: a.courseId }));
        const withMemory = await prisma.review.findMany({
            where: {
                isPublic: false,
                OR: pairs.map((p) => ({
                    userId: p.userId,
                    courseId: p.courseId,
                })),
            },
            select: { userId: true, courseId: true },
        });
        const hasMemorySet = new Set(withMemory.map((r) => `${r.userId}:${r.courseId}`));

        // 3) 대상 필터: 추억 없는 사람만
        const targets = actives.filter((a) => !hasMemorySet.has(`${a.userId}:${a.courseId}`));

        let sent = 0;
        let skipped = actives.length - targets.length;
        const errors: Array<{ userId: number; reason: string }> = [];

        // 4) 동시성 제한으로 푸시 발송 + remindedAt 업데이트
        const runChunk = async (
            chunk: typeof targets
        ): Promise<{ sent: number; errors: Array<{ userId: number; reason: string }> }> => {
            const results = await Promise.all(
                chunk.map(async (a) => {
                    const userName = a.user?.username || "OO";
                    const title = "오늘 데이트 기록";
                    const body = `${userName}님, 오늘 데이트 어땠어요? 한 줄만 남겨볼까요?`;
                    const data = {
                        screen: "course_start",
                        courseId: String(a.courseId),
                        url: `/courses/${a.courseId}/start`,
                    };

                    const result = await sendPushToUser(a.userId, title, body, data);

                    if (result.ok) {
                        await prisma.activeCourse.update({
                            where: { id: a.id },
                            data: { remindedAt: new Date() },
                        });
                        return { sent: 1, error: null as { userId: number; reason: string } | null };
                    }
                    return {
                        sent: 0,
                        error: { userId: a.userId, reason: result.reason ?? "알 수 없음" },
                    };
                })
            );

            const sentCount = results.reduce((s, r) => s + r.sent, 0);
            const errs = results.map((r) => r.error).filter((e): e is { userId: number; reason: string } => e !== null);
            return { sent: sentCount, errors: errs };
        };

        for (let i = 0; i < targets.length; i += PUSH_CONCURRENCY) {
            const chunk = targets.slice(i, i + PUSH_CONCURRENCY);
            const { sent: chunkSent, errors: chunkErrors } = await runChunk(chunk);
            sent += chunkSent;
            for (const e of chunkErrors) {
                errors.push(e);
                if (errors.length >= MAX_ERRORS_IN_RESPONSE) break;
            }
        }

        return NextResponse.json({
            success: true,
            activesCount: actives.length,
            targetsCount: targets.length,
            sent,
            skipped,
            errors: errors.slice(0, MAX_ERRORS_IN_RESPONSE),
        });
    } catch (error) {
        console.error("[memory-reminder cron]", error);
        return NextResponse.json({ error: "Cron failed" }, { status: 500 });
    }
}
