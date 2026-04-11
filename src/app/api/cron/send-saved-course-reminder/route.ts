import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { getKSTTodayRange } from "@/lib/kst";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUSH_CONCURRENCY = 5;
const MAX_ERRORS_IN_RESPONSE = 20;

/**
 * [Vercel Cron] 매일 10:00 KST 실행 (UTC 01:00)
 * 코스를 저장(찜)한 지 정확히 7일 됐고, 해당 코스를 한 번도 시작하지 않은 유저에게 리마인더 발송
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET || "default-secret-change-in-production";
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 멱등성: 같은 날 중복 실행 방지
        const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
        const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
        const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const idempotencyKey = `cron:saved-course-reminder:${todayKST}`;

        if (redisUrl && redisToken) {
            const getRes = await fetch(`${redisUrl}/get/${idempotencyKey}`, {
                headers: { Authorization: `Bearer ${redisToken}` },
            });
            const getJson = await getRes.json();
            if (getJson?.result === "done") {
                return NextResponse.json({ success: true, skipped: true, reason: "already sent today" });
            }
            await fetch(`${redisUrl}/set/${idempotencyKey}/done/ex/90000`, {
                headers: { Authorization: `Bearer ${redisToken}` },
            });
        }

        // 7일 전 KST 날짜 범위 계산
        const { start: todayStart } = getKSTTodayRange();
        const sevenDaysAgoStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
        const sevenDaysAgoEnd = new Date(sevenDaysAgoStart.getTime() + 24 * 60 * 60 * 1000);

        // 7일 전에 저장한 찜 목록 조회
        const favorites = await prisma.userFavorite.findMany({
            where: {
                created_at: { gte: sevenDaysAgoStart, lt: sevenDaysAgoEnd },
            },
            include: {
                course: { select: { id: true, title: true } },
                user: { select: { id: true, username: true } },
            },
        });

        if (favorites.length === 0) {
            return NextResponse.json({ success: true, total: 0, sent: 0, errors: [] });
        }

        // 해당 유저들의 ActiveCourse 조회 (코스 시작 여부 확인)
        const userIds = favorites.map((f) => f.user_id);
        const activeCourses = await prisma.activeCourse.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, courseId: true },
        });
        const activeSet = new Set(activeCourses.map((a) => `${a.userId}:${a.courseId}`));

        // 해당 코스를 한 번도 시작하지 않은 유저만 필터
        const targets = favorites.filter((f) => !activeSet.has(`${f.user_id}:${f.course_id}`));

        if (targets.length === 0) {
            return NextResponse.json({ success: true, total: favorites.length, sent: 0, errors: [] });
        }

        let sent = 0;
        const errors: Array<{ userId: number; reason: string }> = [];

        const runChunk = async (chunk: typeof targets) => {
            const results = await Promise.all(
                chunk.map(async (f) => {
                    const userName = f.user?.username?.trim() || "";
                    const courseName = f.course?.title || "코스";
                    const title = "저장해두고 잊은 거 아니죠?";
                    const body = userName
                        ? `${courseName}이 아직도 ${userName}님 기다리고 있어요`
                        : `${courseName}이 아직도 기다리고 있어요`;
                    const data = {
                        screen: "course_detail",
                        courseId: String(f.course_id),
                        url: `/courses/${f.course_id}`,
                    };

                    const result = await sendPushToUser(f.user_id, title, body, data);
                    if (result.ok) return { sent: 1, error: null as { userId: number; reason: string } | null };
                    return { sent: 0, error: { userId: f.user_id, reason: result.reason ?? "알 수 없음" } };
                }),
            );
            return {
                sent: results.reduce((s, r) => s + r.sent, 0),
                errors: results.map((r) => r.error).filter((e): e is { userId: number; reason: string } => e !== null),
            };
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
            total: targets.length,
            sent,
            errors: errors.slice(0, MAX_ERRORS_IN_RESPONSE),
        });
    } catch (error) {
        captureApiError(error);
        console.error("[saved-course-reminder cron]", error);
        return NextResponse.json({ error: "Cron failed" }, { status: 500 });
    }
}
