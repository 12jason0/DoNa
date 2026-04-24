import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const client = new Anthropic();

export async function POST(req: NextRequest) {
    if (!verifyAdminJwt(req)) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

    const untranslated = await (prisma as any).region.findMany({
        where: { OR: [{ name_en: null }, { name_ja: null }, { name_zh: null }] },
        select: { id: true, name: true },
    });

    if (untranslated.length === 0) {
        return NextResponse.json({ success: true, updated: 0, message: "모두 번역되어 있습니다." });
    }

    const names = untranslated.map((r: { name: string }) => r.name);

    const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{
            role: "user",
            content: `Translate these Korean neighborhood names into English, Japanese, and Chinese (Simplified).
Return ONLY a JSON object mapping each Korean name to its translations, no explanation:
{
  "성수": {"en":"Seongsu","ja":"聖水","zh":"圣水"},
  ...
}

Korean names: ${JSON.stringify(names)}`,
        }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: "번역 파싱 실패" }, { status: 500 });

    const translations: Record<string, { en: string; ja: string; zh: string }> = JSON.parse(match[0]);

    let updated = 0;
    for (const region of untranslated) {
        const t = translations[region.name];
        if (!t) continue;
        await (prisma as any).region.update({
            where: { id: region.id },
            data: { name_en: t.en, name_ja: t.ja, name_zh: t.zh },
        });
        updated++;
    }

    return NextResponse.json({ success: true, updated });
}
