import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const start = Date.now();
    const { searchParams } = new URL(request.url);

    // 1. 파라미터 가져오기
    const keyword = (searchParams.get("keyword") || searchParams.get("region") || searchParams.get("q") || "").trim();
    const concept = (searchParams.get("concept") || "").trim();
    const tagIdsParam = searchParams.get("tagIds") || "";
    // 🟢 무한 스크롤을 위한 offset/limit 추가
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 100) : 30;
    const offset = offsetParam ? Math.max(Number(offsetParam), 0) : 0;

    console.log(`[API] 필터요청: 키워드="${keyword}" / 컨셉="${concept}" / 태그="${tagIdsParam}" / limit=${limit} / offset=${offset}`);

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
    // 🟢 공개된 코스만 필터링
    // ✅ 공개된 코스만 필터링 (모든 등급 포함: FREE, BASIC, PREMIUM)
    // FREE 유저도 모든 코스를 볼 수 있으며, 잠금은 프론트엔드에서 isLocked로 처리
    andConditions.push({ isPublic: true });
    const whereClause = andConditions.length > 0 ? { AND: andConditions } : { isPublic: true };

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
        // 🟢 무한 스크롤을 위한 offset/limit 적용
        const courses = await prisma.course.findMany({
            where: whereClause,
            orderBy: { id: "desc" },
            take: limit,
            skip: offset,
            select: courseSelect,
        });

        console.log(`✅ 응답: ${courses.length}개 찾음 (limit=${limit}, offset=${offset})`);
        return NextResponse.json(courses); // 🟢 배열로 직접 반환 (기존 API와 호환)
    } catch (error) {
        console.error("❌ API 오류:", error);
        return NextResponse.json({ success: false, error: "서버 오류 발생" }, { status: 500 });
    }
}
