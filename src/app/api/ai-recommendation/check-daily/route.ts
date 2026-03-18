import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyJwtAndGetUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

/** 한국 시간 기준 오늘 날짜 문자열 (YYYY-MM-DD) */
function getTodayKst(): string {
    const now = new Date();
    const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    return kst.toISOString().slice(0, 10);
}

/** DateTime을 한국 시간 YYYY-MM-DD로 변환 */
function toDateStrKst(dt: Date): string {
    const kst = new Date(dt.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    return kst.toISOString().slice(0, 10);
}

/** 🟢 GET: 일일 사용 여부만 조회 (업데이트 없음) - 시작 버튼 클릭 시 체크용 */
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("auth")?.value;
        if (!token) return NextResponse.json({ error: "인증 토큰이 필요합니다." }, { status: 401 });

        let userId: string;
        try {
            userId = verifyJwtAndGetUserId(token);
        } catch {
            return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });
        }

        const todayStr = getTodayKst();
        const user = await prisma.user.findUnique({
            where: { id: Number(userId) },
        });

        if (!user) return NextResponse.json({ error: "유저를 찾을 수 없습니다." }, { status: 404 });

        const lastUsed = (user as { lastAiRecommendationUsedAt?: Date | null }).lastAiRecommendationUsedAt;
        const lastUsedStr = lastUsed ? toDateStrKst(lastUsed) : null;
        const canUse = lastUsedStr !== todayStr;

        return NextResponse.json({ canUse });
    } catch (err) {
            captureApiError(err);
        console.error("오늘의 데이트 추천 일일 조회 오류", err);
        return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("auth")?.value;
        if (!token) return NextResponse.json({ error: "인증 토큰이 필요합니다." }, { status: 401 });

        let userId: string;
        try {
            userId = verifyJwtAndGetUserId(token);
        } catch {
            return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });
        }

        const todayStr = getTodayKst();
        const user = await prisma.user.findUnique({
            where: { id: Number(userId) },
        });

        if (!user) return NextResponse.json({ error: "유저를 찾을 수 없습니다." }, { status: 404 });

        const lastUsed = (user as { lastAiRecommendationUsedAt?: Date | null }).lastAiRecommendationUsedAt;
        const lastUsedStr = lastUsed ? toDateStrKst(lastUsed) : null;

        if (lastUsedStr === todayStr) {
            return NextResponse.json({
                canUse: false,
                error: "오늘 이미 사용하셨습니다. 내일 다시 시도해주세요.",
            });
        }

        await prisma.user.update({
            where: { id: Number(userId) },
            data: { lastAiRecommendationUsedAt: new Date() } as { lastAiRecommendationUsedAt: Date },
        });

        return NextResponse.json({ canUse: true });
    } catch (err) {
            captureApiError(err);
        console.error("오늘의 데이트 추천 일일 제한 확인 오류", err);
        return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
    }
}
