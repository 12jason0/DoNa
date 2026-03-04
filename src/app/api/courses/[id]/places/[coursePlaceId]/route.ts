import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 인증: 유저 JWT 또는 관리자(admin_auth) 허용
function isAuthenticated(request: NextRequest): boolean {
    const userId = resolveUserId(request);
    if (userId) return true;
    const adminAuth = request.cookies.get("admin_auth")?.value === "true";
    return !!adminAuth;
}

// 코스의 장소(course_place) 수정
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; coursePlaceId: string }> }
) {
    try {
        if (!isAuthenticated(request)) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const { id: courseIdParam, coursePlaceId } = await params;
        const course_id = Number(courseIdParam);
        const course_place_id = Number(coursePlaceId);

        if (!course_id || !course_place_id || isNaN(course_id) || isNaN(course_place_id)) {
            return NextResponse.json({ error: "Invalid course ID or course place ID" }, { status: 400 });
        }

        const body = await request.json();
        const { order_index, segment, order_in_segment, estimated_duration, recommended_time, coaching_tip, coaching_tip_free } = body || {};

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
                ...(coaching_tip !== undefined ? { coaching_tip: coaching_tip || null } : {}),
                ...(coaching_tip_free !== undefined ? { coaching_tip_free: coaching_tip_free ?? null } : {}),
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
    { params }: { params: Promise<{ id: string; coursePlaceId: string }> }
) {
    try {
        if (!isAuthenticated(request)) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const { id: courseIdParam, coursePlaceId } = await params;
        const course_id = Number(courseIdParam);
        const course_place_id = Number(coursePlaceId);

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
