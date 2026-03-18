import { NextRequest, NextResponse } from "next/server";
import { captureApiError } from "@/lib/sentry";

type SuggestionPayload = {
    title: string;
    location?: string;
    budget?: string;
    duration?: string;
    places?: Array<{ name: string; address?: string; note?: string }>;
    description?: string;
    imageUrl?: string;
    contact?: { email?: string; kakaoId?: string };
};

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as SuggestionPayload;

        if (!body?.title || !body?.places || body.places.length === 0) {
            return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
        }

        // 현재는 수신만 하고 저장은 추후 DB 연동 예정
        console.log("[CourseSuggestion]", {
            receivedAt: new Date().toISOString(),
            suggestion: body,
        });

        return NextResponse.json({ ok: true });
    } catch (e) {

            captureApiError(e);
        console.error("/api/course-suggestions error", e);
        return NextResponse.json({ error: "서버 오류" }, { status: 500 });
    }
}
