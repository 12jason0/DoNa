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

        // 2. 장소 검색 조건 (Place 테이블용)
        const locationFilter = {
            latitude: { gte: minLat, lte: maxLat },
            longitude: { gte: minLng, lte: maxLng },
        };

        // 3. 쿼리 조건 생성
        // (1) Place 검색 조건
        let placeWhere: any = { ...locationFilter };

        // (2) Course 검색 조건
        // ⭐️ [수정] course_places -> coursePlaces (Prisma 모델명 사용)
        let courseWhere: any = {
            coursePlaces: {
                some: {
                    place: {
                        ...locationFilter,
                    },
                },
            },
        };

        // 4. 필터 적용 ('내가 만든 것' 보기)
        if (onlyMine) {
            const userId = resolveUserId(request);
            if (userId) {
                // [체크] userId 필드명 확인 (에러 없으면 통과)
                placeWhere.userId = userId;
                courseWhere.userId = userId;
            } else {
                return NextResponse.json({ places: [], courses: [] });
            }
        }

        // 5. 데이터 조회 (병렬 실행)
        const [places, courses] = await Promise.all([
            // (1) 장소 검색
            prisma.place.findMany({
                where: placeWhere,
                take: 50,
            }),

            // (2) 코스 검색
            prisma.course.findMany({
                where: courseWhere,
                take: 20,
                include: {
                    // ⭐️ [수정] course_places -> coursePlaces
                    coursePlaces: {
                        take: 1,
                        // 🚨 만약 여기서도 에러나면 'order_index'를 'orderIndex'로 바꿔보세요!
                        orderBy: { order_index: "asc" },
                        include: {
                            place: true,
                        },
                    },
                },
            }),
        ]);

        // 6. 코스 데이터 매핑 (좌표 추가)
        const mappedCourses = courses.map((course: any) => {
            // ⭐️ [수정] 여기도 coursePlaces로 접근해야 합니다.
            const firstPlace = course.coursePlaces?.[0]?.place;
            return {
                ...course,
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
