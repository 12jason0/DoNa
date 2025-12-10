import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 통합 인증 사용

// 👇 추가된 GET 핸들러
export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        // 비로그인 사용자는 빈 배열 반환(클라이언트 에러 방지)
        if (!userId) return NextResponse.json([], { status: 200 });

        const favorites = await (prisma as any).userFavorite.findMany({
            where: { user_id: userId },
            include: {
                course: {
                    include: {
                        coursePlaces: {
                            orderBy: { order_index: "asc" },
                            select: {
                                place: { select: { imageUrl: true } },
                            },
                        },
                    },
                },
            },
        });

        // 코스 이미지 폴백 처리: 코스 imageUrl 없으면 첫 장소 이미지로 대체
        const normalized = (favorites || []).map((fav: any) => {
            const cp = Array.isArray(fav?.course?.coursePlaces) ? fav.course.coursePlaces : [];
            const firstPlaceImage =
                cp.find((it: any) => it?.place?.imageUrl)?.place?.imageUrl || null;
            // 코스 객체에 imageUrl 보강
            const course = fav?.course
                ? {
                      ...fav.course,
                      imageUrl: fav.course.imageUrl || firstPlaceImage || "",
                  }
                : null;
            return { ...fav, course };
        });

        return NextResponse.json(normalized);
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "An error occurred" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }
        const body = await request.json();
        const courseId = Number(body.courseId);

        if (!Number.isFinite(courseId)) {
            return NextResponse.json({ error: "courseId가 필요합니다." }, { status: 400 });
        }

        const existing = await (prisma as any).userFavorite.findFirst({
            where: { user_id: userId, course_id: courseId },
        });

        if (existing) {
            return NextResponse.json({ error: "Already favorited" }, { status: 409 });
        }

        await (prisma as any).userFavorite.create({
            data: {
                user_id: userId,
                course_id: courseId,
            },
        });

        // 상호작용 로그: like 기록
        try {
            await (prisma as any).userInteraction.create({
                data: { userId, courseId, action: "like" },
            });
        } catch {}

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "create error" }, { status: 500 });
    }
}
export async function DELETE(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ success: true });
        const { searchParams } = new URL(request.url);
        const courseId = Number(searchParams.get("courseId"));
        if (!Number.isFinite(courseId)) return NextResponse.json({ success: true });
        await (prisma as any).userFavorite.deleteMany({ where: { user_id: userId, course_id: courseId } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "delete error" }, { status: 500 });
    }
}
