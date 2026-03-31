import { Suspense } from "react";
import NearbyClient from "./NearbyClient";
import prisma from "@/lib/db";
import { cookies, headers } from "next/headers";
import { verifyJwtAndGetUserId } from "@/lib/auth";
import { unstable_cache } from "next/cache";
import { resolveNearbyRegionParam } from "@/constants/nearbyRegionSlug";
import { getTimeOfDayFromKST } from "@/lib/kst";
import { sortCoursesByTimeMatch } from "@/lib/timeMatch";

export const dynamic = "force-dynamic";
export const revalidate = 120;

// ✅ [모듈 레벨] 공통 select 옵션
    const courseSelectOptions = {
        id: true,
        title: true,
        description: true,
        duration: true,
        region: true,
        imageUrl: true,
        concept: true,
        mood: true,
        target: true,
        grade: true,
        rating: true,
        view_count: true,
        createdAt: true,
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
                        latitude: true,
                        longitude: true,
                        opening_hours: true,
                        reservationUrl: true,
                        closed_days: {
                            select: { day_of_week: true, specific_date: true, note: true },
                        },
                    },
                },
            },
        },
    _count: { select: { coursePlaces: true } },
};

// ✅ [Fix #2] isLocked를 캐시 밖 메모리에서 계산하는 헬퍼
// 캐시 함수에서 userTier/unlockedCourseIds를 제거하여 모든 유저가 동일 캐시 엔트리를 공유
function applyIsLocked(courses: any[], userTier: string, unlockedCourseIds: number[]): any[] {
    return courses.map((course) => {
        const courseGrade = course.grade || "FREE";
        const courseId = Number(course.id);
        const hasUnlocked = Number.isFinite(courseId) && unlockedCourseIds.includes(courseId);

        let isLocked = false;
        if (hasUnlocked || userTier === "PREMIUM") {
            isLocked = false;
        } else if (userTier === "BASIC") {
            if (courseGrade === "PREMIUM") isLocked = true;
        } else {
            if (courseGrade === "BASIC" || courseGrade === "PREMIUM") isLocked = true;
        }

        return { ...course, isLocked };
    });
}

const DISTRICT_TO_REGION_TOKENS: Record<string, string[]> = {
    마포: ["마포", "홍대", "연남", "합정", "망원", "상수", "신촌"],
    용산: ["용산", "이태원", "한남", "해방촌", "경리단", "삼각지", "신용산"],
    강남: ["강남", "압구정", "신사", "가로수길", "논현", "청담", "반포", "서초", "역삼", "도곡", "양재", "잠원"],
    종로: ["종로", "북촌", "서촌", "인사", "안국", "혜화", "대학로", "익선", "광화문"],
    성동: ["성수", "뚝섬", "서울숲"],
    송파: ["잠실", "송파", "석촌", "방이", "문정"],
    영등포: ["영등포", "여의도", "문래"],
    중구: ["을지로", "충무로", "명동", "종로3가"],
};

function normalizeRegionToken(raw: string): string {
    return raw.trim().replace(/\s+/g, "").replace(/구$/, "");
}

function buildRegionSearchTerms(raw: string): string[] {
    const token = normalizeRegionToken(raw);
    if (!token) return [];
    return DISTRICT_TO_REGION_TOKENS[token] || [token];
}

