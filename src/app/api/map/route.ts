import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // 1. 좌표 변환
        const minLat = parseFloat(searchParams.get("minLat") || "0");
        const maxLat = parseFloat(searchParams.get("maxLat") || "0");
        const minLng = parseFloat(searchParams.get("minLng") || "0");
        const maxLng = parseFloat(searchParams.get("maxLng") || "0");

        const onlyMine = searchParams.get("onlyMine") === "true";

        // 2. 장소 검색 조건 (Place 테이블용) - null 값 제외
        const locationFilter = {
            latitude: { gte: minLat, lte: maxLat, not: null },
            longitude: { gte: minLng, lte: maxLng, not: null },
        };

        // 3. 쿼리 조건 생성
        // (1) Place 검색 조건
        let placeWhere: any = { ...locationFilter };

        // (2) Course 검색 조건 - 공개된 코스만
        let courseWhere: any = {
            isPublic: true,
            coursePlaces: {
                some: {
                    place: {
                        latitude: { gte: minLat, lte: maxLat, not: null },
                        longitude: { gte: minLng, lte: maxLng, not: null },
                    },
                },
            },
        };

        // 4. 필터 적용 ('내가 만든 것' 보기)
        if (onlyMine) {
            const userId = resolveUserId(request);
            if (userId) {
                courseWhere.userId = Number(userId);
            } else {
                return NextResponse.json({ places: [], courses: [] });
            }
        }

        // 5. 데이터 조회 (병렬 실행) - 필요한 필드만 선택하여 성능 최적화
        const [places, courses] = await Promise.all([
            // (1) 장소 검색 - 필요한 필드만 선택
            prisma.place.findMany({
                where: placeWhere,
                take: 50,
                select: {
                    id: true,
                    name: true,
                    address: true,
                    latitude: true,
                    longitude: true,
                    category: true,
                    imageUrl: true,
                    description: true,
                },
            }),

            // (2) 코스 검색 - 필요한 필드만 선택 (최소한의 join)
            prisma.course.findMany({
                where: courseWhere,
                take: 20,
                select: {
                    id: true,
                    title: true,
                    description: true,
                    imageUrl: true,
                    region: true,
                    concept: true,
                    rating: true,
                    view_count: true,
                    coursePlaces: {
                        take: 1,
                        orderBy: { order_index: "asc" },
                        select: {
                            place: {
                                select: {
                                    latitude: true,
                                    longitude: true,
                                },
                            },
                        },
                    },
                },
            }),
        ]);

        // 6. 코스 데이터 매핑 (좌표 추가) - 성능 최적화
        const mappedCourses = courses.map((course: any) => {
            const firstPlace = course.coursePlaces?.[0]?.place;
            const { coursePlaces, ...courseData } = course;
            return {
                ...courseData,
                latitude: firstPlace?.latitude || 0,
                longitude: firstPlace?.longitude || 0,
            };
        });

        return NextResponse.json({ places, courses: mappedCourses });
    } catch (error) {
        console.error("🔥 Map API Error:", error);
        return NextResponse.json({ error: "Internal Server Error", details: String(error) }, { status: 500 });
    }
}
