import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { defaultCache } from "@/lib/cache";
import { sortCoursesByTimeMatch } from "@/lib/timeMatch";
import { captureApiError } from "@/lib/sentry";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 60; // 🟢 60초 캐시

// 주요 지역 리스트 (NearbyClient와 동기화)
const majorRegions = ["압구정", "합정정", "성수", "홍대", "종로", "연남", "한남", "건대"];

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    // 유저 인증 및 tier/열람권 조회
    const userId = resolveUserId(request);
    let userTier = "FREE";
    let unlockedCourseIds: number[] = [];
    if (userId && Number.isFinite(userId)) {
        const [userResult, unlocksResult] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId }, select: { subscriptionTier: true } }).catch(() => null),
            (prisma as any).courseUnlock.findMany({ where: { userId }, select: { courseId: true } }).catch(() => []),
        ]);
        if (userResult?.subscriptionTier) userTier = userResult.subscriptionTier;
        unlockedCourseIds = Array.isArray(unlocksResult) ? unlocksResult.map((u: any) => Number(u.courseId)) : [];
    }

    // 1. 파라미터 가져오기 및 클리닝
    const rawKeyword = (
        searchParams.get("keyword") ||
        searchParams.get("region") ||
        searchParams.get("q") ||
        ""
    ).trim();
    const cleanKeyword = rawKeyword.replace(/동$/, ""); // "성수동" -> "성수"

    const concept = (searchParams.get("concept") || "").trim();
    const tagIdsParam = searchParams.get("tagIds") || "";

    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 100) : 30;
    const offset = offsetParam ? Math.max(Number(offsetParam), 0) : 0;

    const timeOfDayParam = (searchParams.get("timeOfDay") || "").trim();
    const timeOfDay: "점심" | "저녁" | "야간" | null =
        timeOfDayParam === "점심" || timeOfDayParam === "저녁" || timeOfDayParam === "야간"
            ? timeOfDayParam
            : null;

    // 2. 검색 조건 구성
    const andConditions: any[] = [];

    // [방법 A] 키워드 검색 로직 개선
    if (cleanKeyword) {
        const isMajorRegion = majorRegions.includes(cleanKeyword);

        andConditions.push({
            OR: [
                { region: { contains: cleanKeyword, mode: "insensitive" } },
                { title: { contains: cleanKeyword, mode: "insensitive" } },
                {
                    coursePlaces: {
                        some: {
                            place: {
                                OR: [
                                    { address: { contains: cleanKeyword, mode: "insensitive" } },
                                    // 💡 지역명 검색("홍대")일 때는 장소명("홍대개미") 검색을 제외하여 노이즈 제거
                                    ...(isMajorRegion
                                        ? []
                                        : [{ name: { contains: cleanKeyword, mode: "insensitive" } }]),
                                ],
                            },
                        },
                    },
                },
            ],
        });
    }

    if (concept) {
        andConditions.push({
            concept: { contains: concept, mode: "insensitive" },
        });
    }

    if (tagIdsParam) {
        const tagIds = tagIdsParam
            .split(",")
            .map(Number)
            .filter((n) => !isNaN(n) && n > 0);
        if (tagIds.length > 0) {
            // 스크마에 따라 courseTags 또는 tags로 맞춤 (제공된 코드 기준 tags)
            andConditions.push({
                tags: {
                    some: {
                        id: { in: tagIds },
                    },
                },
            });
        }
    }

    // 공개된 코스만 필터링
    andConditions.push({ isPublic: true });
    const whereClause = { AND: andConditions };

    // isLocked 계산 헬퍼
    const computeIsLocked = (courseId: number, grade: string): boolean => {
        if (unlockedCourseIds.includes(courseId)) return false;
        if (userTier === "PREMIUM") return false;
        if (userTier === "BASIC") return grade === "PREMIUM";
        return grade === "BASIC" || grade === "PREMIUM";
    };

    // 🟢 [Performance]: 캐시 키 생성 (유저 tier 포함)
    const cacheKey = `nearby:${userTier}:${cleanKeyword || ""}:${concept || ""}:${tagIdsParam || ""}:${limit}:${offset}:${timeOfDay ?? ""}`;

    // 🟢 캐시에서 먼저 확인
    const cached = await defaultCache.get<any[]>(cacheKey);
    if (cached) {
        return NextResponse.json(cached);
    }

    const courseSelect = {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        region: true,
        concept: true,
        grade: true,
        rating: true,
        view_count: true,
        duration: true,
        target: true,
        mood: true,
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
                        address: true,
                        reservationUrl: true,
                        opening_hours: true,
                        closed_days: {
                            select: { day_of_week: true, specific_date: true, note: true },
                        },
                    },
                },
            },
        },
    };

    const isDefaultLoad = !cleanKeyword && !concept && !tagIdsParam && offset === 0;

    try {
        // 기본 로드: FREE×2, BASIC×1, PREMIUM×1 인터리빙
        if (isDefaultLoad) {
            const allRaw = await prisma.course.findMany({
                where: whereClause,
                orderBy: { id: "desc" },
                take: 60,
                select: courseSelect,
            });

            const freeArr = allRaw.filter((c: any) => (c.grade ?? "FREE") === "FREE");
            const basicArr = allRaw.filter((c: any) => c.grade === "BASIC");
            const premiumArr = allRaw.filter((c: any) => c.grade === "PREMIUM");

            const interleaved: any[] = [];
            let f = 0, b = 0, p = 0;
            while (
                interleaved.length < limit &&
                (f < freeArr.length || b < basicArr.length || p < premiumArr.length)
            ) {
                if (f < freeArr.length) interleaved.push(freeArr[f++]);
                if (f < freeArr.length && interleaved.length < limit) interleaved.push(freeArr[f++]);
                if (b < basicArr.length && interleaved.length < limit) interleaved.push(basicArr[b++]);
                if (p < premiumArr.length && interleaved.length < limit) interleaved.push(premiumArr[p++]);
            }

            sortCoursesByTimeMatch(interleaved, timeOfDay);
            const interleavedWithLock = interleaved.map((c: any) => ({
                ...c,
                isLocked: computeIsLocked(Number(c.id), c.grade ?? "FREE"),
            }));
            await defaultCache.set(cacheKey, interleavedWithLock, 60 * 1000);
            return NextResponse.json(interleavedWithLock);
        }

        // 검색/필터 있을 때: 관련도 순서 유지
        const courses = await prisma.course.findMany({
            where: whereClause,
            orderBy: { id: "desc" },
            take: limit,
            skip: offset,
            select: courseSelect,
        });

        // [방법 B] 서버 사이드 가중치 정렬 (Weighted Sorting)
        if (cleanKeyword) {
            courses.sort((a: any, b: any) => {
                const getScore = (course: any) => {
                    let score = 0;

                    // 1순위: 지역 필드(region)가 검색어와 정확히 일치 (+100점)
                    if (course.region === cleanKeyword) score += 100;
                    // 2순위: 지역 필드에 검색어가 포함됨 (+50점)
                    else if (course.region?.includes(cleanKeyword)) score += 50;

                    // 3순위: 제목에 검색어가 포함됨 (+20점)
                    if (course.title?.includes(cleanKeyword)) score += 20;

                    // 4순위: 주소에 지역명이 포함됨 (+10점)
                    const hasKeywordInAddress = course.coursePlaces?.some((cp: any) =>
                        cp.place?.address?.includes(cleanKeyword)
                    );
                    if (hasKeywordInAddress) score += 10;

                    return score;
                };

                return getScore(b) - getScore(a);
            });
        }

        sortCoursesByTimeMatch(courses, timeOfDay);
        const coursesWithLock = courses.map((c: any) => ({
            ...c,
            isLocked: computeIsLocked(Number(c.id), c.grade ?? "FREE"),
        }));
        await defaultCache.set(cacheKey, coursesWithLock, 60 * 1000);
        return NextResponse.json(coursesWithLock);
    } catch (error) {
            captureApiError(error);
        console.error("❌ API 오류:", error);
        return NextResponse.json({ success: false, error: "서버 오류 발생" }, { status: 500 });
    }
}
