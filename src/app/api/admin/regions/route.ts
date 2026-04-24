import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const client = new Anthropic();

async function translateRegionName(name: string): Promise<{ name_en: string; name_ja: string; name_zh: string }> {
    const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [{
            role: "user",
            content: `Translate this Korean neighborhood/district name into English, Japanese, and Chinese (Simplified). Return ONLY a JSON object, no explanation:
{"en":"...","ja":"...","zh":"..."}

Korean name: ${name}`,
        }],
    });
    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("번역 파싱 실패");
    const parsed = JSON.parse(match[0]);
    return { name_en: parsed.en, name_ja: parsed.ja, name_zh: parsed.zh };
}

export async function GET(req: NextRequest) {
    if (!verifyAdminJwt(req)) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    const regions = await (prisma as any).region.findMany({
        orderBy: [{ display_order: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(regions);
}

export async function POST(req: NextRequest) {
    if (!verifyAdminJwt(req)) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "지역 이름이 필요합니다." }, { status: 400 });

    const last = await (prisma as any).region.findFirst({ orderBy: { display_order: "desc" } });
    const nextOrder = last ? last.display_order + 1 : 1;

    let translations = { name_en: null as string | null, name_ja: null as string | null, name_zh: null as string | null };
    try {
        const t = await translateRegionName(name.trim());
        translations = t;
    } catch {
        // 번역 실패해도 지역 추가는 진행
    }

    try {
        const region = await (prisma as any).region.create({
            data: { name: name.trim(), display_order: nextOrder, ...translations },
        });
        return NextResponse.json(region, { status: 201 });
    } catch {
        return NextResponse.json({ error: "이미 존재하는 지역입니다." }, { status: 409 });
    }
}
