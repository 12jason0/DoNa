import Anthropic from "@anthropic-ai/sdk";
import type { TipItem } from "@/types/tip";

export type TranslatedTips = { tips_en: TipItem[]; tips_ja: TipItem[]; tips_zh: TipItem[]; usage: { input: number; output: number } };

/** 한국어 팁 → 영·일·중 번역 (관리자 코스 화면 번역 버튼과 팁 검수 승인에서 같이 씀) */
export async function translateTips(tips: TipItem[]): Promise<TranslatedTips> {
    const prompt = `You are a professional translator for a Korean date course app called DoNa.
Translate the following Korean place tips into English, Japanese, and Traditional Chinese (Taiwan).

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

    const message = await new Anthropic().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("번역 응답 파싱 실패: " + raw.slice(0, 200));
    return { ...JSON.parse(jsonMatch[0]), usage: { input: message.usage.input_tokens, output: message.usage.output_tokens } };
}
