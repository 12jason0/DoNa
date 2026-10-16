import { Suspense } from "react";
import { interleaveByGrade, MAX_LIST_COURSES } from "@/lib/courseListOrder";
import { composeHotHero, getHotCourseIds } from "@/lib/hotCourses";
import CoursesClient from "./CoursesClient";
import { notExpiredCourseWhere } from "@/lib/placePeriod";
import prisma from "@/lib/db";
import { filterCoursesByImagePolicy, type CourseWithPlaces } from "@/lib/imagePolicy";
import { cookies } from "next/headers";
import { verifyJwtAndGetUserId } from "@/lib/auth";
import { maskLockedCourse } from "@/lib/tipAccess";
import { unstable_cache } from "next/cache";
import { getTimeOfDayFromKST } from "@/lib/kst";
import { sortCoursesByTimeMatch } from "@/lib/timeMatch";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "서울 데이트 코스 모음",
    description: "성수·망원·한남·홍대 등 동네별 서울 데이트 코스. 예산·소요시간·장소 동선까지 한눈에.",
    alternates: { canonical: "/courses" },
};

type HeroSliderItem = {
    id: string;
    title: string;
    title_en?: string | null;
    title_ja?: string | null;
    title_zh?: string | null;
    imageUrl: string;
    location: string;
    concept: string;
};

function mapRowToHeroItem(c: {
    id: number;
    title: string | null;
    title_en?: string | null;
    title_ja?: string | null;
    title_zh?: string | null;
    region: string | null;
    imageUrl: string | null;
    concept: string | null;
    coursePlaces?: { place?: { imageUrl?: string | null } | null }[];
}): HeroSliderItem {
    return {
        id: String(c.id),
        title: c.title || "",
        title_en: c.title_en || null,
        title_ja: c.title_ja || null,
        title_zh: c.title_zh || null,
        imageUrl: c.imageUrl || c.coursePlaces?.[0]?.place?.imageUrl || "",
        location: c.region || "",
        concept: c.concept || "",
    };
}

/** "지금 많이 선택한 코스" — 최근 30일 고유 회원 수 상위, 모자라면 등급 섞기로 채움 (앱 /api/courses?hero=1과 같은 composeHotHero) */
const getHeroCourses = unstable_cache(
    async (): Promise<HeroSliderItem[]> => {
        try {
            const rows = await prisma.course.findMany({
                where: { isPublic: true, ...notExpiredCourseWhere() },
                orderBy: { id: "desc" },
                take: MAX_LIST_COURSES,
                select: {
                    id: true,
                    grade: true,
                    title: true,
                    title_en: true,
                    title_ja: true,
                    title_zh: true,
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
            const hero = composeHotHero(interleaveByGrade(rows), await getHotCourseIds().catch(() => []));
            return hero.map((c) => mapRowToHeroItem(c as any));
        } catch {
            return [];
        }
    },
    ["hero-courses-v3"],
    { revalidate: 300, tags: ["hero-courses"] }
);

/** 히어로 전용 조회가 비었을 때 목록 상단 코스로 폴밄 (동일 슬라이더 형식) */
function heroFromInitialCourses(courses: any[]): HeroSliderItem[] {
    if (!Array.isArray(courses) || courses.length === 0) return [];
    return courses.slice(0, 5).map((c) => ({
        id: String(c.id),
        title: c.title || "",
        title_en: c.title_en || null,
        title_ja: c.title_ja || null,
        title_zh: c.title_zh || null,
        imageUrl: c.imageUrl || "",
        location: c.location || "",
        concept: c.concept || "",
    }));
}

export const revalidate = 120; // 🟢 성능 최적화: 60초 -> 120초로 캐시 시간 증가

// 🟢 [Optimization] 필요한 최소 필드만 조회 (90% 데이터 크기 감소)
// Prisma의 'select'를 활용하여 인덱스 최적화 및 페이로드 축소
const courseSelectOptions = {
    id: true,
    title: true,
    title_en: true,
    title_ja: true,
    title_zh: true,
    description: true,
    description_en: true,
    description_ja: true,
    description_zh: true,
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

            return maskLockedCourse({
                id: String(course.id),
                title: course.title || "",
                title_en: course.title_en || null,
                title_ja: course.title_ja || null,
                title_zh: course.title_zh || null,
                description: course.description || "",
                description_en: course.description_en || null,
                description_ja: course.description_ja || null,
                description_zh: course.description_zh || null,
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
            });
        })
        .filter((course: any) => course !== null);
}

// 🟢 [Performance]: raw 코스 데이터 캐싱 - 모듈 레벨 정의로 Next.js 캐시 정상 작동
// isLocked는 mapCourses에서 userTier + unlockedCourseIds로 매 요청 계산 → 잠금 상태 정확 유지
const getCachedRawCourses = unstable_cache(
    async (timeOfDay: string | null) => {
        // 공개 코스 전체를 첫 화면에 (무한 스크롤에 기대지 않음). 순서는 /api/courses 기본 목록과 동일
        const rawAll = await prisma.course.findMany({
            where: { isPublic: true, ...notExpiredCourseWhere() },
            take: MAX_LIST_COURSES,
            orderBy: { id: "desc" },
            select: courseSelectOptions,
        });
        const ordered = interleaveByGrade(filterCoursesByImagePolicy(rawAll as unknown as CourseWithPlaces[], "any") as any[]);
        sortCoursesByTimeMatch(ordered, timeOfDay);
        return ordered;
    },
    ["courses-list"],
    { revalidate: 180, tags: ["courses-list"] }
);

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
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const resolvedParams = await searchParams;
    const [initialCourses, initialHeroCourses] = await Promise.all([
        getInitialCourses(resolvedParams),
        getHeroCourses(),
    ]);

    const heroCourses =
        initialHeroCourses.length > 0 ? initialHeroCourses : heroFromInitialCourses(initialCourses);

    return (
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
            {/* 🟢 initialCourses, initialHeroCourses를 주입하여 클라이언트에서의 첫 로드를 생략 */}
            <CoursesClient initialCourses={initialCourses} initialHeroCourses={heroCourses} />
        </Suspense>
    );
}
