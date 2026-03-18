import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/**
 * POST /api/share/create
 * 공유용 shareId 생성. 선택 완료 코스 또는 같이 고르기 공유.
 * Body: { templateCourseId: number, selectedPlaceIds?: number[] }
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

        const shared = await prisma.sharedCourse.create({
            data: {
                templateCourseId,
                sharedByUserId: userId ? Number(userId) : undefined,
                selectedPlaceIds,
            },
        });

        return NextResponse.json({ shareId: shared.id });
    } catch (e) {

            captureApiError(e);
        console.error("[share/create]", e);
        return NextResponse.json({ error: "Failed to create share" }, { status: 500 });
    }
}
