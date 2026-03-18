import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const storyIdParam = url.searchParams.get("storyId");
        const storyId = Number(storyIdParam);
        if (!Number.isFinite(storyId)) {
            return NextResponse.json({ error: "BAD_STORY_ID" }, { status: 400 });
        }

        const ui = await (prisma as any).storyUI.findFirst({
            where: { storyId },
            select: {
                engine_key: true,
                tokens_json: true,
                flow_json: true,
                version: true,
            },
        });

        if (!ui) {
            // UI 설정이 없으면 레거시로 폴백하도록 빈 응답
            return NextResponse.json(
                { engine: null, tokens: null, flow: null, version: null },
                { headers: { "Cache-Control": "no-store" } }
            );
        }

        // 문자열로 저장된 JSON을 안전하게 파싱
        const safeParse = (v: any) => {
            if (v == null) return null;
            if (typeof v === "string") {
                try {
                    return JSON.parse(v);
                } catch {
                    return null;
                }
            }
            return v;
        };

        return NextResponse.json(
            {
                engine: ui.engine_key,
                tokens: safeParse(ui.tokens_json) ?? null,
                flow: safeParse(ui.flow_json) ?? null,
                version: ui.version ?? 1,
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (e) {

            captureApiError(e);
        return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
    }
}
