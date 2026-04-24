import { NextRequest, NextResponse } from "next/server";
import { verifyAdminJwt } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import type { TipItem } from "@/types/tip";

export const dynamic = "force-dynamic";

const client = new Anthropic();

export async function POST(request: NextRequest) {
    if (!verifyAdminJwt(request)) {
        return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { tips } = (await request.json()) as { tips: TipItem[] };

    if (!Array.isArray(tips) || tips.length === 0) {
        return NextResponse.json({ error: "tips 배열이 필요합니다." }, { status: 400 });
    }

    const prompt = `You are a professional translator for a Korean date course app called DoNa.
Translate the following Korean place tips into English, Japanese, and Chinese (Simplified).

Rules:
- Keep the translation natural and culturally appropriate for each language
- Maintain the same tone (friendly, helpful travel tips)
- Do NOT translate the category field — keep it exactly as-is
- Return ONLY a valid JSON object in this exact format, no explanation:
{
  "tips_en": [{"category": "...", "content": "..."}],
  "tips_ja": [{"category": "...", "content": "..."}],
  "tips_zh": [{"category": "...", "content": "..."}]
}

Korean tips to translate:
${JSON.stringify(tips, null, 2)}`;

    const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";

    let parsed: { tips_en: TipItem[]; tips_ja: TipItem[]; tips_zh: TipItem[] };
    try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in response");
        parsed = JSON.parse(jsonMatch[0]);
    } catch {
        return NextResponse.json({ error: "번역 응답 파싱 실패", raw }, { status: 500 });
    }

    return NextResponse.json({ success: true, ...parsed });
}