// ✅ [모듈 레벨] 초기 로드 캐시 - userTier/unlockedCourseIds 제거 → 모든 유저 캐시 공유
const getCachedDefaultNearbyCourses = unstable_cache(
    async (isMobile: boolean, timeOfDay: string | null) => {
        const TARGET_FREE = 15;
        const TARGET_BASIC = 9;
        const TARGET_PREMIUM = 6;

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

        const basicArr = basicRaw;
        const premiumArr = premiumRaw;
        const neededFromFree =
            TARGET_FREE + (TARGET_BASIC - basicArr.length) + (TARGET_PREMIUM - premiumArr.length);
        const freeArr = freeRaw.slice(0, Math.max(neededFromFree, 0));

        const interleaved: any[] = [];
        let fIdx = 0,
            bIdx = 0,
            pIdx = 0;

        while (
            interleaved.length < 30 &&
            (fIdx < freeArr.length || bIdx < basicArr.length || pIdx < premiumArr.length)
        ) {
            if (fIdx < freeArr.length) interleaved.push(freeArr[fIdx++]);
            if (fIdx < freeArr.length && interleaved.length < 30) interleaved.push(freeArr[fIdx++]);
            if (bIdx < basicArr.length && interleaved.length < 30) interleaved.push(basicArr[bIdx++]);
            if (pIdx < premiumArr.length && interleaved.length < 30) interleaved.push(premiumArr[pIdx++]);
        }

        sortCoursesByTimeMatch(interleaved, timeOfDay);

        const gradeWeight: Record<string, number> = { FREE: 1, BASIC: 2, PREMIUM: 3 };

        const mapped = interleaved.map((c: any) => {
            const allTags: string[] = Array.from(new Set([
                ...(c.concept ? [c.concept] : []),
                ...(Array.isArray(c.mood) ? c.mood : []),
                ...(Array.isArray(c.target) ? c.target : []),
            ]));

            return {
                id: String(c.id),
                title: c.title || "",
                description: c.description || "",
                duration: c.duration || "",
                location: c.region || "",
                imageUrl: c.imageUrl || c.coursePlaces?.[0]?.place?.imageUrl || "",
                concept: c.concept || "",
                grade: c.grade || "FREE",
                rating: Number(c.rating) || 0,
                reviewCount: 0,
                participants: 0,
                viewCount: c.view_count || 0,
                createdAt: c.createdAt ? c.createdAt.toISOString() : undefined,
                isLocked: false, // applyIsLocked()에서 덮어씀
                coursePlaces: Array.isArray(c.coursePlaces)
                    ? c.coursePlaces.map((cp: any) => ({
                          order_index: cp.order_index,
                          place: cp.place
                              ? {
                                    id: cp.place.id,
                                    name: cp.place.name,
                                    imageUrl: cp.place.imageUrl,
                                    latitude: cp.place.latitude ? Number(cp.place.latitude) : undefined,
                                    longitude: cp.place.longitude ? Number(cp.place.longitude) : undefined,
                                    opening_hours: cp.place.opening_hours || null,
                                    reservationUrl: cp.place.reservationUrl || null,
                                    closed_days: cp.place.closed_days || [],
                                }
                              : null,
                      }))
                    : [],
                placesCount: c._count?.coursePlaces ?? (c.coursePlaces?.length || 0),
                tags: allTags,
            };
        });

        mapped.sort((a: any, b: any) => (gradeWeight[a.grade] || 1) - (gradeWeight[b.grade] || 1));
        return mapped;
    },
    ["nearby-courses"],
    { revalidate: 180, tags: ["nearby-courses"] }
);

// ✅ [모듈 레벨] 검색/필터 캐시 - userTier/unlockedIds 제거 → 동일 검색어라면 모든 유저 캐시 공유
        const getCachedFilteredCourses = unstable_cache(
            async (
                keyword: string,
                regionParam: string | undefined,
                concept: string | undefined,
                tagIds: string | undefined,
                isMobile: boolean,
                timeOfDay: string | null
            ) => {
                const filterConditions: any[] = [{ isPublic: true }];

                if (regionParam) {
                    const terms = buildRegionSearchTerms(regionParam);
                    if (terms.length > 0) {
                        filterConditions.push({
                            OR: terms.map((term) => ({ region: { contains: term, mode: "insensitive" } })),
                        });
                    }
                } else if (keyword) {
                    const keywords = keyword.split(/\s+/).filter(Boolean);
                    keywords.forEach((k) => {
                        const cleanKeyword = k.replace("동", "");
                        const regionTerms = buildRegionSearchTerms(cleanKeyword);
                        filterConditions.push({
                            OR: [
                                ...regionTerms.map((term) => ({
                                    region: { contains: term, mode: "insensitive" as const },
                                })),
                                { title: { contains: cleanKeyword, mode: "insensitive" } },
                                { concept: { contains: cleanKeyword, mode: "insensitive" } },
                                { description: { contains: cleanKeyword, mode: "insensitive" } },
                                {
                                    coursePlaces: {
                                        some: {
                                            place: {
                                                OR: [
                                                    { name: { contains: cleanKeyword, mode: "insensitive" } },
                                                    { address: { contains: cleanKeyword, mode: "insensitive" } },
                                                ],
                                            },
                                        },
                                    },
                                },
                            ],
                        });
                    });
                }

                if (concept) {
            filterConditions.push({ concept: { contains: concept, mode: "insensitive" } });
                }

                const whereClause = filterConditions.length > 0 ? { AND: filterConditions } : { isPublic: true };
                const takeLimit = keyword ? 200 : 30;
                const courses = await prisma.course.findMany({
                    where: whereClause,
                    orderBy: { id: "desc" },
                    take: takeLimit,
                    select: courseSelectOptions,
                });

                sortCoursesByTimeMatch(courses, timeOfDay);

        const gradeWeight: Record<string, number> = { FREE: 1, BASIC: 2, PREMIUM: 3 };

        const mapped = courses.map((c: any) => {
                    const allTags: string[] = Array.from(new Set([
                        ...(c.concept ? [c.concept] : []),
                        ...(Array.isArray(c.mood) ? c.mood : []),
                        ...(Array.isArray(c.target) ? c.target : []),
                    ]));

                    return {
                        id: String(c.id),
                        title: c.title || "",
                        description: c.description || "",
                        duration: c.duration || "",
                        location: c.region || "",
                        imageUrl: c.imageUrl || c.coursePlaces?.[0]?.place?.imageUrl || "",
                        concept: c.concept || "",
                grade: c.grade || "FREE",
                        rating: Number(c.rating) || 0,
                        reviewCount: 0,
                        participants: 0,
                        viewCount: c.view_count || 0,
                        createdAt: c.createdAt ? c.createdAt.toISOString() : undefined,
                isLocked: false, // applyIsLocked()에서 덮어씀
                        coursePlaces: Array.isArray(c.coursePlaces)
                            ? c.coursePlaces.map((cp: any) => ({
                                  order_index: cp.order_index,
                                  place: cp.place
                                      ? {
                                            id: cp.place.id,
                                            name: cp.place.name,
                                            imageUrl: cp.place.imageUrl,
                                            latitude: cp.place.latitude ? Number(cp.place.latitude) : undefined,
                                            longitude: cp.place.longitude ? Number(cp.place.longitude) : undefined,
                                            opening_hours: cp.place.opening_hours || null,
                                            reservationUrl: cp.place.reservationUrl || null,
                                            closed_days: cp.place.closed_days || [],
                                        }
                                      : null,
                              }))
                            : [],
                placesCount: c._count?.coursePlaces ?? (c.coursePlaces?.length || 0),
                        tags: allTags,
                    };
                });

        mapped.sort((a: any, b: any) => (gradeWeight[a.grade] || 1) - (gradeWeight[b.grade] || 1));
        return mapped;
    },
    ["nearby-filter"],
    { revalidate: 120, tags: ["nearby-filtered-courses"] }
);

