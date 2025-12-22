// src/app/(home)/courses/[id]/page.tsx

import { Suspense } from "react";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import { cookies } from "next/headers";
import { verifyJwtAndGetUserId } from "@/lib/auth";
import CourseDetailClient, { CourseData, Review } from "./CourseDetailClient";
import { unstable_cache } from "next/cache";

// 1. 데이터 페칭 함수 (코스 정보 캐싱)
const getCourse = unstable_cache(
    async (id: string): Promise<CourseData | null> => {
        const courseId = Number(id);
        if (isNaN(courseId)) return null;
        try {
            const course = await (prisma as any).course.findUnique({
                where: { id: courseId },
                include: {
                    highlights: true,
                    coursePlaces: {
                        include: { place: { include: { closed_days: true } } },
                        orderBy: { order_index: "asc" },
                    },
                    courseDetail: true,
                    _count: { select: { coursePlaces: true } },
                },
            });
            if (!course) return null;

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
                recommended_start_time: course.courseDetail?.recommended_start_time || "오후 2시",
                season: course.courseDetail?.season || "사계절",
                courseType: course.courseDetail?.course_type || "데이트",
                transportation: course.courseDetail?.transportation || "도보",
                reservationRequired: (course as any).reservationRequired || false,
                createdAt: course.createdAt.toISOString(),
                updatedAt: course.updatedAt.toISOString(),
                highlights: course.highlights,
                coursePlaces: course.coursePlaces.map((cp: any) => ({
                    ...cp,
                    place: {
                        ...cp.place,
                        latitude: Number(cp.place.latitude),
                        longitude: Number(cp.place.longitude),
                        closed_days: cp.place.closed_days.map((d: any) => ({
                            ...d,
                            specific_date: d.specific_date ? d.specific_date.toISOString() : null,
                        })),
                    },
                })),
            };
        } catch (e) {
            return null;
        }
    },
    ["course-detail"],
    { revalidate: 300, tags: ["course-detail"] } // 5분 캐싱 (성능 최적화)
);

// 리뷰 페칭 함수
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
    } catch (e) {
        return [];
    }
}

// 2. 메인 페이지 컴포넌트
export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const courseId = Number(id);

    // 병렬 데이터 페칭
    const [courseData, reviews] = await Promise.all([getCourse(id), getReviews(id)]);
    if (!courseData) notFound();

    // 🔒 [권한 확인 로직 시작]
    const cookieStore = await cookies();
    const token = cookieStore.get("auth")?.value;
    let userTier = "FREE";
    let hasUnlocked = false; // 🟢 추가: 구매 여부 상태

    if (token) {
        try {
            const userId = verifyJwtAndGetUserId(token);
            if (userId) {
                // 유저 정보와 구매 기록을 동시에 조회
                const [user, unlockRecord] = await Promise.all([
                    prisma.user.findUnique({
                        where: { id: Number(userId) },
                        select: { subscriptionTier: true },
                    }),
                    // 🟢 핵심: CourseUnlock 테이블에서 이 유저가 이 코스를 샀는지 확인
                    (prisma as any).courseUnlock.findUnique({
                        where: {
                            userId_courseId: {
                                userId: Number(userId),
                                courseId: courseId,
                            },
                        },
                    }),
                ]);

                if (user) userTier = user.subscriptionTier;
                if (unlockRecord) hasUnlocked = true; // 🟢 구매 기록이 있다면 true!
            }
        } catch (e) {
            console.error("Auth check failed");
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

    return (
        <CourseDetailClient courseData={secureCourseData} initialReviews={reviews} courseId={id} userTier={userTier} />
    );
}
