/**
 * 장소 가격대(avg_cost_range) 표기 정리
 * "33000 - " → "33,000 - ", "2.500 ~" → "2,500 -", "10,,000" → "10,000"
 */
export function normalizeCostRange<T extends string | null | undefined>(v: T): T {
    if (typeof v !== "string") return v;
    return v
        .replace(/~/g, "-")
        .replace(/,{2,}/g, ",")
        .replace(/(?<=\d)\.(?=\d{3}(?!\d))/g, ",")
        .replace(/\d{4,}/g, (n) => Number(n).toLocaleString("en-US")) as T;
}
