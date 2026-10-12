// 팁 활동 가격: 근거 글에 실제로 적힌 금액인지 확인. 서버(팁 생성)·검수 화면 공통이라 import 없음

/** tip_candidates.price: 체험·대여·클래스 같은 활동 팁만 (아니면 null) */
export type TipPrice = {
    value: string | null; // 쓴 가격 (근거에서 확인된 것 중 가장 최근 글). null = 가격 확인 필요
    source_id: number | null;
    written_at: string | null;
    others: { value: string; source_id: number; written_at: string | null }[]; // 다른 근거의 다른 가격
    unverified: { value: string; source_id: number }[]; // AI가 댔지만 그 근거 글에서 숫자를 못 찾은 가격
};

/**
 * 글 속 원화 금액들: "10,000원" "1만원" "1만 5천원" "1.5만원" "5천원" → 원 단위 숫자.
 * "원"이 붙은 것만 (1만명·5천보 같은 건 금액 아님). 단위 변환만 하고 더하기·곱하기 계산은 안 함
 */
export function moneyAmounts(text: string): number[] {
    const out: number[] = [];
    let rest = text.replace(/(\d+(?:\.\d+)?)\s*만\s*(?:(\d+)\s*천\s*)?원/g, (_, man, chun) => {
        out.push(Math.round(Number(man) * 10000 + (chun ? Number(chun) * 1000 : 0)));
        return " ";
    });
    rest = rest.replace(/(\d+)\s*천\s*원/g, (_, chun) => {
        out.push(Number(chun) * 1000);
        return " ";
    });
    for (const m of rest.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/g)) out.push(Number(m[1].replace(/,/g, "")));
    return out;
}

const isFree = (s: string) => s.includes("무료");

/** 가격 문구가 근거 글에 실제로 있는지: 금액이 전부 글에 있거나, "무료"면 글에도 "무료" */
export function priceInSource(value: string, sourceText: string): boolean {
    if (isFree(value)) return isFree(sourceText);
    const want = moneyAmounts(value);
    if (want.length === 0) return false;
    const have = moneyAmounts(sourceText);
    return want.every((a) => have.includes(a));
}

/** 팁 문장에 가격이 들어 있는지 (사람이 고쳐 넣은 경우 포함 → "가격 확인 필요"에서 빠짐) */
export const hasPrice = (content: string) => isFree(content) || moneyAmounts(content).length > 0;

/**
 * AI가 근거별로 댄 가격 → 근거에서 확인된 것만, 가장 최근 글 것을 대표로. 날짜 모르는 글은 뒤로
 * sources: id → { text: 제목+본문, written_at }
 */
export function pickTipPrice(prices: { value: string; source_id: number }[], sources: Map<number, { text: string; written_at: Date | null }>): TipPrice {
    const ok: { value: string; source_id: number; written_at: Date | null }[] = [];
    const unverified: TipPrice["unverified"] = [];
    for (const p of prices) {
        const value = String(p.value ?? "").trim();
        const s = sources.get(Number(p.source_id));
        if (!value || !s) continue;
        if (priceInSource(value, s.text)) ok.push({ value, source_id: Number(p.source_id), written_at: s.written_at });
        else unverified.push({ value, source_id: Number(p.source_id) });
    }
    ok.sort((a, b) => (b.written_at?.getTime() ?? -Infinity) - (a.written_at?.getTime() ?? -Infinity));
    const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
    const [best, ...rest] = ok;
    return {
        value: best?.value ?? null,
        source_id: best?.source_id ?? null,
        written_at: day(best?.written_at ?? null),
        others: rest.filter((r) => r.value !== best.value).map((r) => ({ value: r.value, source_id: r.source_id, written_at: day(r.written_at) })),
        unverified,
    };
}

/** 팁 문장의 금액이 대표 가격과 다른지 (문장에 금액이 없으면 false) */
export function contentPriceMismatch(content: string, price: TipPrice | null) {
    if (!price?.value || isFree(price.value)) return false;
    const inContent = moneyAmounts(content);
    return inContent.length > 0 && !moneyAmounts(price.value).every((a) => inContent.includes(a));
}
