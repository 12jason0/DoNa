import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// src/app/api/courses/[id]/route.ts
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let courseId: number | null = null;
    try {
        const { id } = await params;
        courseId = Number(id);

        if (!courseId || isNaN(courseId)) {
            return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
        }

        const userId = resolveUserId(request);
        let userTier = "FREE";
        let hasUnlocked = false;

        if (userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { subscriptionTier: true },
            });
            if (user?.subscriptionTier) userTier = user.subscriptionTier;

            try {
                const unlock = await (prisma as any).courseUnlock.findFirst({
                    where: { userId: userId, courseId: courseId },
                });
                hasUnlocked = !!unlock;
            } catch (e) {
                console.warn("[Auth] CourseUnlock check failed:", e);
            }
        }

        const course = await (prisma as any).course.findUnique({
            where: { id: courseId },
            select: {
                id: true,
                title: true,
                description: true,
                region: true,
                sub_title: true,
                target_situation: true,
                duration: true,
                imageUrl: true,
                concept: true,
                rating: true,
                view_count: true,
                current_participants: true,
                max_participants: true,
                isPopular: true,
                grade: true,
                createdAt: true,
                updatedAt: true,
                highlights: { select: { id: true, title: true, description: true, icon: true } },
                benefits: { select: { id: true, description: true, icon: true } },
                courseNotices: {
                    select: { id: true, notice_text: true, display_order: true },
                    orderBy: { display_order: "asc" },
                },
                courseDetail: {
                    select: { recommended_start_time: true, season: true, course_type: true, transportation: true },
                },
                coursePlaces: {
                    orderBy: { order_index: "asc" },
                    select: {
                        id: true,
                        place_id: true,
                        order_index: true,
                        estimated_duration: true,
                        recommended_time: true,
                        coaching_tip: true,
                        place: {
                            select: {
                                id: true,
                                name: true,
                                address: true,
                                description: true,
                                category: true,
                                avg_cost_range: true,
                                opening_hours: true,
                                phone: true,
                                parking_available: true,
                                reservation_required: true,
                                latitude: true,
                                longitude: true,
                                imageUrl: true,
                            },
                        },
                    },
                },
                _count: { select: { coursePlaces: true } },
            },
        });

        if (!course) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        const coursePlacesArray = Array.isArray(course.coursePlaces) ? course.coursePlaces : [];

        const placeIds = coursePlacesArray
            .map((cp: any) => cp?.place?.id)
            .filter((pid: any) => pid !== undefined && pid !== null);

        let closedDaysMap: Record<number, any[]> = {};
        if (placeIds.length > 0) {
            const closedDays = await (prisma as any).placeClosedDay.findMany({
                where: { place_id: { in: placeIds } },
            });
            closedDays.forEach((cd: any) => {
                if (!closedDaysMap[cd.place_id]) closedDaysMap[cd.place_id] = [];
                closedDaysMap[cd.place_id].push(cd);
            });
        }

        const courseGrade = course.grade || "FREE";
        const hasAccess = courseGrade === "FREE" || userTier === "PREMIUM" || userTier === "BASIC" || hasUnlocked;

        const coursePlaces = coursePlacesArray
            .map((cp: any) => {
                if (!cp || !cp.place) return null;

                // coaching_tip은 CoursePlace 레벨에만 있음
                const coachingTip = cp.coaching_tip || null;

                return {
                    id: cp.id,
                    order_index: cp.order_index,
                    estimated_duration: cp.estimated_duration,
                    recommended_time: cp.recommended_time,
                    coaching_tip: coachingTip,
                    movement_guide: null, // DB에 필드가 없으므로 null로 설정 (필요시 나중에 추가)
                    place: {
                        ...cp.place,
                        latitude: cp.place.latitude ? Number(cp.place.latitude) : null,
                        longitude: cp.place.longitude ? Number(cp.place.longitude) : null,
                        closed_days: closedDaysMap[cp.place.id] || [],
                        coaching_tip: coachingTip, // place 객체에도 coaching_tip 포함 (CoursePlace의 것을 사용)
                    },
                };
            })
            // ✅ [수정됨] 이 부분의 cp에도 : any를 추가했습니다 (Line 142)
            .filter((cp: any) => cp !== null);

        // 🟢 [수정 1] reservationRequired 계산: coursePlaces의 place들 중 하나라도 reservation_required가 true면 true
        const reservationRequired = coursePlaces.some((cp: any) => cp?.place?.reservation_required === true) || false;

        const payload = {
            id: String(course.id),
            title: course.title || "",
            description: course.description || "",
            sub_title: course.sub_title || null,
            target_situation: course.target_situation || null,
            imageUrl: course.imageUrl || "",
            concept: course.concept || "",
            rating: Number(course.rating) || 0,
            view_count: Number(course.view_count) || 0,
            isPopular: course.isPopular || false,
            grade: courseGrade,
            isLocked: !hasAccess,
            hasAccess,
            userTier,
            highlights: course.highlights || [],
            benefits: course.benefits || [],
            notices: course.courseNotices || [],
            coursePlaces,
            courseDetail: course.courseDetail || {},
            reservationRequired, // 🟢 [수정 1] 클라이언트가 기대하는 필드 추가
            createdAt: course.createdAt ? new Date(course.createdAt).toISOString() : null, // 🟢 [수정 3] 날짜 직렬화 안전화
            updatedAt: course.updatedAt ? new Date(course.updatedAt).toISOString() : null, // 🟢 [수정 3] 날짜 직렬화 안전화
        };

        return NextResponse.json(payload);
    } catch (error: any) {
        console.error("🔴 [CRITICAL API ERROR]:", {
            message: error.message,
            stack: error.stack,
            courseId: courseId ?? "unknown",
            errorName: error.name,
        });
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: error.message || "Unknown error",
                details: process.env.NODE_ENV === "development" ? error.stack : undefined,
            },
            { status: 500 }
        );
    }
}
