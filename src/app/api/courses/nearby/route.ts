import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { defaultCache } from "@/lib/cache";
import { sortCoursesByTimeMatch } from "@/lib/timeMatch";

export const dynamic = "force-dynamic";
export const revalidate = 60; // 🟢 60초 캐시

// 주요 지역 리스트 (NearbyClient와 동기화)
const majorRegions = ["압구정", "합정정", "성수", "홍대", "종로", "연남", "한남", "건대"];

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

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

    // 🟢 [Performance]: 캐시 키 생성 (필터별로 캐싱)
    const cacheKey = `nearby:${cleanKeyword || ""}:${concept || ""}:${tagIdsParam || ""}:${limit}:${offset}:${timeOfDay ?? ""}`;

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
        grade: true, // 정렬 가중치 계산용
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

    try {
        // DB에서는 우선 필터링된 결과만 가져옴
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

                return getScore(b) - getScore(a); // 점수 높은 순 정렬
            });
        }

        sortCoursesByTimeMatch(courses, timeOfDay);

        // 🟢 [Performance]: 응답 데이터 캐싱 (60초)
        await defaultCache.set(cacheKey, courses, 60 * 1000);

        return NextResponse.json(courses);
    } catch (error) {
        console.error("❌ API 오류:", error);
        return NextResponse.json({ success: false, error: "서버 오류 발생" }, { status: 500 });
    }
}
