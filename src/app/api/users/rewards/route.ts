import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
        if (!Number.isFinite(userId)) return NextResponse.json({ success: false, error: "BAD_USER" }, { status: 400 });

        const rewards = await prisma.userReward.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 100,
        });

        // 🟢 디버깅: 보상 내역 로깅
        console.log("[보상 내역 API] userId:", userId, "보상 개수:", rewards.length);
        rewards.forEach((r) => {
            console.log("[보상 내역 API] 보상:", { id: r.id, type: r.type, amount: r.amount, createdAt: r.createdAt });
        });

        return NextResponse.json({ success: true, rewards });
    } catch (e) {
        console.error("[보상 내역 API] 에러:", e);
        return NextResponse.json({ success: false, error: "SERVER_ERROR" }, { status: 500 });
    }
}
