import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";
import { clearWeekendPick, getWeekendPick, setWeekendPick } from "@/lib/weekendPick";

export const dynamic = "force-dynamic";

const pickedCourse = async () => {
    const id = await getWeekendPick();
    return id ? prisma.course.findFirst({ where: { id, isPublic: true }, select: { id: true, title: true } }) : null;
};

/** 지금 고른 주말 추천 코스 + 고를 수 있는 공개 코스 목록 */
export async function GET(req: NextRequest) {
    if (!verifyAdminJwt(req)) return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
    try {
        const [pick, courses] = await Promise.all([
            pickedCourse(),
            prisma.course.findMany({ where: { isPublic: true }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }),
        ]);
        return NextResponse.json({ pick, courses });
    } catch (error) {
        captureApiError(error);
        return NextResponse.json({ error: "불러오기 실패" }, { status: 500 });
    }
}

/** { courseId: number } 로 고르기, { courseId: null } 로 해제 */
export async function PUT(req: NextRequest) {
    if (!verifyAdminJwt(req)) return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
    try {
        const { courseId } = await req.json();
        if (courseId == null) {
            await clearWeekendPick();
            return NextResponse.json({ pick: null });
        }
        const id = Number(courseId);
        const course = Number.isInteger(id)
            ? await prisma.course.findFirst({ where: { id, isPublic: true }, select: { id: true } })
            : null;
        if (!course) return NextResponse.json({ error: "공개된 코스가 아닙니다." }, { status: 400 });

        await setWeekendPick(id);
        // 캐시 저장 실패는 조용히 넘어가므로 다시 읽어서 확인
        const pick = await pickedCourse();
        if (pick?.id !== id) return NextResponse.json({ error: "저장 실패 (Redis 확인)" }, { status: 500 });
        return NextResponse.json({ pick });
    } catch (error) {
        captureApiError(error);
        return NextResponse.json({ error: "저장 실패" }, { status: 500 });
    }
}
