import { Suspense } from "react";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import { cookies } from "next/headers";
import { verifyJwtAndGetUserId } from "@/lib/auth";
import CourseDetailClient, { CourseData, Review } from "./CourseDetailClient";
import { unstable_cache } from "next/cache";

// 1. 데이터 페칭 함수 (Server-side) - 캐싱 적용 (60초)
const getCourse = unstable_cache(
    async (id: string): Promise<CourseData | null> => {
        const courseId = Number(id);
        if (isNaN(courseId)) return null;

        try {
            const course = await prisma.course.findUnique({
                where: { id: courseId },
                include: {
                    highlights: true,
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
                    courseDetail: true,
                    _count: { select: { coursePlaces: true } },
                },
            });

            if (!course) return null;

            // 데이터 가공 및 더미 데이터 주입 (UI 풍성하게 보이기 위함)
            const coursePlaces = course.coursePlaces.map((cp, idx) => ({
                id: cp.id,
                course_id: cp.course_id,
                place_id: cp.place_id,
                order_index: cp.order_index,
                estimated_duration: cp.estimated_duration || 0,
                recommended_time: cp.recommended_time || "",
                coaching_tip: cp.coaching_tip || null,

                place: {
                    id: cp.place.id,
                    name: cp.place.name,
                    address: cp.place.address || "",
                    description: cp.place.description || "",
                    category: cp.place.category || "장소",
                    avg_cost_range: cp.place.avg_cost_range || "가격 정보 없음",
                    opening_hours: cp.place.opening_hours || "영업시간 정보 없음",
                    phone: cp.place.phone || undefined,
                    parking_available: !!cp.place.parking_available,
                    reservation_required: false, // Place 모델에 필드가 없으므로 기본값 사용
                    latitude: Number(cp.place.latitude),
                    longitude: Number(cp.place.longitude),
                    imageUrl: cp.place.imageUrl || undefined,
                    closed_days: cp.place.closed_days.map((d) => ({
                        day_of_week: d.day_of_week,
                        specific_date: d.specific_date ? d.specific_date.toISOString() : null,
                        note: d.note,
                    })),
                },
            }));

            return {
                id: String(course.id),
                title: course.title,
                description: course.description || "",
                region: course.region || null,
                sub_title: course.sub_title || null, // Default
                target_situation: course.target_situation || null, // Default
                duration: course.duration || "시간 미정",
                price: "", // DB에 price 컬럼이 없다면 빈 문자열
                imageUrl: course.imageUrl || "",
                concept: course.concept || "",
                rating: Number(course.rating),
                isPopular: course.isPopular,
                grade: course.grade || "FREE", // ✅ 등급 추가
                recommended_start_time: course.courseDetail?.recommended_start_time || "오후 2시",
                season: course.courseDetail?.season || "사계절",
                courseType: course.courseDetail?.course_type || "데이트",
                transportation: course.courseDetail?.transportation || "도보",
                reservationRequired: (course as any).reservationRequired || false,
                createdAt: course.createdAt.toISOString(),
                updatedAt: course.updatedAt.toISOString(),
                highlights: course.highlights,
                coursePlaces: coursePlaces,
            };
        } catch (error) {
            console.error("Course fetch error:", error);
            return null;
        }
    },
    ["course-detail"], // 캐시 키 prefix
    { revalidate: 60, tags: ["course-detail"] } // 60초마다 갱신
);

async function getReviews(id: string): Promise<Review[]> {
    const courseId = Number(id);
    if (isNaN(courseId)) return [];

    try {
        const reviews = await prisma.review.findMany({
            where: { courseId: courseId },
            include: { user: true },
            orderBy: { createdAt: "desc" },
        });

        return reviews.map((r: any) => ({
            id: r.id,
            rating: r.rating,
            userName: r.user?.nickname || "익명",
            createdAt: r.createdAt.toISOString(),
            content: r.comment || "",
            imageUrls: r.imageUrls || [],
        }));
    } catch (error) {
        console.error("Reviews fetch error:", error);
        return [];
    }
}

// 2. 메인 페이지 컴포넌트 (Server Component)
export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // 병렬 데이터 페칭
    const [courseData, reviews] = await Promise.all([getCourse(id), getReviews(id)]);

    if (!courseData) {
        notFound();
    }

    // 🔒 [보안 로직] 유저 등급 확인 및 잠금 처리
    const cookieStore = await cookies();
    const token = cookieStore.get("auth")?.value;
    let userTier = "FREE";

    if (token) {
        try {
            const userId = verifyJwtAndGetUserId(token);
            if (userId) {
                const user = await prisma.user.findUnique({
                    where: { id: Number(userId) },
                    select: { subscriptionTier: true },
                });
                if (user) userTier = user.subscriptionTier;
            }
        } catch (e) {
            // 토큰 만료/오류 시 FREE로 유지
        }
    }

    // 잠금 여부 계산
    let isLocked = false;
    const courseGrade = courseData.grade || "FREE";

    if (userTier === "PREMIUM") {
        isLocked = false;
    } else if (userTier === "BASIC") {
        if (courseGrade === "PREMIUM") isLocked = true;
    } else {
        // FREE 유저
        if (courseGrade === "BASIC" || courseGrade === "PREMIUM") isLocked = true;
    }

    // courseData에 잠금 상태 주입
    const secureCourseData = { ...courseData, isLocked };

    return (
        <CourseDetailClient courseData={secureCourseData} initialReviews={reviews} courseId={id} userTier={userTier} />
    );
}
