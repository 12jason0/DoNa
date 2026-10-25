import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";
import { SIGNUP_SOURCE_ANSWERS, SIGNUP_SOURCE_ASK_WINDOW_MS } from "@/lib/signupAttribution";

export const dynamic = "force-dynamic";

/** GET: 가입 직후 질문을 띄울지 — 답이 없고 가입한 지 하루 안 된 사용자만 */
export async function GET(req: NextRequest) {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ ask: false });
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { signupSourceAnswer: true, createdAt: true },
        });
        const ask =
            !!user && !user.signupSourceAnswer && Date.now() - user.createdAt.getTime() < SIGNUP_SOURCE_ASK_WINDOW_MS;
        return NextResponse.json({ ask });
    } catch (error) {
        captureApiError(error);
        return NextResponse.json({ ask: false });
    }
}

/** POST { answer }: 한 번만 저장 (이미 답했으면 안 덮어씀). 건너뛰기는 "skipped" */
export async function POST(req: NextRequest) {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const { answer } = await req.json().catch(() => ({}));
        if (!SIGNUP_SOURCE_ANSWERS.includes(answer)) {
            return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
        }
        await prisma.user.updateMany({
            where: { id: userId, signupSourceAnswer: null },
            data: { signupSourceAnswer: answer },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        captureApiError(error);
        return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
}
