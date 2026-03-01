/**
 * GET /api/translate?text=...&targetLang=en|ja|zh
 * DeepL API로 텍스트 번역 (DEEPL_AUTH_KEY 있을 때만)
 * 키 없으면 원문 반환
 */

import { NextRequest, NextResponse } from "next/server";

const DEEPL_TARGET: Record<string, string> = { en: "EN", ja: "JA", zh: "ZH" };

export async function GET(request: NextRequest) {
    const text = request.nextUrl.searchParams.get("text");
    const targetLang = request.nextUrl.searchParams.get("targetLang") || "en";

    if (!text?.trim()) {
        return NextResponse.json({ translated: "" });
    }

    const authKey = process.env.DEEPL_AUTH_KEY;
    if (!authKey || !DEEPL_TARGET[targetLang]) {
        return NextResponse.json({ translated: text });
    }

    try {
        const form = new URLSearchParams({
            text: text.trim(),
            target_lang: DEEPL_TARGET[targetLang],
            source_lang: "KO",
        });
        const res = await fetch("https://api-free.deepl.com/v2/translate", {
            method: "POST",
            headers: {
                Authorization: `DeepL-Auth-Key ${authKey}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
        });
        if (!res.ok) return NextResponse.json({ translated: text });
        const data = await res.json();
        const translated = data.translations?.[0]?.text || text;
        return NextResponse.json({ translated });
    } catch {
        return NextResponse.json({ translated: text });
    }
}
