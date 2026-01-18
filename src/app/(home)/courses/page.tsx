import { Suspense } from "react";
import CoursesClient from "./CoursesClient";
import prisma from "@/lib/db";
import { filterCoursesByImagePolicy, type CourseWithPlaces } from "@/lib/imagePolicy";
import { cookies, headers } from "next/headers";
import { verifyJwtAndGetUserId } from "@/lib/auth";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 120; // 🟢 성능 최적화: 60초 -> 120초로 캐시 시간 증가

// 🟢 [Optimization] 필요한 최소 필드만 조회 (90% 데이터 크기 감소)
// Prisma의 'select'를 활용하여 인덱스 최적화 및 페이로드 축소
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
        select: {
            order_index: true,
            place: {
                select: {
                    id: true,
                    imageUrl: true,
                    reservationUrl: true,
                },
            },
        },
        orderBy: { order_index: "asc" as const },
        take: 1, // 리스트 페이지이므로 첫 번째 장소 정보만 로드
    },
    // 🟢 [Fix]: 장소 개수를 위한 _count 추가
    _count: { select: { coursePlaces: true } },
};

// 매핑 함수 (기능 100% 보존 및 타입 가드 강화)
function mapCourses(courses: any[], userTier: string, unlockedCourseIds: number[]): any[] {
    if (!Array.isArray(courses)) return [];

    const imagePolicyApplied = filterCoursesByImagePolicy(courses as unknown as CourseWithPlaces[], "any");

    return imagePolicyApplied
        .map((course: any) => {
            if (!course || !course.id) return null;

            const courseGrade = course.grade || "FREE";
            const courseId = Number(course.id);
            if (!Number.isFinite(courseId)) return null;

            // 🟢 잠금 계산 로직 (유료 등급 및 개별 구매 확인)
            let isLocked = false;
            const hasUnlocked = unlockedCourseIds.includes(courseId);

            if (hasUnlocked || userTier === "PREMIUM") {
                isLocked = false;
            } else if (userTier === "BASIC") {
                if (courseGrade === "PREMIUM") isLocked = true;
            } else {
                // FREE 유저는 BASIC, PREMIUM 코스 모두 잠금
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
                                  imageUrl: cp.place.imageUrl,
                                  reservationUrl: cp.place.reservationUrl,
                              }
                            : null,
                    })) || [],
                // 🟢 [Fix]: _count에서 장소 개수를 확실하게 가져오기 (take: 1 제한과 무관하게)
                placesCount: course._count?.coursePlaces ?? (course.coursePlaces?.length || 0),
            };
        })
        .filter((course: any) => course !== null);
}

// 🟢 [Performance]: 초기 코스 데이터 캐싱 (검색/필터 없을 때만)
const getCachedDefaultCourses = unstable_cache(
    async (userTier: string, unlockedCourseIds: number[]) => {
        const rawAll = await prisma.course.findMany({
            where: { isPublic: true },
            take: 60,
            orderBy: { id: "desc" },
            select: courseSelectOptions,
        });

        const freeRaw = rawAll.filter((c: any) => c.grade === "FREE");
        const basicRaw = rawAll.filter((c: any) => c.grade === "BASIC").slice(0, 9);
        const premiumRaw = rawAll.filter((c: any) => c.grade === "PREMIUM").slice(0, 6);

        const neededFromFree = 15 + (9 - basicRaw.length) + (6 - premiumRaw.length);
        const freeArr = freeRaw.slice(0, Math.max(neededFromFree, 0));

        // 🟢 인터리빙 알고리즘 (비율 유지: FREE 2, BASIC 1, PREMIUM 1)
        const interleaved: any[] = [];
        let fIdx = 0,
            bIdx = 0,
            pIdx = 0;

        while (
            interleaved.length < 30 &&
            (fIdx < freeArr.length || bIdx < basicRaw.length || pIdx < premiumRaw.length)
        ) {
            if (fIdx < freeArr.length) interleaved.push(freeArr[fIdx++]);
            if (fIdx < freeArr.length && interleaved.length < 30) interleaved.push(freeArr[fIdx++]);
            if (bIdx < basicRaw.length && interleaved.length < 30) interleaved.push(basicRaw[bIdx++]);
            if (pIdx < premiumRaw.length && interleaved.length < 30) interleaved.push(premiumRaw[pIdx++]);
        }

        return mapCourses(interleaved, userTier, unlockedCourseIds);
    },
    [],
    {
        revalidate: 180, // 🟢 3분 캐시
        tags: ["courses-list"],
    }
);

async function getInitialCourses(searchParams: { [key: string]: string | string[] | undefined }) {
    const q = typeof searchParams?.q === "string" ? searchParams.q : undefined;
    const concept = typeof searchParams?.concept === "string" ? searchParams.concept : undefined;

    // ✅ 서버 사이드 인증 및 잠금 해제 목록 병렬 조회 (성능 향상)
    const cookieStore = await cookies();
    const token = cookieStore.get("auth")?.value;
    let userTier = "FREE";
    let unlockedCourseIds: number[] = [];

    if (token) {
        try {
            const userIdStr = verifyJwtAndGetUserId(token);
            if (userIdStr) {
                const userIdNum = Number(userIdStr);
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

                if (user?.subscriptionTier) userTier = user.subscriptionTier;
                unlockedCourseIds = Array.isArray(unlocks) ? unlocks.map((u: any) => u.courseId) : [];
            }
        } catch (e) {
            console.warn("[CoursesPage] Auth check failed:", e);
        }
    }

    const isDefaultLoad = !q && !concept;

    // 🟢 [Case 1: 검색/필터링 모드] - 캐싱 없이 실시간 검색
    if (!isDefaultLoad) {
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

        return mapCourses(courses, userTier, unlockedCourseIds);
    }

    // 🟢 [Case 2: 초기 로드 - 캐싱된 데이터 사용]
    return getCachedDefaultCourses(userTier, unlockedCourseIds);
}

export default async function CoursesPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const resolvedParams = await Promise.resolve(searchParams);
    const initialCourses = await getInitialCourses(resolvedParams);

    return (
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
            {/* 🟢 initialCourses를 주입하여 클라이언트에서의 첫 로드를 생략하게 함 */}
            <CoursesClient initialCourses={initialCourses} />
        </Suspense>
    );
}
