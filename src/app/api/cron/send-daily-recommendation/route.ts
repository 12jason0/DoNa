import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUSH_CONCURRENCY = 5;
const MAX_ERRORS_IN_RESPONSE = 20;

/**
 * [Vercel Cron] 매일 11:30 KST 실행 (UTC 02:30)
 * 푸시 알림 수신 동의한 모든 유저에게 오늘의 추천 알림 발송
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET || "default-secret-change-in-production";
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 푸시 토큰 등록 + 알림 수신 동의한 유저 전체
        const tokens = await prisma.pushToken.findMany({
            where: { subscribed: true },
            select: { userId: true },
        });

        if (tokens.length === 0) {
            return NextResponse.json({ success: true, total: 0, sent: 0, errors: [] });
        }

        const title = "오늘의 데이트 추천";
        const body = "오늘은 어떤 데이트를 추천해줄까요? 지금 바로 확인해보세요 💚";
        const data = {
            screen: "personalized_home",
            url: "/ai",
        };

        let sent = 0;
        const errors: Array<{ userId: number; reason: string }> = [];

        const runChunk = async (chunk: typeof tokens) => {
            const results = await Promise.all(
                chunk.map(async ({ userId }) => {
                    const result = await sendPushToUser(userId, title, body, data);
                    if (result.ok) return { sent: 1, error: null as { userId: number; reason: string } | null };
                    return { sent: 0, error: { userId, reason: result.reason ?? "알 수 없음" } };
                }),
            );
            return {
                sent: results.reduce((s, r) => s + r.sent, 0),
                errors: results.map((r) => r.error).filter((e): e is { userId: number; reason: string } => e !== null),
            };
        };

        for (let i = 0; i < tokens.length; i += PUSH_CONCURRENCY) {
            const chunk = tokens.slice(i, i + PUSH_CONCURRENCY);
            const { sent: chunkSent, errors: chunkErrors } = await runChunk(chunk);
            sent += chunkSent;
            for (const e of chunkErrors) {
                errors.push(e);
                if (errors.length >= MAX_ERRORS_IN_RESPONSE) break;
            }
        }

        return NextResponse.json({
            success: true,
            total: tokens.length,
            sent,
            errors: errors.slice(0, MAX_ERRORS_IN_RESPONSE),
        });
    } catch (error) {
        captureApiError(error);
        console.error("[daily-recommendation cron]", error);
        return NextResponse.json({ error: "Cron failed" }, { status: 500 });
    }
}
