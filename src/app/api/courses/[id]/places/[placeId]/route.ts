import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId, verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// 인증: 유저 JWT 또는 관리자(admin_auth) 허용
function isAuthenticated(request: NextRequest): boolean {
    if (resolveUserId(request)) return true;
    return verifyAdminJwt(request);
}

type RouteParams = { id: string; placeId: string };

// GET: 라우트 도달 여부 확인용 (인증 없이 200 + { ok: true })
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<RouteParams> }
) {
    const { id: courseIdParam, placeId } = await params;
    const course_id = Number(courseIdParam);
    const course_place_id = Number(placeId);
    if (!course_id || !course_place_id || isNaN(course_id) || isNaN(course_place_id)) {
        return NextResponse.json({ error: "Invalid course ID or place ID" }, { status: 400 });
    }
    const existing = await (prisma as any).coursePlace.findFirst({
        where: { id: course_place_id, course_id: course_id },
    });
    if (!existing) {
        return NextResponse.json({ error: "Course place not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, course_place: existing });
}

// 코스의 장소(course_place) 수정
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<RouteParams> }
) {
    try {
        if (!isAuthenticated(request)) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const { id: courseIdParam, placeId } = await params;
        const course_id = Number(courseIdParam);
        const course_place_id = Number(placeId);

        if (!course_id || !course_place_id || isNaN(course_id) || isNaN(course_place_id)) {
            return NextResponse.json({ error: "Invalid course ID or course place ID" }, { status: 400 });
        }

        const body = await request.json();
        const { order_index, segment, order_in_segment, estimated_duration, recommended_time, tips } = body || {};

        // course_place가 해당 course에 속하는지 확인
        const existing = await (prisma as any).coursePlace.findFirst({
            where: {
                id: course_place_id,
                course_id: course_id,
            },
        });

        if (!existing) {
            return NextResponse.json({ error: "Course place not found" }, { status: 404 });
        }

        // 수정
        const updated = await (prisma as any).coursePlace.update({
            where: { id: course_place_id },
            data: {
                ...(order_index !== undefined ? { order_index: Number(order_index) } : {}),
                ...(segment !== undefined ? { segment: segment && String(segment).trim() ? String(segment).trim() : null } : {}),
                ...(order_in_segment !== undefined ? { order_in_segment: order_in_segment === null || order_in_segment === "" ? null : Number(order_in_segment) } : {}),
                ...(estimated_duration !== undefined
                    ? { estimated_duration: typeof estimated_duration === "number" ? estimated_duration : null }
                    : {}),
                ...(recommended_time !== undefined ? { recommended_time: recommended_time || null } : {}),
                ...(tips !== undefined ? { tips: tips && String(tips).trim() ? String(tips).trim() : null } : {}),
            },
            include: {
                place: {
                    select: {
                        id: true,
                        name: true,
                        category: true,
                    },
                },
            },
        });

        return NextResponse.json({ success: true, course_place: updated });
    } catch (error) {

            captureApiError(error);
        console.error("API: 코스-장소 연결 수정 오류:", error);
        console.error("API: 에러 상세:", {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : "No stack trace",
        });
        return NextResponse.json(
            {
                error: "코스-장소 연결 수정 실패",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

// 코스의 장소(course_place) 삭제
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<RouteParams> }
) {
    try {
        if (!isAuthenticated(request)) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const { id: courseIdParam, placeId } = await params;
        const course_id = Number(courseIdParam);
        const course_place_id = Number(placeId);

        if (!course_id || !course_place_id || isNaN(course_id) || isNaN(course_place_id)) {
            return NextResponse.json({ error: "Invalid course ID or course place ID" }, { status: 400 });
        }

        // course_place가 해당 course에 속하는지 확인
        const existing = await (prisma as any).coursePlace.findFirst({
            where: {
                id: course_place_id,
                course_id: course_id,
            },
        });

        if (!existing) {
            return NextResponse.json({ error: "Course place not found" }, { status: 404 });
        }

        // 삭제
        await (prisma as any).coursePlace.delete({
            where: { id: course_place_id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {

            captureApiError(error);
        console.error("API: 코스-장소 연결 삭제 오류:", error);
        console.error("API: 에러 상세:", {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : "No stack trace",
        });
        return NextResponse.json(
            {
                error: "코스-장소 연결 삭제 실패",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
