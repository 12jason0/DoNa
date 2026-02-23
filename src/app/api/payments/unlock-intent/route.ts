import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 🟢 productId별 허용 코스 등급 (course.grade 기준)
// course_basic: FREE, BASIC 코스 FULL 열기 | course_premium: FREE, BASIC, PREMIUM 전부 허용
const PRODUCT_ALLOWED_GRADES: Record<string, string[]> = {
    course_basic: ["FREE", "BASIC"],
    course_premium: ["FREE", "BASIC", "PREMIUM"],
};

// productId → planId (UnlockIntent 저장용)
const PRODUCT_TO_PLAN: Record<string, string> = {
    course_basic: "ticket_basic",
    course_premium: "ticket_premium",
};

export async function POST(req: NextRequest) {
    try {
        const userId = resolveUserId(req);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const body = await req.json();
        const { courseId, productId, unlockTarget } = body as {
            courseId?: number;
            productId?: string;
            unlockTarget?: string;
        };

        if (!courseId || !productId) {
            return NextResponse.json(
                { error: "courseId, productId는 필수입니다." },
                { status: 400 }
            );
        }

        const courseIdNum = Number(courseId);
        if (!courseIdNum || isNaN(courseIdNum)) {
            return NextResponse.json({ error: "유효하지 않은 courseId입니다." }, { status: 400 });
        }

        if (!["course_basic", "course_premium"].includes(productId)) {
            return NextResponse.json({ error: "유효하지 않은 productId입니다." }, { status: 400 });
        }

        const allowedGrades = PRODUCT_ALLOWED_GRADES[productId];
        const planId = PRODUCT_TO_PLAN[productId];

        // 코스 존재 여부 및 productId 허용 검증
        const course = await prisma.course.findUnique({
            where: { id: courseIdNum },
            select: { id: true, grade: true },
        });
        if (!course) {
            return NextResponse.json({ error: "코스를 찾을 수 없습니다." }, { status: 404 });
        }

        const courseGrade = (course.grade || "FREE").toUpperCase();
        if (!allowedGrades.includes(courseGrade)) {
            return NextResponse.json(
                {
                    error:
                        productId === "course_basic"
                            ? "BASIC 열람권으로는 PREMIUM 코스를 열람할 수 없습니다."
                            : "허용되지 않은 코스입니다.",
                },
                { status: 400 }
            );
        }

        // UnlockIntent 생성 (planId, courseGrade는 기록용)
        const intent = await (prisma as any).unlockIntent.create({
            data: {
                userId,
                courseId: courseIdNum,
                courseGrade,
                planId,
                status: "PENDING",
            },
        });

        return NextResponse.json({
            intentId: intent.id,
            courseId: courseIdNum,
            planId,
        });
    } catch (e: any) {
        console.error("[unlock-intent] Error:", e);
        return NextResponse.json(
            { error: e?.message || "서버 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}
