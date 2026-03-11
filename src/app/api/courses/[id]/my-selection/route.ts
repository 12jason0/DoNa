import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/courses/[id]/my-selection
 * 현재 유저의 이 코스(템플릿)에 대한 선택 조합 1개 반환.
 * ActiveCourse에 연결된 것 우선, 없으면 최신 1개.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const { id } = await params;
        const templateCourseId = parseInt(id, 10);
        if (!Number.isFinite(templateCourseId) || templateCourseId <= 0) {
            return NextResponse.json({ error: "Invalid course id" }, { status: 400 });
        }

        const userIdNum = Number(userId);

        // ActiveCourse에 이 템플릿+선택이 연결돼 있는지 확인
        const active = await prisma.activeCourse.findUnique({
            where: { userId: userIdNum },
            include: {
                userCourseSelection: true,
            },
        });

        if (active?.userCourseSelection?.templateCourseId === templateCourseId) {
            return NextResponse.json({
                selection: {
                    id: active.userCourseSelection.id,
                    templateCourseId: active.userCourseSelection.templateCourseId,
                    selectedPlaceIds: active.userCourseSelection.selectedPlaceIds,
                    createdAt: active.userCourseSelection.createdAt,
                },
            });
        }

        // 없으면 이 템플릿에 대한 최신 UserCourseSelection 1개
        const latest = await prisma.userCourseSelection.findFirst({
            where: {
                userId: userIdNum,
                templateCourseId,
            },
            orderBy: { createdAt: "desc" },
        });

        if (!latest) {
            return NextResponse.json({ selection: null });
        }

        return NextResponse.json({
            selection: {
                id: latest.id,
                templateCourseId: latest.templateCourseId,
                selectedPlaceIds: latest.selectedPlaceIds,
                createdAt: latest.createdAt,
            },
        });
    } catch (e) {
        console.error("[my-selection GET]", e);
        return NextResponse.json({ error: "Failed to get selection" }, { status: 500 });
    }
}

/**
 * POST /api/courses/[id]/my-selection
 * Body: { selectedPlaceIds: number[] }
 * 선택 저장(없으면 생성, 있으면 업데이트) 후 ActiveCourse를 이 선택으로 설정.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const { id } = await params;
        const templateCourseId = parseInt(id, 10);
        if (!Number.isFinite(templateCourseId) || templateCourseId <= 0) {
            return NextResponse.json({ error: "Invalid course id" }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        const selectedPlaceIds = Array.isArray(body?.selectedPlaceIds)
            ? body.selectedPlaceIds.map((x: unknown) => Number(x)).filter(Number.isFinite)
            : [];
        if (selectedPlaceIds.length === 0) {
            return NextResponse.json({ error: "selectedPlaceIds required (non-empty array)" }, { status: 400 });
        }

        const userIdNum = Number(userId);

        const existing = await prisma.userCourseSelection.findFirst({
            where: {
                userId: userIdNum,
                templateCourseId,
            },
            orderBy: { createdAt: "desc" },
        });

        let selectionId: string;
        if (existing) {
            await prisma.userCourseSelection.update({
                where: { id: existing.id },
                data: { selectedPlaceIds },
            });
            selectionId = existing.id;
        } else {
            const created = await prisma.userCourseSelection.create({
                data: {
                    userId: userIdNum,
                    templateCourseId,
                    selectedPlaceIds,
                },
            });
            selectionId = created.id;
        }

        // ActiveCourse: 이 선택으로 설정 (courseId는 템플릿으로 유지해 두어 표시용)
        const activeExisting = await prisma.activeCourse.findUnique({
            where: { userId: userIdNum },
        });

        if (!activeExisting) {
            await prisma.activeCourse.create({
                data: {
                    userId: userIdNum,
                    courseId: templateCourseId,
                    userCourseSelectionId: selectionId,
                },
            });
        } else {
            await prisma.activeCourse.update({
                where: { userId: userIdNum },
                data: {
                    courseId: templateCourseId,
                    userCourseSelectionId: selectionId,
                    startedAt: new Date(),
                },
            });
        }

        await (prisma as any).userInteraction.create({
            data: { userId: userIdNum, courseId: templateCourseId, action: "start" },
        });

        return NextResponse.json({
            success: true,
            selection: {
                id: selectionId,
                templateCourseId,
                selectedPlaceIds,
            },
        });
    } catch (e) {
        console.error("[my-selection POST]", e);
        return NextResponse.json({ error: "Failed to save selection" }, { status: 500 });
    }
}
