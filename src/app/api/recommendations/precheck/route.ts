import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { getRecommendationDailyLimit } from "@/constants/subscription";

export const dynamic = "force-dynamic";

type Tier = "FREE" | "BASIC" | "PREMIUM";

/**
 * GET: 채팅 열기 전 일일 추천 한도 precheck
 * AiRecommendationUsage 기준 (단일 소스)
 * FREE 1회, BASIC 5회, PREMIUM 무제한
 */
export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { subscriptionTier: true },
        });
        const t = user?.subscriptionTier?.toUpperCase?.();
        const tier: Tier = t === "BASIC" || t === "PREMIUM" ? t : "FREE";

        const limit = getRecommendationDailyLimit(tier);
        if (limit === Number.POSITIVE_INFINITY) {
            return NextResponse.json({
                canUse: true,
                tier,
                limit: null,
                used: 0,
                remaining: null,
            });
        }

        const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        const y = kst.getFullYear();
        const m = kst.getMonth();
        const d = kst.getDate();
        const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - 9 * 3600 * 1000);
        const endUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - 9 * 3600 * 1000);

        const used = await (prisma as any).aiRecommendationUsage.count({
            where: {
                userId,
                usedAt: { gte: startUtc, lte: endUtc },
            },
        });

        const remaining = Math.max(0, limit - used);
        const canUse = used < limit;

        return NextResponse.json({
            canUse,
            tier,
            limit,
            used,
            remaining: canUse ? remaining : 0,
        });
    } catch (err) {
        console.error("[precheck] 오류:", err);
        return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
    }
}
