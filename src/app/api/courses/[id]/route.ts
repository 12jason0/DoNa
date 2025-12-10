// src/app/api/courses/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const courseId = Number(id);

        if (!courseId || isNaN(courseId)) {
            return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
        }

        // 조회수 증가 (실패해도 무시)
        try {
            await prisma.course.update({
                where: { id: courseId },
                data: { view_count: { increment: 1 } },
            });
        } catch (e) {
            console.warn("View count increment failed for course", courseId, e);
        }

        const course = await (prisma as any).course.findUnique({
            where: { id: courseId },
            include: {
                highlights: true,
                benefits: true,
                courseNotices: true,
                courseDetail: true,
                coursePlaces: {
                    include: {
                        place: {
                            include: {
                                closed_days: true,
                            },
                        },
                    },
                    orderBy: { order_index: "asc" },
                },
                _count: { select: { coursePlaces: true } },
            },
        });

        if (!course) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        // 기본 course 정보 가공
        const formattedCourse = {
            id: String(course.id),
            title: course.title || "",
            description: course.description || "",
            duration: course.duration || "",

            // ✅ [수정됨] region이 있으면 그대로 쓰고, 없으면 null (프론트에서 처리)
            region: course.region || null,

            // ✅ [추가됨] Hero Section용 데이터
            sub_title: course.sub_title || null,
            target_situation: course.target_situation || null,

            imageUrl: course.imageUrl || "",
            concept: course.concept || "",
            rating: Number(course.rating) || 0,
            view_count: course.view_count || 0,
            reviewCount: 0,
            participants: course.current_participants || 0,
            maxParticipants: course.max_participants || 10,
            isPopular: (course.current_participants || 0) > 5 || course.isPopular, // isPopular 플래그도 반영
            recommended_start_time: (course as any).courseDetail?.recommended_start_time || "오후 2시-6시",
            season: (course as any).courseDetail?.season || "사계절",
            courseType: (course as any).courseDetail?.course_type || "데이트",
            transportation: (course as any).courseDetail?.transportation || "도보",
            reservationRequired: course.reservationRequired || false,
            placeCount: course._count?.coursePlaces ?? (course.coursePlaces?.length || 0),
            createdAt: course.createdAt,
            updatedAt: course.updatedAt,
        };

        // 코스 장소 가공
        const coursePlaces = (course.coursePlaces as any[]).map((cp: any) => ({
            id: cp.id,
            course_id: cp.course_id,
            place_id: cp.place_id,
            order_index: cp.order_index,
            estimated_duration: cp.estimated_duration,
            recommended_time: cp.recommended_time,
            notes: cp.notes,

            // ✅ [추가됨] 스토리텔링용 3대장 데이터 매핑
            role_badge: cp.role_badge || null,
            coaching_tip: cp.coaching_tip || null,

            place: cp.place
                ? {
                      id: cp.place.id,
                      name: cp.place.name,
                      address: cp.place.address,
                      description: cp.place.description,
                      category: cp.place.category,
                      avg_cost_range: cp.place.avg_cost_range,
                      opening_hours: cp.place.opening_hours,
                      phone: cp.place.phone,
                      parking_available: !!cp.place.parking_available,
                      reservation_required: !!cp.place.reservation_required,
                      latitude: cp.place.latitude ? Number(cp.place.latitude) : null,
                      longitude: cp.place.longitude ? Number(cp.place.longitude) : null,
                      imageUrl: cp.place.imageUrl?.trim() ? cp.place.imageUrl : "",
                      closed_days: (cp.place as any).closed_days || [],
                  }
                : null,
        }));

        const payload = {
            ...formattedCourse,
            highlights: course.highlights || [],
            benefits: course.benefits || [],
            notices: course.courseNotices || [],
            coursePlaces,
        };

        return NextResponse.json(payload);
    } catch (error) {
        console.error("API Error fetching course:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch course",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const userIdStr = getUserIdFromRequest(request);
        if (!userIdStr) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const courseId = Number(params.id);
        if (!courseId || isNaN(courseId)) {
            return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
        }

        const body = await request.json();
        const { title, description, duration, location, imageUrl, concept } = body || {};

        const updated = await prisma.course.update({
            where: { id: courseId },
            data: {
                ...(title !== undefined ? { title } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(duration !== undefined ? { duration } : {}),
                ...(location !== undefined ? { region: location } : {}),
                ...(imageUrl !== undefined ? { imageUrl } : {}),
                ...(concept !== undefined ? { concept } : {}),
            },
            select: {
                id: true,
                title: true,
                description: true,
                duration: true,
                region: true,
                imageUrl: true,
                concept: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({ success: true, course: updated });
    } catch (error) {
        console.error("API: 코스 수정 오류:", error);
        return NextResponse.json({ error: "코스 수정 실패" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const userIdStr = getUserIdFromRequest(request);
        if (!userIdStr) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const courseId = Number(params.id);
        if (!courseId || isNaN(courseId)) {
            return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
        }

        await prisma.course.delete({ where: { id: courseId } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("API: 코스 삭제 오류:", error);
        return NextResponse.json({ error: "코스 삭제 실패" }, { status: 500 });
    }
}
