import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";
import { SHARE_ACCESS_DAYS, SHARE_DAILY_LIMIT, kstDayStart, userHasCourseAccess } from "@/lib/shareAccess";

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

        const userId = await resolveUserId(request);

        // 같은 코스는 사람당 하루(KST) 5개까지. 초과 시 클라이언트는 코스 URL로 공유 계속
        // ponytail: 동시 요청 몇 개는 한도를 살짝 넘길 수 있음 — 필요해지면 advisory lock
        if (userId) {
            const todayCount = await prisma.sharedCourse.count({
                where: { sharedByUserId: userId, templateCourseId, createdAt: { gte: kstDayStart() } },
            });
            if (todayCount >= SHARE_DAILY_LIMIT) {
                return NextResponse.json({ error: "Daily share limit reached" }, { status: 429 });
            }
        }

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
