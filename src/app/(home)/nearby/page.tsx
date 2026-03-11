import { Suspense } from "react";
import NearbyClient from "./NearbyClient";
import prisma from "@/lib/db";
import { cookies, headers } from "next/headers";
import { verifyJwtAndGetUserId } from "@/lib/auth";
import { unstable_cache } from "next/cache";
import { REGION_GROUPS } from "@/constants/onboardingData";
import { getTimeOfDayFromKST } from "@/lib/kst";
import { sortCoursesByTimeMatch } from "@/lib/timeMatch";

export const dynamic = "force-dynamic";
export const revalidate = 120; // 🟢 성능 최적화: 60초 -> 120초로 캐시 시간 증가

async function getInitialNearbyCourses(searchParams: { [key: string]: string | string[] | undefined }) {
    // 1. URL 파라미터 파싱
    const q = typeof searchParams?.q === "string" ? searchParams.q : undefined;
    const region = typeof searchParams?.region === "string" ? searchParams.region : undefined;
    // 🟢 [Fix]: region 파라미터가 있으면 우선 사용, 없으면 q 사용
    const keywordRaw = region ? region.trim() : (q || "").trim();

    const concept = typeof searchParams?.concept === "string" ? searchParams.concept.trim() : undefined;
    const tagIdsParam = typeof searchParams?.tagIds === "string" ? searchParams.tagIds.trim() : undefined;

    const andConditions: any[] = [];

    // ✅ 공개된 코스만 필터링 (모든 등급 포함: FREE, BASIC, PREMIUM)
    // FREE 유저도 모든 코스를 볼 수 있으며, 잠금은 프론트엔드에서 isLocked로 처리
    andConditions.push({ isPublic: true });

    // ✅ 장소 이름(name)과 주소(address)까지 검색 범위 확장
    // 🟢 [Fix]: region 파라미터가 있으면 REGION_GROUPS의 dbValues를 모두 포함하는 OR 조건 사용
    if (region) {
        // REGION_GROUPS에서 해당 region의 dbValues 찾기
        const regionGroup = REGION_GROUPS.find((g) => (g.dbValues as readonly string[]).includes(region));
        if (regionGroup) {
            // 해당 그룹의 모든 dbValues를 포함하는 OR 조건 생성
            const regionConditions: any[] = [];

            // 1. 각 dbValue로 직접 검색 (예: "홍대", "연남", "신촌")
            (regionGroup.dbValues as readonly string[]).forEach((dbValue: string) => {
                regionConditions.push({
                    region: { contains: dbValue, mode: "insensitive" },
                });
            });

            // 2. 슬래시로 구분된 조합도 검색 (예: "홍대/연남", "홍대/연남/신촌")
            // 모든 dbValues를 슬래시로 조합한 패턴도 검색
            const combinedPattern = (regionGroup.dbValues as readonly string[]).join("/");
            regionConditions.push({
                region: { contains: combinedPattern, mode: "insensitive" },
            });

            // 3. 역순 조합도 검색 (예: "연남/홍대")
            const reversedPattern = [...(regionGroup.dbValues as readonly string[])].reverse().join("/");
            if (reversedPattern !== combinedPattern) {
                regionConditions.push({
                    region: { contains: reversedPattern, mode: "insensitive" },
                });
            }

            andConditions.push({ OR: regionConditions });
        } else {
            // REGION_GROUPS에 없으면 기본 contains 검색
            andConditions.push({
                region: { contains: region, mode: "insensitive" },
            });
        }
    } else if (keywordRaw) {
        // q 파라미터만 있으면 기존 검색 로직 사용
        const keywords = keywordRaw.split(/\s+/).filter(Boolean);
        keywords.forEach((k) => {
            const cleanKeyword = k.replace("동", "");

            andConditions.push({
                OR: [
                    // 1. 코스 자체 정보 검색
                    { region: { contains: cleanKeyword, mode: "insensitive" } },
                    { title: { contains: cleanKeyword, mode: "insensitive" } },
                    { concept: { contains: cleanKeyword, mode: "insensitive" } },
                    { description: { contains: cleanKeyword, mode: "insensitive" } },

                    // 2. 코스 안에 포함된 "장소" 검색
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

    // (B) 컨셉 필터
    if (concept) {
        andConditions.push({
            concept: { contains: concept, mode: "insensitive" },
        });
    }

    // (C) 태그 필터 - 🟢 [Fix]: 여러 태그 선택 시 모든 태그를 포함하는 코스만 표시 (AND 조건)
    if (tagIdsParam) {
        const tagIds = tagIdsParam
            .split(",")
            .map(Number)
            .filter((n) => !isNaN(n) && n > 0);
        if (tagIds.length > 0) {
            // 🟢 [Fix]: 각 태그를 모두 포함해야 함 (AND 조건)
            // some 대신 every를 사용하거나, 각 태그마다 조건을 추가
            if (tagIds.length === 1) {
                // 태그가 하나면 some 사용
                andConditions.push({
                    courseTags: {
                        some: {
                            tagId: { equals: tagIds[0] },
                        },
                    },
                });
            } else {
                // 태그가 여러 개면 모든 태그를 포함해야 함
                andConditions.push({
                    AND: tagIds.map((tagId) => ({
                        courseTags: {
                            some: {
                                tagId: { equals: tagId },
                            },
                        },
                    })),
                });
            }
        }
    }

    // 🟢 [조건 체크] 검색이나 필터가 없는 순수 초기 로드인지 확인
    const isDefaultLoad = !keywordRaw && !concept && !tagIdsParam;

    const timeOfDay = getTimeOfDayFromKST();

    // 🟢 공통 select 옵션
    const courseSelectOptions = {
        id: true,
        title: true,
        description: true,
        duration: true,
        region: true,
        imageUrl: true,
        concept: true,
        grade: true,
        rating: true,
        view_count: true,
        createdAt: true,
        courseTags: { select: { tag: { select: { name: true } } } },
        coursePlaces: {
            orderBy: { order_index: "asc" as const },
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
    };

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
            console.warn("[nearby/page.tsx] JWT 검증 실패:", e instanceof Error ? e.message : String(e));
        }
    }
    const headersList = await headers();
    const userAgent = headersList.get("user-agent")?.toLowerCase() || "";
    const isMobilePlatform = /iphone|ipad|ipod|android/.test(userAgent);

    // 🟢 [검색/필터 모드] 검색이나 필터가 있을 때는 캐싱된 데이터 사용
    if (!isDefaultLoad) {
        // 🟢 [Performance]: 검색/필터 모드도 캐싱 적용
        const getCachedFilteredCourses = unstable_cache(
            async (
                keyword: string,
                regionParam: string | undefined,
                concept: string | undefined,
                tagIds: string | undefined,
                userTier: string,
                unlockedIds: number[],
                isMobile: boolean,
                timeOfDay: string | null
            ) => {
                // 🟢 검색 조건 재구성 (캐싱 함수 내부에서)
                const filterConditions: any[] = [{ isPublic: true }];

                // 🟢 [Fix]: region 파라미터가 있으면 REGION_GROUPS의 dbValues를 모두 포함하는 OR 조건 사용
                if (regionParam) {
                    // REGION_GROUPS에서 해당 region의 dbValues 찾기
                    const regionGroup = REGION_GROUPS.find((g) =>
                        (g.dbValues as readonly string[]).includes(regionParam)
                    );
                    if (regionGroup) {
                        // 해당 그룹의 모든 dbValues를 포함하는 OR 조건 생성
                        const regionConditions: any[] = [];

                        // 1. 각 dbValue로 직접 검색 (예: "홍대", "연남", "신촌")
                        (regionGroup.dbValues as readonly string[]).forEach((dbValue: string) => {
                            regionConditions.push({
                                region: { contains: dbValue, mode: "insensitive" },
                            });
                        });

                        // 2. 슬래시로 구분된 조합도 검색 (예: "홍대/연남", "홍대/연남/신촌")
                        const combinedPattern = (regionGroup.dbValues as readonly string[]).join("/");
                        regionConditions.push({
                            region: { contains: combinedPattern, mode: "insensitive" },
                        });

                        // 3. 역순 조합도 검색 (예: "연남/홍대")
                        const reversedPattern = [...(regionGroup.dbValues as readonly string[])].reverse().join("/");
                        if (reversedPattern !== combinedPattern) {
                            regionConditions.push({
                                region: { contains: reversedPattern, mode: "insensitive" },
                            });
                        }

                        filterConditions.push({ OR: regionConditions });
                    } else {
                        // REGION_GROUPS에 없으면 기본 contains 검색
                        filterConditions.push({
                            region: { contains: regionParam, mode: "insensitive" },
                        });
                    }
                } else if (keyword) {
                    const keywords = keyword.split(/\s+/).filter(Boolean);
                    keywords.forEach((k) => {
                        const cleanKeyword = k.replace("동", "");
                        filterConditions.push({
                            OR: [
                                { region: { contains: cleanKeyword, mode: "insensitive" } },
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
                    filterConditions.push({
                        concept: { contains: concept, mode: "insensitive" },
                    });
                }

                if (tagIds) {
                    const tagIdArray = tagIds
                        .split(",")
                        .map(Number)
                        .filter((n) => !isNaN(n) && n > 0);
                    if (tagIdArray.length > 0) {
                        // 🟢 [Fix]: 여러 태그 선택 시 모든 태그를 포함하는 코스만 표시 (AND 조건)
                        if (tagIdArray.length === 1) {
                            // 태그가 하나면 some 사용
                            filterConditions.push({
                                courseTags: {
                                    some: {
                                        tagId: { equals: tagIdArray[0] },
                                    },
                                },
                            });
                        } else {
                            // 태그가 여러 개면 모든 태그를 포함해야 함
                            filterConditions.push({
                                AND: tagIdArray.map((tagId) => ({
                                    courseTags: {
                                        some: {
                                            tagId: { equals: tagId },
                                        },
                                    },
                                })),
                            });
                        }
                    }
                }

                const whereClause = filterConditions.length > 0 ? { AND: filterConditions } : { isPublic: true };
                // 🟢 검색(q)일 때만 200개, 지역/컨셉/태그만 선택했을 때는 30개
                const takeLimit = keyword ? 200 : 30;
                const courses = await prisma.course.findMany({
                    where: whereClause,
                    orderBy: { id: "desc" },
                    take: takeLimit,
                    select: courseSelectOptions,
                });

                sortCoursesByTimeMatch(courses, timeOfDay);

                // 매핑 함수
                const mappedCourses = courses.map((c: any) => {
                    let isLocked = false;
                    const courseGrade = c.grade || "FREE";
                    const courseId = Number(c.id);
                    const hasUnlocked = Number.isFinite(courseId) && unlockedIds.includes(courseId);

                    if (hasUnlocked || userTier === "PREMIUM") {
                        isLocked = false;
                    } else if (userTier === "BASIC") {
                        if (courseGrade === "PREMIUM") isLocked = true;
                    } else {
                        // FREE 유저는 BASIC, PREMIUM 코스 모두 잠금
                        if (courseGrade === "BASIC" || courseGrade === "PREMIUM") isLocked = true;
                    }

                    // 🟢 courseTags 관계 테이블에서 태그 배열 생성
                    const allTags = Array.isArray(c?.courseTags)
                        ? c.courseTags.map((ct: any) => ct?.tag?.name).filter(Boolean)
                        : [];

                    return {
                        id: String(c.id),
                        title: c.title || "제목 없음",
                        description: c.description || "",
                        duration: c.duration || "",
                        location: c.region || "",
                        imageUrl: c.imageUrl || c.coursePlaces?.[0]?.place?.imageUrl || "",
                        concept: c.concept || "",
                        rating: Number(c.rating) || 0,
                        reviewCount: 0,
                        participants: 0,
                        viewCount: c.view_count || 0,
                        createdAt: c.createdAt ? c.createdAt.toISOString() : undefined,
                        grade: courseGrade,
                        isLocked: isLocked,
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
                        tags: allTags,
                    };
                });

                // 등급순 정렬
                const gradeWeight: Record<string, number> = { FREE: 1, BASIC: 2, PREMIUM: 3 };
                mappedCourses.sort((a, b) => (gradeWeight[a.grade] || 1) - (gradeWeight[b.grade] || 1));

                return mappedCourses;
            },
            [`nearby-filter-${keywordRaw || ""}-${region || ""}-${concept || ""}-${tagIdsParam || ""}-${userTier}-${timeOfDay ?? ""}`],
            {
                revalidate: 120, // 🟢 2분 캐시
                tags: ["nearby-filtered-courses"],
            }
        );

        // 🟢 iOS 플랫폼 감지 (서버 사이드)
        const headersList = await headers();
        const userAgent = headersList.get("user-agent")?.toLowerCase() || "";
        const isMobilePlatform = /iphone|ipad|ipod|android/.test(userAgent);

        return getCachedFilteredCourses(
            keywordRaw,
            region,
            concept,
            tagIdsParam,
            userTier,
            unlockedCourseIds,
            isMobilePlatform,
            timeOfDay
        );
    }

    // 🟢 [Performance]: 초기 로드 데이터 캐싱
    const getCachedDefaultNearbyCourses = unstable_cache(
        async (userTier: string, unlockedCourseIds: number[], isMobile: boolean, timeOfDay: string | null) => {
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
            const neededFromFree =
                TARGET_FREE + (TARGET_BASIC - basicArr.length) + (TARGET_PREMIUM - premiumArr.length);
            const freeArr = freeRaw.slice(0, Math.max(neededFromFree, 0));

            // 🟢 [Interleaving] 2(FREE):1(BASIC):1(PREMIUM) 패턴으로 섞기
            const interleaved: any[] = [];
            let fIdx = 0,
                bIdx = 0,
                pIdx = 0;

            while (
                interleaved.length < 30 &&
                (fIdx < freeArr.length || bIdx < basicArr.length || pIdx < premiumArr.length)
            ) {
                if (fIdx < freeArr.length) interleaved.push(freeArr[fIdx++]);
                if (fIdx < freeArr.length && interleaved.length < 30) interleaved.push(freeArr[fIdx++]); // FREE 2개
                if (bIdx < basicArr.length && interleaved.length < 30) interleaved.push(basicArr[bIdx++]); // BASIC 1개
                if (pIdx < premiumArr.length && interleaved.length < 30) interleaved.push(premiumArr[pIdx++]); // PREMIUM 1개
            }

            sortCoursesByTimeMatch(interleaved, timeOfDay);

            // 매핑 함수 적용
            const courses = interleaved;

            // 5. 데이터 매핑 & 잠금 계산 & 정렬 (공통 함수)
            const mappedCourses = courses.map((c: any) => {
                let isLocked = false;
                const courseGrade = c.grade || "FREE";
                const courseId = Number(c.id);
                const hasUnlocked = Number.isFinite(courseId) && unlockedCourseIds.includes(courseId);

                if (hasUnlocked || userTier === "PREMIUM") {
                    isLocked = false;
                } else if (userTier === "BASIC") {
                    if (courseGrade === "PREMIUM") isLocked = true;
                } else {
                    if (courseGrade === "BASIC" || courseGrade === "PREMIUM") isLocked = true;
                }

                // 🟢 courseTags 관계 테이블과 Course.tags JSON 필드를 합쳐서 태그 배열 생성
                const tagsFromRelation = Array.isArray(c?.courseTags)
                    ? c.courseTags.map((ct: any) => ct?.tag?.name).filter(Boolean)
                    : [];
                const tagsFromJson: string[] = [];
                // Course.tags JSON 필드도 확인 (concept, mood, target, budget 등)
                if (c.tags && typeof c.tags === "object" && !Array.isArray(c.tags)) {
                    const tagsJson = c.tags as any;
                    if (Array.isArray(tagsJson.concept)) tagsFromJson.push(...tagsJson.concept);
                    if (Array.isArray(tagsJson.mood)) tagsFromJson.push(...tagsJson.mood);
                    if (Array.isArray(tagsJson.target)) tagsFromJson.push(...tagsJson.target);
                    if (typeof tagsJson.budget === "string" && tagsJson.budget) tagsFromJson.push(tagsJson.budget);
                }
                const allTags = Array.from(new Set([...tagsFromRelation, ...tagsFromJson])); // 중복 제거

                return {
                    id: String(c.id),
                    title: c.title || "제목 없음",
                    description: c.description || "",
                    duration: c.duration || "",
                    location: c.region || "",
                    imageUrl: c.imageUrl || c.coursePlaces?.[0]?.place?.imageUrl || "",
                    concept: c.concept || "",
                    rating: Number(c.rating) || 0,
                    reviewCount: 0,
                    participants: 0,
                    viewCount: c.view_count || 0,
                    createdAt: c.createdAt ? c.createdAt.toISOString() : undefined,
                    grade: courseGrade,
                    isLocked: isLocked,
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
                    tags: allTags,
                };
            });

            // ✅ 6. [정렬] FREE > BASIC > PREMIUM 순서
            const gradeWeight: Record<string, number> = { FREE: 1, BASIC: 2, PREMIUM: 3 };
            mappedCourses.sort((a, b) => (gradeWeight[a.grade] || 1) - (gradeWeight[b.grade] || 1));

            return mappedCourses;
        },
        ["nearby-courses", timeOfDay ?? ""],
        {
            revalidate: 180, // 🟢 3분 캐시
            tags: ["nearby-courses"],
        }
    );

    // 🟢 [Case 2: 초기 로드 - 캐싱된 데이터 사용]
    return getCachedDefaultNearbyCourses(userTier, unlockedCourseIds, isMobilePlatform, timeOfDay);
}

export default async function NearbyPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const resolvedParams = await Promise.resolve(searchParams);
    const initialCourses = await getInitialNearbyCourses(resolvedParams);

    // 초기 검색어 (UI 표시용)
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