async function getInitialNearbyCourses(searchParams: { [key: string]: string | string[] | undefined }) {
    // 1. URL 파라미터 파싱
    const q = typeof searchParams?.q === "string" ? searchParams.q : undefined;
    const regionRaw = typeof searchParams?.region === "string" ? searchParams.region : undefined;
    const region = regionRaw ? resolveNearbyRegionParam(regionRaw) : undefined;
    const keywordRaw = region ? region.trim() : (q || "").trim();
    const concept = typeof searchParams?.concept === "string" ? searchParams.concept.trim() : undefined;
    const tagIdsParam = typeof searchParams?.tagIds === "string" ? searchParams.tagIds.trim() : undefined;

    // 2. 유저 인증 (isLocked 계산용 - 캐시 키에는 포함하지 않음)
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

                    if (user?.subscriptionTier) userTier = user.subscriptionTier;
                    unlockedCourseIds = Array.isArray(unlocks) ? unlocks.map((u: any) => u.courseId) : [];
                }
            }
        } catch (e) {
            console.warn("[nearby/page.tsx] JWT 검증 실패:", e instanceof Error ? e.message : String(e));
        }
    }

    // 3. 모바일 감지
        const headersList = await headers();
        const userAgent = headersList.get("user-agent")?.toLowerCase() || "";
        const isMobilePlatform = /iphone|ipad|ipod|android/.test(userAgent);

    const timeOfDay = getTimeOfDayFromKST();
    const isDefaultLoad = !keywordRaw && !concept && !tagIdsParam;

    // 4. 캐시에서 raw 데이터 가져온 뒤 메모리에서 isLocked 적용
    if (!isDefaultLoad) {
        const raw = await getCachedFilteredCourses(
            keywordRaw,
            region,
            concept,
            tagIdsParam,
            isMobilePlatform,
            timeOfDay
        );
        return applyIsLocked(raw, userTier, unlockedCourseIds);
    }

    const raw = await getCachedDefaultNearbyCourses(isMobilePlatform, timeOfDay);
    return applyIsLocked(raw, userTier, unlockedCourseIds);
}

export default async function NearbyPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const resolvedParams = await Promise.resolve(searchParams);
    const initialCourses = await getInitialNearbyCourses(resolvedParams);

    const initialKeyword =
        (typeof resolvedParams?.q === "string" ? resolvedParams.q : "") ||
        (typeof resolvedParams?.region === "string" ? resolvedParams.region : "") ||
        "";

    return (
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
            <NearbyClient initialCourses={initialCourses} initialKeyword={initialKeyword} />
        </Suspense>
    );
}
