import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/** 한국 시간 기준 오늘 dayKey (YYYY-MM-DD) */
function getDayKeyKst(): string {
    const now = new Date();
    const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    return kst.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const body = await request.json();
        const { courseId, rating, context, matchScore, matchReason, todayContext } = body;

        if (!courseId || !rating || !context) {
            return NextResponse.json(
                { error: "courseId, rating, context는 필수입니다." },
                { status: 400 },
            );
        }

        const validRatings = ["GOOD", "OK", "BAD"];
        if (!validRatings.includes(String(rating).toUpperCase())) {
            return NextResponse.json({ error: "rating은 GOOD, OK, BAD 중 하나여야 합니다." }, { status: 400 });
        }

        const cId = Number(courseId);
        if (!Number.isFinite(cId) || cId <= 0) {
            return NextResponse.json({ error: "유효하지 않은 courseId입니다." }, { status: 400 });
        }

        const ctx = String(context).slice(0, 50) || "AI_RECOMMENDATION";
        const dayKey = getDayKeyKst();

        // todayContext: JSON이면 그대로, 아니면 문자열로 저장 (JSON.parse 가능한 경우만 객체로)
        let todayContextData: unknown = null;
        if (todayContext != null) {
            if (typeof todayContext === "object") {
                todayContextData = todayContext;
            } else if (typeof todayContext === "string") {
                try {
                    todayContextData = JSON.parse(todayContext);
                } catch {
                    todayContextData = { raw: todayContext };
                }
            }
        }

        const ratingNorm = String(rating).toUpperCase() as "GOOD" | "OK" | "BAD";
        const matchScoreVal =
            typeof matchScore === "number" && Number.isFinite(matchScore) ? matchScore : null;
        const matchReasonStr =
            typeof matchReason === "string" && matchReason.length > 0
                ? matchReason.slice(0, 500)
                : null;

        await (prisma as any).recommendationFeedback.upsert({
            where: {
                unique_user_course_context_day: {
                    userId,
                    courseId: cId,
                    context: ctx,
                    dayKey,
                },
            },
            update: {
                rating: ratingNorm,
                matchScore: matchScoreVal,
                matchReason: matchReasonStr,
                todayContext: todayContextData,
            },
            create: {
                userId,
                courseId: cId,
                rating: ratingNorm,
                context: ctx,
                matchScore: matchScoreVal,
                matchReason: matchReasonStr,
                todayContext: todayContextData,
                dayKey,
            },
        });

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
            captureApiError(error);
        console.error("피드백 저장 오류:", error);
        return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
    }
}
