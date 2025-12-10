import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const start = Date.now();
    const { searchParams } = new URL(request.url);

    // 1. 파라미터 가져오기
    const keyword = (searchParams.get("keyword") || searchParams.get("region") || "").trim();
    const concept = (searchParams.get("concept") || "").trim();
    const tagIdsParam = searchParams.get("tagIds") || "";

    console.log(`[API] 필터요청: 키워드="${keyword}" / 컨셉="${concept}" / 태그="${tagIdsParam}"`);

    // 2. 검색 조건 구성 (AND 조건으로 하나씩 추가)
    const andConditions: any[] = [];

    // (A) 키워드 검색 (지역, 제목, 장소명, 주소)
    if (keyword) {
        andConditions.push({
            OR: [
                { region: { contains: keyword, mode: "insensitive" } },
                { title: { contains: keyword, mode: "insensitive" } },
                {
                    coursePlaces: {
                        some: {
                            place: {
                                OR: [
                                    { address: { contains: keyword, mode: "insensitive" } },
                                    { name: { contains: keyword, mode: "insensitive" } },
                                ],
                            },
                        },
                    },
                },
            ],
        });
    }

    // (B) 컨셉 필터
    if (concept) {
        andConditions.push({
            concept: { contains: concept, mode: "insensitive" },
        });
    }

    // (C) 태그 필터 (이 부분이 없어서 작동 안 했던 것!)
    if (tagIdsParam) {
        const tagIds = tagIdsParam
            .split(",")
            .map(Number)
            .filter((n) => !isNaN(n) && n > 0);
        if (tagIds.length > 0) {
            // 🚨 중요: 본인 DB 스키마에 따라 아래 'tags'를 'courseTags' 등으로 바꿔야 할 수도 있음
            // 일반적인 다대다 관계라면 'tags'가 맞습니다.
            andConditions.push({
                tags: {
                    some: {
                        id: { in: tagIds },
                    },
                },
            });
        }
    }

    // 3. 최종 Where 절 만들기
    // 조건이 하나라도 있으면 AND로 묶고, 없으면 빈 객체(전체 검색)
    const whereClause = andConditions.length > 0 ? { AND: andConditions } : {};

    // 4. Select 옵션 (동일)
    const courseSelect = {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        region: true,
        concept: true,
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
                        address: true,
                    },
                },
            },
        },
    };

    try {
        const courses = await prisma.course.findMany({
            where: whereClause,
            orderBy: { id: "desc" },
            select: courseSelect,
        });

        console.log(`✅ 응답: ${courses.length}개 찾음`);
        return NextResponse.json({ success: true, courses });
    } catch (error) {
        console.error("❌ API 오류:", error);
        return NextResponse.json({ success: false, error: "서버 오류 발생" }, { status: 500 });
    }
}
