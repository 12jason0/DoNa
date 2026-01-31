import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { getMemoryLimit } from "@/constants/subscription";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/me/memory-count
 * 나만의 추억(개인 리뷰) 개수와 등급별 한도 반환. 클릭 시 한도 체크용.
 */
export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { subscriptionTier: true },
        });
        const tier = (user?.subscriptionTier ?? "FREE") as string;
        const limit = getMemoryLimit(tier);

        const count = await (prisma as any).review.count({
            where: { userId, isPublic: false },
        });

        return NextResponse.json({
            count,
            limit: Number.isFinite(limit) ? limit : null,
            tier,
        });
    } catch (error) {
        console.error("[memory-count]", error);
        return NextResponse.json({ error: "Failed to get memory count" }, { status: 500 });
    }
}
