import { Suspense } from "react";
import NearbyClient from "./NearbyClient";
import prisma from "@/lib/db";
import { cookies } from "next/headers";
import { verifyJwtAndGetUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 🟢 성능 최적화: 1800초 -> 300초 (5분)로 단축하여 최신 데이터 반영

async function getInitialNearbyCourses(searchParams: { [key: string]: string | string[] | undefined }) {
    // 1. URL 파라미터 파싱
    const q = typeof searchParams?.q === "string" ? searchParams.q : undefined;
    const region = typeof searchParams?.region === "string" ? searchParams.region : undefined;
    const keywordRaw = (q || region || "").trim();

    const concept = typeof searchParams?.concept === "string" ? searchParams.concept.trim() : undefined;
    const tagIdsParam = typeof searchParams?.tagIds === "string" ? searchParams.tagIds.trim() : undefined;

    const andConditions: any[] = [];

    // ✅ 공개된 코스만 필터링 (모든 등급 포함: FREE, BASIC, PREMIUM)
    // FREE 유저도 모든 코스를 볼 수 있으며, 잠금은 프론트엔드에서 isLocked로 처리
    andConditions.push({ isPublic: true });

    // ✅ 장소 이름(name)과 주소(address)까지 검색 범위 확장
    if (keywordRaw) {
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

    // (C) 태그 필터
    if (tagIdsParam) {
        const tagIds = tagIdsParam
            .split(",")
            .map(Number)
            .filter((n) => !isNaN(n) && n > 0);
        if (tagIds.length > 0) {
            andConditions.push({
                courseTags: {
                    some: {
                        tagId: { in: tagIds },
                    },
                },
            });
        }
    }

    // 🟢 [조건 체크] 검색이나 필터가 없는 순수 초기 로드인지 확인
    const isDefaultLoad = !keywordRaw && !concept && !tagIdsParam;

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
                place: {
                    select: {
                        id: true,
                        name: true,
                        imageUrl: true,
                        latitude: true,
                        longitude: true,
                        opening_hours: true,
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

    // 🟢 [검색/필터 모드] 검색이나 필터가 있을 때는 기존처럼 최신순으로 30개만 가져옴
    if (!isDefaultLoad) {
        const whereClause = andConditions.length > 0 ? { AND: andConditions } : { isPublic: true };
        const courses = await prisma.course.findMany({
            where: whereClause,
            orderBy: { id: "desc" },
            take: 30,
            select: courseSelectOptions,
        });

        // 매핑 함수
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
                                }
                              : null,
                      }))
                    : [],
                tags: Array.isArray(c?.courseTags)
                    ? c.courseTags.map((ct: any) => ct?.tag?.name).filter(Boolean)
                    : [],
            };
        });

        // 등급순 정렬
        const gradeWeight: Record<string, number> = { FREE: 1, BASIC: 2, PREMIUM: 3 };
        mappedCourses.sort((a, b) => (gradeWeight[a.grade] || 1) - (gradeWeight[b.grade] || 1));

        return mappedCourses;
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
                            }
                          : null,
                  }))
                : [],
            tags: Array.isArray(c?.courseTags)
                ? c.courseTags.map((ct: any) => ct?.tag?.name).filter(Boolean)
                : [],
        };
    });

    // ✅ 6. [정렬] FREE > BASIC > PREMIUM 순서
    const gradeWeight: Record<string, number> = { FREE: 1, BASIC: 2, PREMIUM: 3 };
    mappedCourses.sort((a, b) => (gradeWeight[a.grade] || 1) - (gradeWeight[b.grade] || 1));

    return mappedCourses;
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
