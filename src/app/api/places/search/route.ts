import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// [추가] 지역명 동의어 매핑 (사용자 입력 -> DB region)
const REGION_MAPPING: Record<string, string> = {
    // 1. 홍대/연남
    마포: "홍대/연남",
    마포구: "홍대/연남",
    홍대: "홍대/연남",
    연남: "홍대/연남",
    연남동: "홍대/연남",
    서교동: "홍대/연남",
    합정: "홍대/연남",
    망원: "홍대/연남",

    // 2. 성수
    성수: "성수",
    성수동: "성수",
    성동구: "성수",
    뚝섬: "성수",
    서울숲: "성수",

    // 3. 종로/북촌
    종로: "종로/북촌",
    종로구: "종로/북촌",
    북촌: "종로/북촌",
    삼청동: "종로/북촌",
    익선동: "종로/북촌",
    서촌: "종로/북촌",
    인사동: "종로/북촌",
    광화문: "종로/북촌",

    // 4. 을지로
    을지로: "을지로",
    을지로3가: "을지로",
    을지로4가: "을지로",
    중구: "을지로",
    명동: "을지로",
    충무로: "을지로",
    힙지로: "을지로",

    // 5. 용산
    용산: "용산",
    용산구: "용산",
    이태원: "용산",
    한남: "용산",
    한남동: "용산",
    해방촌: "용산",
    경리단길: "용산",
    신용산: "용산",
};

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const keyword = (searchParams.get("keyword") || "").trim();

    if (!keyword) {
        return NextResponse.json({ error: "키워드는 필수입니다." }, { status: 400 });
    }

    // 1. 키워드 분석 및 분리 (띄어쓰기 기준)
    const tokens = keyword.split(/\s+/).filter(Boolean); // ["성수동", "카페"]
    if (tokens.length === 0) {
        return NextResponse.json({ places: [], courses: [] });
    }

    try {
        // 2. 지역 매핑 확인 (검색어 중에 지역명이 있는지 체크)
        // 예: "마포 맛집" -> targetRegions = ["홍대/연남"]
        const targetRegions = new Set<string>();
        tokens.forEach((token) => {
            // "마포구" -> "홍대/연남" 매핑
            const mapped = REGION_MAPPING[token] || REGION_MAPPING[token.replace("구", "").replace("동", "")];
            if (mapped) targetRegions.add(mapped);
        });

        // 3. Prisma 검색 조건 생성 (AND 로직)
        // 모든 토큰이 포함되어야 함 (단, 지역명이 감지되었다면 그 지역의 코스는 지역명 토큰이 없어도 됨)
        
        // --- 코스 검색 (Course) ---
        const courseWhere: any = {
            AND: tokens.map((token) => {
                // 토큰이 지역명이면 -> region 필드에서 검색 OR 이미 targetRegions에 포함되어 있으므로 region 필터로 커버
                // 토큰이 일반 단어면 -> title, description, concept, tags, region 중 하나에 포함
                return {
                    OR: [
                        { title: { contains: token } }, // 제목에 포함
                        { description: { contains: token } }, // 설명에 포함
                        { region: { contains: token } }, // 지역명에 포함 (DB에 "홍대/연남"으로 저장됨)
                        { concept: { contains: token } }, // 컨셉에 포함
                        // 매핑된 지역명이 있다면, 해당 지역 코스도 검색 대상에 포함 (region 일치)
                        ...(REGION_MAPPING[token] ? [{ region: { contains: REGION_MAPPING[token] } }] : []),
                    ],
                };
            }),
        };

        // --- 장소 검색 (Place) ---
        const placeWhere: any = {
            AND: tokens.map((token) => ({
                OR: [
                    { name: { contains: token } },
                    { address: { contains: token } },
                    { description: { contains: token } },
                    { category: { contains: token } },
                    { tags: { array_contains: token } }, // JSON 배열 검색 (Postgres 기능 지원 시)
                ],
            })),
        };

        // 4. 병렬 DB 조회
        const [courses, places] = await Promise.all([
            prisma.course.findMany({
                where: courseWhere,
                take: 20,
                orderBy: { view_count: "desc" },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    imageUrl: true,
                    region: true,
                    concept: true,
                    rating: true,
                },
            }),
            prisma.place.findMany({
                where: placeWhere,
                take: 20,
                orderBy: { id: "desc" },
                select: {
                    id: true,
                    name: true,
                    address: true,
                    category: true,
                    imageUrl: true,
                    description: true,
                },
            }),
        ]);

        return NextResponse.json({
            success: true,
            courses,
            places,
        });
    } catch (error) {
        console.error("통합 검색 API 오류:", error);
        return NextResponse.json({ error: "검색 중 오류 발생" }, { status: 500 });
    }
}

