import { NextRequest, NextResponse } from "next/server";
import { verifyAdminJwt } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const client = new Anthropic();

export async function POST(request: NextRequest) {
    if (!verifyAdminJwt(request)) {
        return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { title, sub_title, description } = (await request.json()) as {
        title?: string;
        sub_title?: string;
        description?: string;
    };

    if (!title?.trim() && !sub_title?.trim() && !description?.trim()) {
        return NextResponse.json({ error: "번역할 내용이 없습니다." }, { status: 400 });
    }

    const fields: Record<string, string> = {};
    if (title?.trim()) fields.title = title.trim();
    if (sub_title?.trim()) fields.sub_title = sub_title.trim();
    if (description?.trim()) fields.description = description.trim();

    const prompt = `You are a professional translator for a Korean date course app called DoNa.
Translate the following Korean course fields into English, Japanese, and Chinese (Simplified).

Rules:
- Keep translations natural and appealing for each language's culture
- title: short, catchy (under ~30 chars in EN, adapt length naturally for JA/ZH)
- sub_title: punchy marketing copy like the Korean original
- description: friendly, inviting tone
- Return ONLY a valid JSON object in this exact format, no explanation:
{
  "en": { "title": "...", "sub_title": "...", "description": "..." },
  "ja": { "title": "...", "sub_title": "...", "description": "..." },
  "zh": { "title": "...", "sub_title": "...", "description": "..." }
}
Only include keys that exist in the input (skip missing fields entirely).

Korean fields to translate:
${JSON.stringify(fields, null, 2)}`;

    const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";

    let parsed: {
        en: { title?: string; sub_title?: string; description?: string };
        ja: { title?: string; sub_title?: string; description?: string };
        zh: { title?: string; sub_title?: string; description?: string };
    };
    try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in response");
        parsed = JSON.parse(jsonMatch[0]);
    } catch {
        return NextResponse.json({ error: "번역 응답 파싱 실패", raw }, { status: 500 });
    }

    return NextResponse.json({ success: true, ...parsed });
}
