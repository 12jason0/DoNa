import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 관리자 인증 체크 헬퍼 함수
function ensureAdmin(req: NextRequest) {
    const ok = req.cookies.get("admin_auth")?.value === "true";
    if (!ok) {
        throw new Error("ADMIN_ONLY");
    }
}

export async function GET(
    req: NextRequest,
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

// 🟢 코스 수정 API (관리자 전용)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // 관리자 인증 체크
        ensureAdmin(req);

        const { id } = await params;
        const courseId = parseInt(id);

        if (!courseId || isNaN(courseId)) {
            return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
        }

        const body = await req.json().catch(() => ({}));
        const {
            title,
            description,
            duration,
            location,
            region,
            imageUrl,
            concept,
            sub_title,
            target_situation,
            is_editor_pick,
            grade,
            isPublic,
            tags,
        } = body || {};

        // 🟢 [Fix]: region 또는 location 둘 다 처리 (프론트엔드는 region을 보냄)
        const regionValue = region !== undefined ? region : location;

        const updated = await prisma.course.update({
            where: { id: courseId },
            data: {
                ...(title !== undefined ? { title } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(duration !== undefined ? { duration } : {}),
                ...(regionValue !== undefined ? { region: regionValue } : {}),
                ...(imageUrl !== undefined ? { imageUrl } : {}),
                ...(concept !== undefined ? { concept } : {}),
                ...(sub_title !== undefined ? { sub_title } : {}),
                ...(target_situation !== undefined ? { target_situation } : {}),
                ...(is_editor_pick !== undefined ? { is_editor_pick } : {}),
                ...(grade !== undefined ? { grade } : {}),
                ...(isPublic !== undefined ? { isPublic } : {}),
                ...(tags !== undefined ? { tags } : {}),
            },
            select: {
                id: true,
                title: true,
                description: true,
                duration: true,
                region: true,
                imageUrl: true,
                concept: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({ success: true, course: updated });
    } catch (error: any) {
        if (error.message === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
        }
        console.error("API: 코스 수정 오류:", error);
        return NextResponse.json({ error: "코스 수정 실패" }, { status: 500 });
    }
}
