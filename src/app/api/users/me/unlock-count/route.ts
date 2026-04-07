import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/me/unlock-count
 * 유저의 총 CourseUnlock(열람권 구매) 건수 반환.
 * 단건 → 구독 전환 트리거에 사용.
 */
export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const count = await (prisma as any).courseUnlock.count({
            where: { userId },
        });

        return NextResponse.json({ count });
    } catch (error) {
        captureApiError(error);
        console.error("[unlock-count]", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
