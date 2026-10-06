import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";
import { SHARE_ACCESS_DAYS, userHasCourseAccess } from "@/lib/shareAccess";

export const dynamic = "force-dynamic";

/**
 * POST /api/share/create
 * 공유용 shareId 생성. 선택 완료 코스 또는 같이 고르기 공유.
 * Body: { templateCourseId: number, selectedPlaceIds?: number[] }
 * - 공유자가 지금 열람 권한이 있으면 링크 자체에 열람권(생성 시점부터 3일)을 붙임
 * - 다시 공유하면 항상 새 링크·새 3일 (예전 링크 기간은 그대로)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const templateCourseId = Number(body?.templateCourseId);
        const selectedPlaceIds = Array.isArray(body?.selectedPlaceIds)
            ? body.selectedPlaceIds.map((x: unknown) => Number(x)).filter(Number.isFinite)
            : [];

        if (!templateCourseId || !Number.isFinite(templateCourseId)) {
            return NextResponse.json({ error: "templateCourseId required" }, { status: 400 });
        }

        const userId = resolveUserId(request);
        const sharerHasAccess = await userHasCourseAccess(userId, templateCourseId);

        const shared = await prisma.sharedCourse.create({
            data: {
                templateCourseId,
                sharedByUserId: userId ? Number(userId) : undefined,
                selectedPlaceIds,
                sharerHasAccess,
                expiresAt: sharerHasAccess ? new Date(Date.now() + SHARE_ACCESS_DAYS * 86400_000) : null,
            },
        });

        return NextResponse.json({ shareId: shared.id });
    } catch (e) {

            captureApiError(e);
        console.error("[share/create]", e);
        return NextResponse.json({ error: "Failed to create share" }, { status: 500 });
    }
}
