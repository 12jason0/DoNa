import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/me/unlock-ids
 * 유저가 열람권으로 잠금 해제한 courseId 배열 반환.
 * 미인증 시 빈 배열 반환 (401 아님).
 */
export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ ids: [] });

        const unlocks = await (prisma as any).courseUnlock.findMany({
            where: { userId },
            select: { courseId: true },
        });

        return NextResponse.json({ ids: unlocks.map((u: any) => Number(u.courseId)) });
    } catch (error) {
        captureApiError(error);
        return NextResponse.json({ ids: [] });
    }
}
