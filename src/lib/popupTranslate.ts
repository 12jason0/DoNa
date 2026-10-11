// 팝업·전시 장소 이름·주소 다국어 (기존 places.name_*/address_* 칸, 자동채우기와 같은 haiku)
// 이름은 고유명사라 번역하지 않음: 블로그 자료에 공식 영문명이 그대로 있으면 name_en, 없으면 원문 유지
// 빈 칸만 채움: 관리자가 직접 넣은 이름·주소 번역은 덮어쓰지 않음
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/db";
import { logTipRun } from "@/lib/tipPipeline";

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** AI가 고른 영문명이 실제 자료에 그대로 있을 때만 인정 (지어낸 이름 방지) */
export function verifyOfficialName(candidate: unknown, texts: string[]): string | null {
    if (typeof candidate !== "string") return null;
    const name = candidate.trim();
    if (name.length < 2 || !/[A-Za-z]/.test(name)) return null;
    return texts.some((t) => squash(t).includes(squash(name))) ? name : null;
}

export async function translatePopupFields(placeId: number) {
    const place = await prisma.place.findUniqueOrThrow({
        where: { id: placeId },
        select: { name: true, address: true, name_en: true, name_ja: true, name_zh: true, address_en: true, address_ja: true, address_zh: true },
    });
    const sources = await prisma.tipSource.findMany({
        where: { place_id: placeId, relevant: true, source_type: { not: "google_review" } },
        select: { title: true, content: true },
        take: 30,
    });
    const texts = sources.map((s) => `${s.title ?? ""} ${s.content ?? ""}`);

    let ai: { official_en_name?: unknown; address_en?: string; address_ja?: string; address_zh?: string } = {};
    let tokens = { input: 0, output: 0 };
    if (texts.length > 0 || place.address) {
        const prompt = [
            `팝업·전시 이름: ${place.name}`,
            place.address ? `주소(한국어): ${place.address}` : "",
            "",
            "1) 아래 자료에 이 팝업의 공식 영문명이 '그대로' 적혀 있으면 그 문자열을 official_en_name에 그대로 복사하세요.",
            "   자료에 없으면 null. 직접 번역하거나 로마자로 바꾸지 마세요.",
            place.address ? "2) 주소를 address_en(로마자 표기), address_ja(일본어), address_zh(중국어 간체)로 옮기세요." : "",
            "",
            'JSON만 응답: {"official_en_name": string|null' + (place.address ? ', "address_en": "...", "address_ja": "...", "address_zh": "..."' : "") + "}",
            "",
            "자료:",
            ...texts.map((t, i) => `[${i + 1}] ${t.slice(0, 400)}`),
        ]
            .filter((l) => l !== "")
            .join("\n");
        const t0 = new Date();
        const message = await new Anthropic().messages.create(
            { model: "claude-haiku-4-5-20251001", max_tokens: 1000, messages: [{ role: "user", content: prompt }] },
            { timeout: 60_000 }
        );
        tokens = { input: message.usage.input_tokens, output: message.usage.output_tokens };
        await logTipRun({ place_id: placeId, kind: "translate", started_at: t0, finished_at: new Date(), input_tokens: tokens.input, output_tokens: tokens.output });
        const raw = message.content[0].type === "text" ? message.content[0].text : "";
        const json = raw.match(/\{[\s\S]*\}/);
        if (json) ai = JSON.parse(json[0]);
    }

    const official = verifyOfficialName(ai.official_en_name, texts);
    const auto: Record<string, string | null> = {
        name_en: official ?? place.name,
        name_ja: place.name,
        name_zh: place.name,
        ...(place.address ? { address_en: ai.address_en || null, address_ja: ai.address_ja || null, address_zh: ai.address_zh || null } : {}),
    };
    const data = Object.fromEntries(Object.entries(auto).filter(([k]) => !place[k as keyof typeof place]?.trim()));
    if (Object.keys(data).length) await prisma.place.update({ where: { id: placeId }, data });
    return { ...data, officialFound: !!official, tokens };
}
