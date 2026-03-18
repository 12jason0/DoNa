import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { getMergedTipsFromRow } from "@/types/tip";
import { captureApiError } from "@/lib/sentry";

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
            if (user?.subscriptionTier) {
                userTier = user.subscriptionTier;
            }

            try {
                const unlock = await (prisma as any).courseUnlock.findFirst({
                    where: { userId: userId, courseId: courseId },
                });
                hasUnlocked = !!unlock;
            } catch (e) {
                    captureApiError(e);
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
                isPublic: true, // 🟢 [Fix]: isPublic 필드 추가
                createdAt: true,
                updatedAt: true,
                highlights: { select: { id: true, title: true, description: true, icon: true } },
                // 🟢 benefits는 현재 UI에서 사용하지 않으므로 주석 처리 (필요시 활성화)
                // benefits: { select: { id: true, benefit_text: true, category: true, display_order: true } },
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
                        tips: true,
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
                                reservationUrl: true, // 🟢 예약 주소 추가
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

        // 🟢 [Fix]: 추천 API와 일관성 유지 - isPublic 체크 (단, 이미 구매한 코스는 예외)
        if (!course.isPublic && !hasUnlocked) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        const coursePlacesArray = Array.isArray(course.coursePlaces) ? course.coursePlaces : [];

        // 🟢 [Debug]: Prisma 쿼리 결과 확인
        if (process.env.NODE_ENV === "development") {
            const place70 = coursePlacesArray.find((cp: any) => cp?.place?.id === 70);
            if (place70) {
                console.log("[API Debug] Prisma 쿼리 결과 - Place ID 70:", {
                    rawPlace: place70.place,
                    reservationUrl: place70.place?.reservationUrl,
                    hasReservationUrl: !!place70.place?.reservationUrl,
                    allPlaceKeys: place70.place ? Object.keys(place70.place) : [],
                });
            }
        }

        const placeIds = coursePlacesArray
            .map((cp: any) => cp?.place?.id)
            .filter((pid: any) => pid !== undefined && pid !== null);

        let closedDaysMap: Record<number, any[]> = {};
        if (placeIds.length > 0) {
            try {
                const closedDays = await (prisma as any).placeClosedDay.findMany({
                    where: { place_id: { in: placeIds } },
                });
                if (Array.isArray(closedDays)) {
                    closedDays.forEach((cd: any) => {
                        if (cd?.place_id !== undefined && cd.place_id !== null) {
                            if (!closedDaysMap[cd.place_id]) closedDaysMap[cd.place_id] = [];
                            closedDaysMap[cd.place_id].push(cd);
                        }
                    });
                }
            } catch (e) {
                    captureApiError(e);
                console.warn("[API] placeClosedDay 조회 실패:", e);
                // 에러가 발생해도 계속 진행 (closedDaysMap은 빈 객체로 유지)
            }
        }

        const courseGrade = course.grade || "FREE";
        // 🔒 권한 판정: FREE 코스이거나, PREMIUM 유저이거나, BASIC 유저가 BASIC 코스에 접근하거나, 열람권으로 구매한 경우만 접근 허용
        const hasAccess =
            courseGrade === "FREE" || // 무료 코스
            userTier === "PREMIUM" || // PREMIUM 유저는 모든 코스 접근
            (userTier === "BASIC" && courseGrade === "BASIC") || // BASIC 유저는 BASIC 코스만 접근
            hasUnlocked; // 열람권으로 구매한 경우 (FREE 유저도 해당 코스 접근 가능)

        // 🔒 팁 표시 권한: BASIC/PREMIUM 유저 또는 열람권으로 구매한 경우만 팁 표시
        const hasTipAccess = userTier === "BASIC" || userTier === "PREMIUM" || hasUnlocked;

        // 🔒 [서버 사이드 데이터 마스킹] 접근 권한이 없으면 핵심 정보 차단
        const coursePlaces = coursePlacesArray
            .map((cp: any) => {
                try {
                    if (!cp || !cp.place) return null;

                    if (!hasAccess) {
                        const latForMap = cp.place?.latitude != null ? Number(cp.place.latitude) : null;
                        const lngForMap = cp.place?.longitude != null ? Number(cp.place.longitude) : null;
                        return {
                            id: cp.id,
                            order_index: cp.order_index,
                            estimated_duration: null,
                            recommended_time: null,
                            tips: null,
                            movement_guide: null,
                            place: {
                                id: cp.place.id,
                                name: cp.place.name,
                                address: null,
                                description: null,
                                category: cp.place.category,
                                avg_cost_range: null,
                                opening_hours: null,
                                phone: null,
                                parking_available: null,
                                reservation_required: null,
                                reservationUrl: null,
                                latitude: latForMap,
                                longitude: lngForMap,
                                imageUrl: cp.place.imageUrl,
                                closed_days: [],
                            },
                        };
                    }

                    const placeId = cp.place?.id;
                    const latitude = cp.place?.latitude != null ? Number(cp.place.latitude) : null;
                    const longitude = cp.place?.longitude != null ? Number(cp.place.longitude) : null;
                    const tipsValue =
                        hasTipAccess ? getMergedTipsFromRow(cp) : null;

                    if (process.env.NODE_ENV === "development" && cp.place?.id === 70) {
                        console.log("[API Debug] Place ID 70 (테디뵈르하우스):", {
                            rawPlace: cp.place,
                            reservationUrl: cp.place?.reservationUrl,
                            hasReservationUrl: !!cp.place?.reservationUrl,
                        });
                    }

                    const mappedPlace = {
                        ...cp.place,
                        reservationUrl: cp.place?.reservationUrl || null,
                        latitude: isNaN(latitude as number) ? null : latitude,
                        longitude: isNaN(longitude as number) ? null : longitude,
                        closed_days: placeId ? closedDaysMap[placeId] || [] : [],
                    };

                    if (process.env.NODE_ENV === "development" && cp.place?.id === 70) {
                        console.log("[API Debug] Mapped Place ID 70:", {
                            reservationUrl: mappedPlace.reservationUrl,
                            hasReservationUrl: !!mappedPlace.reservationUrl,
                        });
                    }

                    return {
                        id: cp.id,
                        order_index: cp.order_index,
                        estimated_duration: cp.estimated_duration,
                        recommended_time: cp.recommended_time,
                        tips: tipsValue,
                        movement_guide: null,
                        place: mappedPlace,
                    };
                } catch (e) {
                        captureApiError(e);
                    console.warn("[API] coursePlace 처리 중 에러:", e, cp);
                    return null; // 에러 발생 시 해당 place 제외
                }
            })
            .filter((cp: any) => cp !== null);

        // 🟢 [수정 1] reservationRequired 계산: coursePlaces의 place들 중 하나라도 reservation_required가 true면 true
        const reservationRequired = coursePlaces.some((cp: any) => cp?.place?.reservation_required === true) || false;

        // 🟢 안전한 날짜 직렬화
        let createdAt: string | null = null;
        let updatedAt: string | null = null;
        try {
            if (course.createdAt) {
                const date = new Date(course.createdAt);
                if (!isNaN(date.getTime())) createdAt = date.toISOString();
            }
        } catch (e) {
                captureApiError(e);
            console.warn("[API] createdAt 직렬화 실패:", e);
        }
        try {
            if (course.updatedAt) {
                const date = new Date(course.updatedAt);
                if (!isNaN(date.getTime())) updatedAt = date.toISOString();
            }
        } catch (e) {
                captureApiError(e);
            console.warn("[API] updatedAt 직렬화 실패:", e);
        }

        // 🔒 [서버 사이드 데이터 마스킹] 접근 권한이 없으면 설명과 상세 정보 마스킹
        const payload = {
            id: String(course.id),
            title: course.title || "",
            description: hasAccess ? course.description || "" : "", // 🔒 마스킹
            sub_title: hasAccess ? course.sub_title : null, // 🔒 마스킹
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
            highlights: hasAccess ? (Array.isArray(course.highlights) ? course.highlights : []) : [], // 🔒 마스킹
            // 🟢 benefits는 현재 UI에서 사용하지 않으므로 빈 배열로 설정
            benefits: [],
            notices: hasAccess ? (Array.isArray(course.courseNotices) ? course.courseNotices : []) : [], // 🔒 마스킹
            coursePlaces,
            courseDetail: hasAccess ? course.courseDetail || {} : {}, // 🔒 마스킹
            reservationRequired: hasAccess ? reservationRequired : false, // 🔒 마스킹
            createdAt,
            updatedAt,
        };

        return NextResponse.json(payload);
    } catch (error: any) {
            captureApiError(error);
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
