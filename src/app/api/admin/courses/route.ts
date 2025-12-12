import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const courses = await prisma.course.findMany({
            orderBy: {
                createdAt: "desc",
            },
            include: {
                // ✅ 수정된 부분: coursePlaces 안에서 place를 또 include 해야 합니다.
                coursePlaces: {
                    orderBy: {
                        order_index: "asc", // 기왕이면 순서대로 가져오기
                    },
                    include: {
                        place: true, // 👈 핵심! 이걸 해야 장소 이름(name), 카테고리 등을 가져옵니다.
                    },
                },
            },
        });

        const formattedCourses = courses.map((course) => ({
            ...course,
            placesCount: course.coursePlaces.length,
            // 프론트엔드 코드(formData.places)와 이름을 맞추려면 아래처럼 매핑해줘도 좋습니다.
            // 하지만 프론트에서 coursePlaces를 쓴다면 그대로 두셔도 됩니다.
            places: course.coursePlaces,
        }));

        return NextResponse.json(formattedCourses);
    } catch (error) {
        console.error("코스 목록 불러오기 실패:", error);
        return NextResponse.json({ error: "코스 목록을 가져오지 못했습니다." }, { status: 500 });
    }
}
