import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";
import { sendPushToUser } from "@/lib/push";

function ensureAdmin(req: NextRequest) {
    if (!verifyAdminJwt(req)) throw new Error("ADMIN_ONLY");
}

const ALLOWED_STATUS = new Set(["PENDING", "PUBLISHED", "REJECTED"]);

const SUGGESTION_SELECT = {
    id: true,
    placeName: true,
    placeAddress: true,
    description: true,
    concept: true,
    imageUrl: true,
    status: true,
    createdAt: true,
    course: { select: { id: true, title: true } },
    user: { select: { id: true, nickname: true, email: true } },
} as const;

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        ensureAdmin(req);
        const { id: rawId } = await params;
        const id = Number(rawId);
        if (!Number.isFinite(id) || id <= 0) {
            return NextResponse.json({ error: "유효하지 않은 제보 ID입니다." }, { status: 400 });
        }

        const body = await req.json();
        const data: Record<string, unknown> = {};

        if (typeof body?.placeAddress === "string" || body?.placeAddress === null) {
            data.placeAddress = typeof body.placeAddress === "string" ? body.placeAddress.trim() || null : null;
        }
        if (typeof body?.description === "string" || body?.description === null) {
            data.description = typeof body.description === "string" ? body.description.trim() || null : null;
        }
        if (typeof body?.concept === "string" || body?.concept === null) {
            data.concept = typeof body.concept === "string" ? body.concept.trim() || null : null;
        }
        if (typeof body?.imageUrl === "string" || body?.imageUrl === null) {
            data.imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null;
        }
        if (typeof body?.status === "string") {
            if (!ALLOWED_STATUS.has(body.status)) {
                return NextResponse.json({ error: "유효하지 않은 상태값입니다." }, { status: 400 });
            }
            data.status = body.status;
        }
        if (body?.courseId === null || body?.courseId === "") {
            data.courseId = null;
        } else if (typeof body?.courseId === "number" || typeof body?.courseId === "string") {
            const courseId = Number(body.courseId);
            if (!Number.isFinite(courseId) || courseId <= 0) {
                return NextResponse.json({ error: "유효하지 않은 코스 ID입니다." }, { status: 400 });
            }
            data.courseId = courseId;
        }

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: "수정할 값이 없습니다." }, { status: 400 });
        }

        // PUBLISHED로 변경 시 courses 테이블에 자동 등록
        if (data.status === "PUBLISHED") {
            const current = await (prisma as any).courseSuggestion.findUnique({
                where: { id },
                select: {
                    id: true,
                    placeName: true,
                    placeAddress: true,
                    description: true,
                    concept: true,
                    imageUrl: true,
                    courseId: true,
                },
            });

            if (!current) {
                return NextResponse.json({ error: "제보를 찾을 수 없습니다." }, { status: 404 });
            }

            // 아직 courses에 등록되지 않은 경우에만 생성
            if (!current.courseId && !data.courseId) {
                const newCourse = await (prisma as any).course.create({
                    data: {
                        title: current.placeName,
                        description: (data.description as string | null) ?? current.description ?? null,
                        imageUrl: (data.imageUrl as string | null) ?? current.imageUrl ?? null,
                        concept: (data.concept as string | null) ?? current.concept ?? null,
                        isPublic: false, // 관리자가 코스 상세 채운 뒤 직접 공개
                    },
                    select: { id: true },
                });
                data.courseId = newCourse.id;
            }
        }

        const suggestion = await (prisma as any).courseSuggestion.update({
            where: { id },
            data,
            select: { ...SUGGESTION_SELECT, userId: true },
        });

        // PUBLISHED로 바뀐 경우 해당 유저에게 알림
        if (data.status === "PUBLISHED") {
            sendPushToUser(
                suggestion.userId,
                "제보하신 장소가 코스로 등록됐어요! 🎉",
                `${suggestion.placeName} 장소가 DoNa 코스로 만들어졌어요. 지금 확인해보세요!`,
                { screen: "home", url: "/" },
            ).catch(() => {});
        }

        return NextResponse.json({ ok: true, suggestion });
    } catch (error: any) {
        captureApiError(error);
        if (error.message === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
        }
        console.error("/api/admin/course-suggestions/[id] PATCH error:", error);
        return NextResponse.json({ error: "제보 수정 실패" }, { status: 500 });
    }
}
