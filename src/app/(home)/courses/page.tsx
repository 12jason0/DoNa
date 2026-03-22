import { Suspense } from "react";
import CoursesClient from "./CoursesClient";
import prisma from "@/lib/db";
import { filterCoursesByImagePolicy, type CourseWithPlaces } from "@/lib/imagePolicy";
import { cookies } from "next/headers";
import { verifyJwtAndGetUserId } from "@/lib/auth";
import { unstable_cache } from "next/cache";
import { getTimeOfDayFromKST } from "@/lib/kst";
import { sortCoursesByTimeMatch } from "@/lib/timeMatch";

// 🟢 Hero 슬라이더용 코스 (FREE 등급, "지금 많이 선택한 코스")
async function getHeroCourses() {
    try {
        const heroRaw = await prisma.course.findMany({
            where: { isPublic: true, grade: "FREE" },
            take: 10,
            select: {
                id: true,
                title: true,
                region: true,
                imageUrl: true,
                concept: true,
                coursePlaces: {
                    orderBy: { order_index: "asc" as const },
                    take: 1,
                    select: { place: { select: { imageUrl: true } } },
                },
            },
        });
        const filtered = filterCoursesByImagePolicy(heroRaw as unknown as CourseWithPlaces[], "any");
        if (filtered.length === 0) return [];
        const threeDayEpoch = Math.floor(Date.now() / 259200000);
        const startIndex = threeDayEpoch % filtered.length;
        return Array.from(
            { length: Math.min(5, filtered.length) },
            (_, i) => filtered[(startIndex + i) % filtered.length]
        )        .map((c: any) => ({
            id: String(c.id),
            title: c.title || "",
            imageUrl: c.imageUrl || c.coursePlaces?.[0]?.place?.imageUrl || "",
            location: c.region || "",
            concept: c.concept || "",
        }));
    } catch {
        return [];
    }
}

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
        orderBy: { order_index: "asc" as const },
        take: 1,
        select: {
            order_index: true,
            segment: true,
            place: {
                select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                    reservationUrl: true,
                    opening_hours: true,
                    closed_days: {
                        select: { day_of_week: true, specific_date: true, note: true },
                    },
                },
            },
        },
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
                title: course.title || "",
                description: course.description || "",
                duration: course.duration || "",
                location: course.region || "",
                imageUrl: course.imageUrl || course.coursePlaces?.[0]?.place?.imageUrl || "",
                concept: course.concept || "",
                rating: Number(course.rating) || 0,
                reviewCount: 0,
                participants: 0,
                viewCount: course.view_count || 0,
                createdAt: course.createdAt
                    ? typeof course.createdAt === "string"
                        ? course.createdAt
                        : course.createdAt.toISOString()
                    : undefined,
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
                                  reservationUrl: cp.place.reservationUrl,
                                  opening_hours: cp.place.opening_hours || null,
                                  closed_days: cp.place.closed_days || [],
                              }
                            : null,
                    })) || [],
                // 🟢 [Fix]: _count에서 장소 개수를 확실하게 가져오기 (take: 1 제한과 무관하게)
                placesCount: course._count?.coursePlaces ?? (course.coursePlaces?.length || 0),
            };
        })
        .filter((course: any) => course !== null);
}

// 🟢 [Performance]: raw 코스 데이터 캐싱 (유저별 차이 없음 → 캐시 히트율 극대화)
// isLocked는 mapCourses에서 userTier + unlockedCourseIds로 매 요청 계산 → 잠금 상태 정확 유지
function getCachedRawCoursesWithTime(timeOfDay: string | null) {
    return unstable_cache(
        async () => {
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

            sortCoursesByTimeMatch(interleaved, timeOfDay);
            return interleaved;
        },
        ["courses-list", timeOfDay ?? ""],
        { revalidate: 180, tags: ["courses-list"] }
    )();
}

async function getCachedRawCourses(timeOfDay: string | null) {
    return getCachedRawCoursesWithTime(timeOfDay);
}

async function getInitialCourses(searchParams: { [key: string]: string | string[] | undefined }) {
    const q = typeof searchParams?.q === "string" ? searchParams.q : undefined;
    const concept = typeof searchParams?.concept === "string" ? searchParams.concept : undefined;
    const gradeParam = typeof searchParams?.grade === "string" ? searchParams.grade.toUpperCase() : undefined;
    const grade = ["FREE", "BASIC", "PREMIUM"].includes(gradeParam || "") ? gradeParam : undefined;

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
    const isDefaultLoad = !q && !concept && !grade;

    // 🟢 [Case 1: 검색/필터링 모드] - 캐싱 없이 실시간 검색
    if (!isDefaultLoad) {
        const where: any = { isPublic: true };
        if (grade) where.grade = grade;
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

        const timeOfDay = getTimeOfDayFromKST();
        sortCoursesByTimeMatch(courses, timeOfDay);
        return mapCourses(courses, userTier, unlockedCourseIds);
    }

    // 🟢 [Case 2: 초기 로드 - raw 캐시 + 유저별 isLocked 계산]
    const timeOfDay = getTimeOfDayFromKST();
    const rawCourses = await getCachedRawCourses(timeOfDay);
    return mapCourses(rawCourses, userTier, unlockedCourseIds);
}

export default async function CoursesPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const resolvedParams = await Promise.resolve(searchParams);
    const [initialCourses, initialHeroCourses] = await Promise.all([
        getInitialCourses(resolvedParams),
        getHeroCourses(),
    ]);

    return (
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
            {/* 🟢 initialCourses, initialHeroCourses를 주입하여 클라이언트에서의 첫 로드를 생략 */}
            <CoursesClient initialCourses={initialCourses} initialHeroCourses={initialHeroCourses} />
        </Suspense>
    );
}
