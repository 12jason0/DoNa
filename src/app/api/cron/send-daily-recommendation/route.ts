import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUSH_CONCURRENCY = 5;
const MAX_ERRORS_IN_RESPONSE = 20;

/**
 * [Vercel Cron] 매일 12:10 KST 실행 (UTC 03:10)
 * 푸시 알림 수신 동의한 모든 유저에게 오늘의 추천 알림 발송
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET || "default-secret-change-in-production";
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 멱등성 처리: 같은 날 이미 실행된 경우 중복 발송 방지 (Vercel Cron 이중 실행 대응)
        const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
        const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
        const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const idempotencyKey = `cron:daily-rec:${todayKST}`;

        if (redisUrl && redisToken) {
            const getRes = await fetch(`${redisUrl}/get/${idempotencyKey}`, {
                headers: { Authorization: `Bearer ${redisToken}` },
            });
            const getJson = await getRes.json();
            if (getJson?.result === "done") {
                return NextResponse.json({ success: true, skipped: true, reason: "already sent today" });
            }
            // 실행 전 선점 (TTL 25시간 = 90000초)
            await fetch(`${redisUrl}/set/${idempotencyKey}/done/ex/90000`, {
                headers: { Authorization: `Bearer ${redisToken}` },
            });
        }

        // 푸시 토큰 등록 + 알림 수신 동의한 유저 전체
        const tokens = await prisma.pushToken.findMany({
            where: { subscribed: true },
            select: { userId: true, user: { select: { username: true } } },
        });

        if (tokens.length === 0) {
            return NextResponse.json({ success: true, total: 0, sent: 0, errors: [] });
        }

        const data = {
            screen: "home",
            url: "/",
        };

        let sent = 0;
        const errors: Array<{ userId: number; reason: string }> = [];

        const runChunk = async (chunk: typeof tokens) => {
            const results = await Promise.all(
                chunk.map(async ({ userId, user }) => {
                    const userName = user?.username?.trim() || "";
                    const title = "오늘 오후 데이트 어때요?";
                    const body = userName
                        ? `${userName}님에게 딱 맞는 코스 골라뒀어요 💚`
                        : "딱 맞는 코스 골라뒀어요 💚";
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
