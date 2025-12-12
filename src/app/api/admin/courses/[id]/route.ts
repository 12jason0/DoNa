import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> } // Next.js 15+ 에서는 params가 Promise일 수 있음
) {
    try {
        const { id } = await params;
        const courseId = parseInt(id);

        // 코스 기본 정보 + 장소 목록(Place 정보 포함)을 한 번에 조회
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: {
                coursePlaces: {
                    orderBy: { order_index: "asc" }, // 순서대로 정렬
                    include: {
                        place: true, // 장소 상세 정보(이름, 좌표 등) 포함
                    },
                },
            },
        });

        if (!course) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        // 프론트엔드 편의를 위해 데이터 구조 정리 (선택 사항)
        const formattedCourse = {
            ...course,
            // 프론트엔드 formData.places가 기대하는 형태는 coursePlaces 배열 그대로입니다.
            // 필요하다면 여기서 필드명을 places로 바꿔서 보내도 됩니다.
            places: course.coursePlaces,
        };

        return NextResponse.json(formattedCourse);
    } catch (error) {
        console.error("코스 상세 조회 실패:", error);
        return NextResponse.json({ error: "Failed to fetch course" }, { status: 500 });
    }
}
