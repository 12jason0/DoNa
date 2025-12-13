import { Suspense } from "react";
import CoursesClient from "./CoursesClient";
import prisma from "@/lib/db";
import { filterCoursesByImagePolicy, type CourseWithPlaces } from "@/lib/imagePolicy";
import { cookies } from "next/headers";
import { verifyJwtAndGetUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getInitialCourses(searchParams: { [key: string]: string | string[] | undefined }) {
    // Default params for initial load
    const limit = 100;

    // Simplified query for initial load
    // We replicate the core logic of /api/courses
    const q = typeof searchParams?.q === "string" ? searchParams.q : undefined;
    const concept = typeof searchParams?.concept === "string" ? searchParams.concept : undefined;

    const where: any = {};
    if (q) {
        where.OR = [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { concept: { contains: q, mode: "insensitive" } },
            { region: { contains: q, mode: "insensitive" } },
        ];
    }

    // We ignore complex concept/tag filtering for Server Component initial load to keep it simple and fast.
    if (concept) {
        where.concept = { contains: concept, mode: "insensitive" };
    }

    // ✅ [유저 등급 확인]
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
                if (user) {
                    userTier = user.subscriptionTier;
                }
            }
        } catch (e) {
            // 토큰이 유효하지 않은 경우 무시 (FREE로 유지)
        }
    }

    const courses = await prisma.course.findMany({
        where,
        orderBy: { id: "desc" },
        take: limit,
        select: {
            id: true,
            title: true,
            description: true,
            duration: true,
            region: true,
            imageUrl: true,
            concept: true,
            rating: true,
            view_count: true,
            createdAt: true,
            grade: true, // ✅ 등급 정보 가져오기
            coursePlaces: {
                orderBy: { order_index: "asc" },
                select: {
                    order_index: true,
                    place: {
                        select: {
                            id: true,
                            name: true,
                            imageUrl: true,
                            latitude: true,
                            longitude: true,
                            opening_hours: true,
                            closed_days: {
                                select: {
                                    day_of_week: true,
                                    specific_date: true,
                                    note: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    // Image Policy (default: any)
    const imagePolicyApplied = filterCoursesByImagePolicy(courses as unknown as CourseWithPlaces[], "any");

    // 5. 데이터 매핑 & 잠금 계산 & 정렬
    const mappedCourses = imagePolicyApplied.map((course: any) => {
        // 잠금 계산
        let isLocked = false;
        const courseGrade = course.grade || "FREE";

        if (userTier === "PREMIUM") {
            isLocked = false;
        } else if (userTier === "BASIC") {
            if (courseGrade === "PREMIUM") isLocked = true;
        } else {
            // FREE 유저
            if (courseGrade === "BASIC" || courseGrade === "PREMIUM") isLocked = true;
        }

        return {
            id: String(course.id),
            title: course.title || "제목 없음",
            description: course.description || "",
            duration: course.duration || "",
            location: course.region || "",
            imageUrl: course.imageUrl || course.coursePlaces?.[0]?.place?.imageUrl || "",
            concept: course.concept || "",
            rating: Number(course.rating) || 0,
            reviewCount: 0, // Simplified
            participants: 0,
            viewCount: course.view_count || 0,
            createdAt: course.createdAt ? course.createdAt.toISOString() : undefined,
            grade: courseGrade,
            isLocked: isLocked, // ✅ 잠금 상태 전달
            coursePlaces:
                course.coursePlaces?.map((cp: any) => ({
                    order_index: cp.order_index,
                    place: cp.place
                        ? {
                              id: cp.place.id,
                              name: cp.place.name,
                              imageUrl: cp.place.imageUrl,
                              latitude: cp.place.latitude ? Number(cp.place.latitude) : undefined,
                              longitude: cp.place.longitude ? Number(cp.place.longitude) : undefined,
                              opening_hours: cp.place.opening_hours || null,
                              closed_days: cp.place.closed_days || [],
                          }
                        : null,
                })) || [],
        };
    });

    // ✅ 6. [정렬] FREE > BASIC > PREMIUM 순서
    const gradeWeight: Record<string, number> = {
        FREE: 1,
        BASIC: 2,
        PREMIUM: 3,
    };

    mappedCourses.sort((a, b) => {
        const weightA = gradeWeight[a.grade] || 1;
        const weightB = gradeWeight[b.grade] || 1;
        return weightA - weightB;
    });

    return mappedCourses;
}

export default async function CoursesPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    // Resolve searchParams before using
    const resolvedParams = await Promise.resolve(searchParams);
    const initialCourses = await getInitialCourses(resolvedParams);

    return (
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
            <CoursesClient initialCourses={initialCourses} />
        </Suspense>
    );
}
