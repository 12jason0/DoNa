import { Suspense } from "react";
import CoursesClient from "./CoursesClient";
import prisma from "@/lib/db";
import { filterCoursesByImagePolicy, type CourseWithPlaces } from "@/lib/imagePolicy";
import { cookies } from "next/headers";
import { verifyJwtAndGetUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 60; // 🟢 성능 최적화: 검색/필터 결과는 60초로 단축하여 빠른 반영

// 공통 select 옵션
const courseSelectOptions = {
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
    grade: true,
    coursePlaces: {
        take: 1,
        orderBy: { order_index: "asc" as const },
        select: {
            place: {
                select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                },
            },
        },
    },
};

// 공통 매핑 함수
function mapCourses(courses: any[], userTier: string, unlockedCourseIds: number[]): any[] {
    // 🟢 안전성 체크: courses가 배열인지 확인
    if (!Array.isArray(courses)) {
        console.warn("[courses/page.tsx] mapCourses: courses is not an array:", courses);
        return [];
    }

    const imagePolicyApplied = filterCoursesByImagePolicy(courses as unknown as CourseWithPlaces[], "any");

    return imagePolicyApplied
        .map((course: any) => {
            // 🟢 안전성 체크: course가 유효한지 확인
            if (!course || !course.id) {
                console.warn("[courses/page.tsx] mapCourses: Invalid course data:", course);
                return null;
            }

            const courseGrade = course.grade || "FREE";
            const courseId = Number(course.id);
            // 🟢 안전성 체크: courseId가 유효한 숫자인지 확인
            if (!Number.isFinite(courseId)) {
                console.warn("[courses/page.tsx] mapCourses: Invalid course ID:", course.id);
                return null;
            }

            let isLocked = false;

            // 잠금 계산
            const hasUnlocked = unlockedCourseIds.includes(courseId);
            if (hasUnlocked) {
                isLocked = false;
            } else if (userTier === "PREMIUM") {
                isLocked = false;
            } else if (userTier === "BASIC") {
                if (courseGrade === "PREMIUM") isLocked = true;
            } else {
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
                reviewCount: 0,
                participants: 0,
                viewCount: course.view_count || 0,
                createdAt: course.createdAt ? course.createdAt.toISOString() : undefined,
                grade: courseGrade,
                isLocked: isLocked,
                coursePlaces:
                    course.coursePlaces?.map((cp: any) => ({
                        order_index: cp.order_index,
                        place: cp.place
                            ? {
                                  id: cp.place.id,
                                  name: cp.place.name,
                                  imageUrl: cp.place.imageUrl,
                              }
                            : null,
                    })) || [],
            };
        })
        .filter((course: any) => course !== null); // 🟢 null 값 제거
}

async function getInitialCourses(searchParams: { [key: string]: string | string[] | undefined }) {
    const q = typeof searchParams?.q === "string" ? searchParams.q : undefined;
    const concept = typeof searchParams?.concept === "string" ? searchParams.concept : undefined;

    // ✅ [유저 등급 확인 및 잠금 해제된 코스 목록 조회]
    const cookieStore = await cookies();
    const token = cookieStore.get("auth")?.value;
    let userTier = "FREE";
    let unlockedCourseIds: number[] = [];

    if (token) {
        try {
            const userIdStr = verifyJwtAndGetUserId(token);
            if (userIdStr) {
                const userIdNum = Number(userIdStr);
                if (Number.isFinite(userIdNum) && userIdNum > 0) {
                    const [user, unlocks] = await Promise.all([
                        prisma.user
                            .findUnique({
                                where: { id: userIdNum },
                                select: { subscriptionTier: true },
                            })
                            .catch(() => null),
                        (prisma as any).courseUnlock
                            .findMany({
                                where: { userId: userIdNum },
                                select: { courseId: true },
                            })
                            .catch(() => []),
                    ]);

                    if (user?.subscriptionTier) {
                        userTier = user.subscriptionTier;
                    }
                    unlockedCourseIds = Array.isArray(unlocks) ? unlocks.map((u: any) => u.courseId) : [];
                }
            }
        } catch (e) {
            console.warn("[courses/page.tsx] JWT 검증 실패:", e instanceof Error ? e.message : String(e));
        }
    }

    // 🟢 [조건 체크] 검색이나 필터가 없는 순수 초기 로드인지 확인
    const isDefaultLoad = !q && !concept;

    if (!isDefaultLoad) {
        // 검색/필터가 있을 때는 기존처럼 최신순으로 30개만 가져옴
        const where: any = { isPublic: true };
        if (q) {
            where.OR = [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { concept: { contains: q, mode: "insensitive" } },
                { region: { contains: q, mode: "insensitive" } },
            ];
        }
        if (concept) {
            where.concept = { contains: concept, mode: "insensitive" };
        }

        const courses = await prisma.course.findMany({
            where,
            orderBy: { id: "desc" },
            take: 30,
            select: courseSelectOptions,
        });

        const mapped = mapCourses(courses, userTier, unlockedCourseIds);
        return mapped;
    }

    // 🟢 [5:3:2 비율 로직] 초기 로드 시 실행 (FREE:15, BASIC:9, PREMIUM:6)
    const TARGET_FREE = 15;
    const TARGET_BASIC = 9;
    const TARGET_PREMIUM = 6;

    // 병렬 쿼리로 속도 최적화
    const [freeRaw, basicRaw, premiumRaw] = await Promise.all([
        prisma.course.findMany({
            where: { isPublic: true, grade: "FREE" },
            take: 30,
            orderBy: { id: "desc" },
            select: courseSelectOptions,
        }),
        prisma.course.findMany({
            where: { isPublic: true, grade: "BASIC" },
            take: TARGET_BASIC,
            orderBy: { id: "desc" },
            select: courseSelectOptions,
        }),
        prisma.course.findMany({
            where: { isPublic: true, grade: "PREMIUM" },
            take: TARGET_PREMIUM,
            orderBy: { id: "desc" },
            select: courseSelectOptions,
        }),
    ]);

    // 부족분 보정: BASIC/PREMIUM이 부족하면 FREE에서 더 가져옴
    const basicArr = basicRaw;
    const premiumArr = premiumRaw;
    const neededFromFree = TARGET_FREE + (TARGET_BASIC - basicArr.length) + (TARGET_PREMIUM - premiumArr.length);
    const freeArr = freeRaw.slice(0, Math.max(neededFromFree, 0));

    // 🟢 [Interleaving] 2(FREE):1(BASIC):1(PREMIUM) 패턴으로 섞기
    const interleaved: any[] = [];
    let fIdx = 0,
        bIdx = 0,
        pIdx = 0;

    while (interleaved.length < 30 && (fIdx < freeArr.length || bIdx < basicArr.length || pIdx < premiumArr.length)) {
        if (fIdx < freeArr.length) interleaved.push(freeArr[fIdx++]);
        if (fIdx < freeArr.length && interleaved.length < 30) interleaved.push(freeArr[fIdx++]); // FREE 2개
        if (bIdx < basicArr.length && interleaved.length < 30) interleaved.push(basicArr[bIdx++]); // BASIC 1개
        if (pIdx < premiumArr.length && interleaved.length < 30) interleaved.push(premiumArr[pIdx++]); // PREMIUM 1개
    }

    // 필터 적용 전후 비교
    const mappedBeforeFilter = mapCourses(interleaved, userTier, unlockedCourseIds);
    return mappedBeforeFilter;
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
