import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// 🟢 사용자의 알림 관심사 목록 조회
export async function GET(req: NextRequest) {
    try {
        const userId = resolveUserId(req);
        if (!userId) {
            return NextResponse.json({ error: "인증 실패" }, { status: 401 });
        }

        const interests = await (prisma as any).notificationInterest.findMany({
            where: { userId },
            select: {
                id: true,
                topic: true,
                createdAt: true,
            },
        });

        return NextResponse.json({ interests });
    } catch (error) {

            captureApiError(error);
        console.error("알림 관심사 조회 실패:", error);
        return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }
}
