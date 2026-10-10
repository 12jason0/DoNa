import { NextRequest, NextResponse } from "next/server";
import { verifyAdminJwt } from "@/lib/auth";
import type { TipItem } from "@/types/tip";
import { translateTips } from "@/lib/translateTips";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    if (!verifyAdminJwt(request)) {
        return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { tips } = (await request.json()) as { tips: TipItem[] };

    if (!Array.isArray(tips) || tips.length === 0) {
        return NextResponse.json({ error: "tips 배열이 필요합니다." }, { status: 400 });
    }

    try {
        const parsed = await translateTips(tips);
        return NextResponse.json({ success: true, ...parsed });
    } catch (e) {
        return NextResponse.json({ error: "번역 응답 파싱 실패", raw: String(e) }, { status: 500 });
    }
}
