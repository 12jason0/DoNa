import { Suspense } from "react";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import CourseDetailClient, { CourseData, Review } from "./CourseDetailClient";

// 1. 데이터 페칭 함수 (Server-side)
async function getCourse(id: string): Promise<CourseData | null> {
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
            notes: cp.notes || undefined,

            coaching_tip:
                cp.coaching_tip ||
                (idx === 0
                    ? "창가 자리 예약 필수! 뷰가 정말 예뻐요."
                    : idx === 1
                    ? "시그니처 메뉴인 '트러플 파스타' 강추!"
                    : null),

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
                reservation_required: !!cp.place.reservation_required,
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
            sub_title: course.sub_title || "썸녀가 200% 감동하는 완벽 코스", // Default
            target_situation: course.target_situation || "SOME", // Default
            duration: course.duration || "시간 미정",
            price: "", // DB에 price 컬럼이 없다면 빈 문자열
            imageUrl: course.imageUrl || "",
            concept: course.concept || "",
            rating: Number(course.rating),
            isPopular: course.isPopular,
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
}

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

    return <CourseDetailClient courseData={courseData} initialReviews={reviews} courseId={id} />;
}
