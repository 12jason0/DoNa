// src/app/(home)/courses/[id]/page.tsx

import { Suspense } from "react";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import { cookies } from "next/headers";
import { verifyJwtAndGetUserId } from "@/lib/auth";
import CourseDetailClient, { CourseData } from "./CourseDetailClient";
import { unstable_cache } from "next/cache";

// 1. 데이터 페칭 함수 (코스 정보 캐싱) - 🟢 성능 최적화: select 사용으로 필요한 필드만 가져오기
const getCourse = unstable_cache(
    async (id: string): Promise<CourseData | null> => {
        const courseId = Number(id);
        if (isNaN(courseId)) return null;
        try {
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
                    isPopular: true,
                    grade: true,
                    createdAt: true,
                    updatedAt: true,
                    highlights: {
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            icon: true,
                        },
                    },
                    coursePlaces: {
                        orderBy: { order_index: "asc" },
                        select: {
                            id: true,
                            course_id: true,
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
                                    // 🟢 closed_days는 필요할 때만 별도로 가져오기 (성능 최적화)
                                },
                            },
                        },
                    },
                    courseDetail: {
                        select: {
                            recommended_start_time: true,
                            season: true,
                            course_type: true,
                            transportation: true,
                        },
                    },
                    _count: {
                        select: { coursePlaces: true },
                    },
                },
            });
            if (!course) {
                console.error(`[CourseDetail] 코스를 찾을 수 없습니다: ${courseId}`);
                return null;
            }

            // 🟢 에러 처리: courseDetail이 null일 수 있음
            const courseDetail = course.courseDetail || null;
            const highlights = course.highlights || [];
            const coursePlaces = course.coursePlaces || [];

            // 🟢 closed_days는 클라이언트에서 필요할 때만 로드 (성능 최적화: 초기 로드 제거)
            const closedDaysMap: Record<number, any[]> = {};

            return {
                id: String(course.id),
                title: course.title,
                description: course.description || "",
                region: course.region || null,
                sub_title: course.sub_title || null,
                target_situation: course.target_situation || null,
                duration: course.duration || "시간 미정",
                price: "",
                imageUrl: course.imageUrl || "",
                concept: course.concept || "",
                rating: Number(course.rating),
                isPopular: course.isPopular,
                grade: course.grade || "FREE",
                recommended_start_time: courseDetail?.recommended_start_time || "오후 2시",
                season: courseDetail?.season || "사계절",
                courseType: courseDetail?.course_type || "데이트",
                transportation: courseDetail?.transportation || "도보",
                reservationRequired: coursePlaces.some((cp: any) => cp.place?.reservation_required) || false,
                createdAt: course.createdAt.toISOString(),
                updatedAt: course.updatedAt.toISOString(),
                highlights: highlights,
                coursePlaces: coursePlaces.map((cp: any) => ({
                    ...cp,
                    place: cp.place
                        ? {
                              ...cp.place,
                              latitude: cp.place.latitude ? Number(cp.place.latitude) : null,
                              longitude: cp.place.longitude ? Number(cp.place.longitude) : null,
                              closed_days: closedDaysMap[cp.place.id] || [],
                          }
                        : null,
                })),
            };
        } catch (e) {
            console.error(`[CourseDetail] 코스 데이터 로드 실패 (ID: ${id}):`, e);
            return null;
        }
    },
    // 🟢 빈 배열: 함수 파라미터(id)가 자동으로 캐시 키에 포함됨
    [],
    {
        revalidate: 3600, // 🟢 1시간 캐싱
        tags: ["course-detail"],
    }
);

// 🟢 최적화: 리뷰는 클라이언트에서 필요할 때만 로드하므로 서버에서 제거

// 2. 메인 페이지 컴포넌트
export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const courseId = Number(id);

    // 🟢 데이터 페칭
    const courseData = await getCourse(id);
    if (!courseData) {
        console.error(`[CourseDetailPage] 코스 ID ${id}를 찾을 수 없습니다.`);
        notFound();
    }

    // 🔒 [권한 확인 로직 시작] - 최적화: 토큰이 있을 때만 조회
    const cookieStore = await cookies();
    const token = cookieStore.get("auth")?.value;
    let userTier = "FREE";
    let hasUnlocked = false;

    if (token) {
        try {
            const userIdStr = verifyJwtAndGetUserId(token);
            if (userIdStr) {
                const userIdNum = Number(userIdStr);
                if (Number.isFinite(userIdNum) && userIdNum > 0) {
                    // 🟢 최적화: 유저 정보와 구매 기록을 한 번에 조회 (병렬)
                    const [user, unlockRecord] = await Promise.all([
                        prisma.user
                            .findUnique({
                                where: { id: userIdNum },
                                select: { subscriptionTier: true },
                            })
                            .catch(() => null),
                        (prisma as any).courseUnlock
                            .findFirst({
                                where: {
                                    userId: userIdNum,
                                    courseId: courseId,
                                },
                                select: { id: true }, // 🟢 최적화: id만 조회
                            })
                            .catch(() => null),
                    ]);

                    if (user?.subscriptionTier) userTier = user.subscriptionTier;
                    if (unlockRecord) hasUnlocked = true;
                }
            }
        } catch (e) {
            // 토큰이 유효하지 않은 경우 무시 (FREE로 유지)
            console.warn("[courses/[id]/page.tsx] JWT 검증 실패:", e instanceof Error ? e.message : String(e));
        }
    }

    // 🟢 하이브리드 잠금 계산 (등급제 OR 개별구매)
    const courseGrade = courseData.grade || "FREE";
    let isLocked = false;

    if (courseGrade !== "FREE") {
        isLocked = true; // 기본적으로 잠금

        // (1) 프리미엄 유저는 무조건 통과
        if (userTier === "PREMIUM") isLocked = false;

        // (2) 베이직 유저가 베이직 코스를 볼 때 통과
        if (userTier === "BASIC" && courseGrade === "BASIC") isLocked = false;

        // (3) ⭐️ 가장 중요: 등급이 낮아도 '구매 기록'이 있으면 무조건 잠금 해제!
        if (hasUnlocked) isLocked = false;
    }

    // 최종 결과 주입
    const secureCourseData = { ...courseData, isLocked };

    // 🟢 최적화: 리뷰는 클라이언트에서 필요할 때만 로드
    return <CourseDetailClient courseData={secureCourseData} initialReviews={[]} courseId={id} userTier={userTier} />;
}
