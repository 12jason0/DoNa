// src/app/api/courses/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth"; // 🟢 resolveUserId 사용 (쿠키도 확인)

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const courseId = Number(id);

        if (!courseId || isNaN(courseId)) {
            return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
        }

        // ✅ [최적화] 조회수 증가는 별도 엔드포인트(/api/courses/[id]/view)에서 처리하므로 여기서는 제거
        // 조회수는 CourseDetailClient에서 페이지 진입 시 한 번만 증가시키도록 변경
        // try {
        //     await prisma.course.update({
        //         where: { id: courseId },
        //         data: { view_count: { increment: 1 } },
        //     });
        // } catch (e) {
        //     console.warn("View count increment failed for course", courseId, e);
        // }

        // 🟢 [수정] resolveUserId 사용: Authorization 헤더 + 쿠키 모두 확인
        const userId = resolveUserId(request);
        let userTier = "FREE";
        let hasUnlocked = false;

        if (userId) {
            // 유저 등급 정보 조회
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { subscriptionTier: true },
            });
            if (user?.subscriptionTier) {
                userTier = user.subscriptionTier;
            }

            // 🟢 [핵심] DB에 있는 구매 내역(CourseUnlock)을 다시 확인
            const unlock = await (prisma as any).courseUnlock.findFirst({
                where: {
                    userId: userId,
                    courseId: courseId,
                },
            });
            hasUnlocked = !!unlock;

            // 디버깅용 로그 (개발 환경에서만)
            if (process.env.NODE_ENV === "development") {
                console.log(
                    `[Course ${courseId}] User ${userId}: hasUnlocked=${hasUnlocked}, userTier=${userTier}, unlock record:`,
                    unlock
                );
            }
        } else {
            // 디버깅용 로그
            if (process.env.NODE_ENV === "development") {
                console.log(
                    `[Course ${courseId}] No user ID found. Auth header:`,
                    request.headers.get("authorization"),
                    "Cookie:",
                    request.cookies.get("auth")?.value ? "exists" : "none"
                );
            }
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

        // 🟢 권한 판별: FREE 코스이거나, PREMIUM/BASIC 등급이거나, 개별 구매 기록이 있으면 접근 가능
        const courseGrade = course.grade || "FREE";
        const hasAccess = courseGrade === "FREE" || userTier === "PREMIUM" || userTier === "BASIC" || hasUnlocked;
        const isLocked = !hasAccess;

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
            // 🟢 권한 정보 추가
            grade: courseGrade,
            isLocked,
            hasAccess,
            userTier,
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userId = resolveUserId(request);
        const userIdStr = userId ? String(userId) : null;
        if (!userIdStr) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const { id } = await params;
        const courseId = Number(id);
        if (!courseId || isNaN(courseId)) {
            return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
        }

        // [권한 검증] 코스 소유자 확인 (관리자는 제외)
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            select: { userId: true },
        });

        if (!course) {
            return NextResponse.json({ error: "코스를 찾을 수 없습니다." }, { status: 404 });
        }

        // 코스 소유자가 아니면 수정 불가 (관리자 체크는 추후 추가 가능)
        if (course.userId && course.userId !== Number(userIdStr)) {
            return NextResponse.json({ error: "코스를 수정할 권한이 없습니다." }, { status: 403 });
        }

        const body = await request.json().catch(() => {
            return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
        });

        if (body instanceof NextResponse) {
            return body;
        }
        const {
            title,
            description,
            duration,
            location,
            imageUrl,
            concept,
            sub_title,
            target_situation,
            is_editor_pick,
            grade,
            isPublic, // [추가]
            tags, // [추가]
        } = body || {};

        const updated = await prisma.course.update({
            where: { id: courseId },
            data: {
                ...(title !== undefined ? { title } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(duration !== undefined ? { duration } : {}),
                ...(location !== undefined ? { region: location } : {}),
                ...(imageUrl !== undefined ? { imageUrl } : {}),
                ...(concept !== undefined ? { concept } : {}),
                ...(sub_title !== undefined ? { sub_title } : {}),
                ...(target_situation !== undefined ? { target_situation } : {}),
                ...(is_editor_pick !== undefined ? { is_editor_pick } : {}),
                ...(grade !== undefined ? { grade } : {}),
                ...(isPublic !== undefined ? { isPublic } : {}), // [추가]
                ...(tags !== undefined ? { tags } : {}), // [추가]
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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userId = resolveUserId(request);
        const userIdStr = userId ? String(userId) : null;
        if (!userIdStr) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const { id } = await params;
        const courseId = Number(id);
        if (!courseId || isNaN(courseId)) {
            return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
        }

        // [권한 검증] 코스 소유자 확인
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            select: { userId: true },
        });

        if (!course) {
            return NextResponse.json({ error: "코스를 찾을 수 없습니다." }, { status: 404 });
        }

        // 코스 소유자가 아니면 삭제 불가
        if (course.userId && course.userId !== Number(userIdStr)) {
            return NextResponse.json({ error: "코스를 삭제할 권한이 없습니다." }, { status: 403 });
        }

        await prisma.course.delete({ where: { id: courseId } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("API: 코스 삭제 오류:", error);
        return NextResponse.json({ error: "코스 삭제 실패" }, { status: 500 });
    }
}
