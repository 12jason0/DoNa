import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const courseId = Number(id);

        if (!courseId || !Number.isFinite(courseId)) {
            return NextResponse.json({ error: "유효하지 않은 코스 ID입니다." }, { status: 400 });
        }

        // ✅ [수정됨] prisma.courses -> prisma.course
        await prisma.course.update({
            where: { id: courseId },
            data: {
                view_count: {
                    increment: 1,
                },
            },
        });

        return NextResponse.json({ message: "View count updated" }, { status: 200 });
    } catch (error) {
        if ((error as any).code === "P2025") {
            return NextResponse.json({ error: "해당 ID의 코스를 찾을 수 없습니다." }, { status: 404 });
        }

        console.error("Error updating view count:", error);
        return NextResponse.json({ error: "조회수 업데이트 중 오류가 발생했습니다." }, { status: 500 });
    }
}
