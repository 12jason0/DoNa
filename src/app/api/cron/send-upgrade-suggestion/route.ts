import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUSH_CONCURRENCY = 5;
const MAX_ERRORS_IN_RESPONSE = 20;

/**
 * [Vercel Cron] 매일 11:00 KST 실행 (UTC 02:00)
 * 열람권을 2회 이상 구매했지만 아직 FREE 등급인 유저에게 구독 제안 푸시 발송.
 * 각 유저에게 1회만 발송 (Redis로 중복 방지).
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET || "default-secret-change-in-production";
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
        const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

        // 열람권 2회 이상 구매한 userId 추출 (JS에서 집계 — groupBy 호환성 이슈 방지)
        const allUnlocks: { userId: number }[] = await (prisma as any).courseUnlock.findMany({
            select: { userId: true },
        });

        if (allUnlocks.length === 0) {
            return NextResponse.json({ success: true, total: 0, sent: 0, errors: [] });
        }

        const countMap: Record<number, number> = {};
        for (const u of allUnlocks) {
            countMap[u.userId] = (countMap[u.userId] || 0) + 1;
        }
        const userIds = Object.entries(countMap)
            .filter(([, count]) => count >= 2)
            .map(([uid]) => Number(uid));

        // FREE 등급인 유저만 필터
        const freeUsers = await prisma.user.findMany({
            where: { id: { in: userIds }, subscriptionTier: "FREE" },
            select: { id: true, username: true },
        });

        if (freeUsers.length === 0) {
            return NextResponse.json({ success: true, total: 0, sent: 0, errors: [] });
        }

        // Redis로 이미 발송된 유저 필터 (유저당 1회)
        const targets: typeof freeUsers = [];
        for (const user of freeUsers) {
            const sentKey = `push:upgrade-suggestion:${user.id}`;
            if (redisUrl && redisToken) {
                const getRes = await fetch(`${redisUrl}/get/${sentKey}`, {
                    headers: { Authorization: `Bearer ${redisToken}` },
                });
                const getJson = await getRes.json();
                if (getJson?.result === "sent") continue; // 이미 발송
            }
            targets.push(user);
        }

        if (targets.length === 0) {
            return NextResponse.json({ success: true, total: freeUsers.length, sent: 0, errors: [], reason: "all already sent" });
        }

        let sent = 0;
        const errors: Array<{ userId: number; reason: string }> = [];

        const runChunk = async (chunk: typeof targets) => {
            const results = await Promise.all(
                chunk.map(async (user) => {
                    const title = "열람권보다 구독이 더 합리적이에요 💡";
                    const body = `이미 열람권을 2번 이상 사용하셨어요. 구독하면 모든 코스 무제한이에요`;
                    const data = { screen: "subscription", url: "/subscription" };

                    const result = await sendPushToUser(user.id, title, body, data);

                    if (result.ok && redisUrl && redisToken) {
                        // 발송 완료 기록 (영구 보존 — 유저당 1회만)
                        await fetch(`${redisUrl}/set/push:upgrade-suggestion:${user.id}/sent`, {
                            headers: { Authorization: `Bearer ${redisToken}` },
                        });
                    }

                    if (result.ok) return { sent: 1, error: null as { userId: number; reason: string } | null };
                    return { sent: 0, error: { userId: user.id, reason: result.reason ?? "알 수 없음" } };
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
        console.error("[send-upgrade-suggestion cron]", error);
        return NextResponse.json({ error: "Cron failed" }, { status: 500 });
    }
}
