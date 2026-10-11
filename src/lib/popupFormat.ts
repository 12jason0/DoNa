// 팝업 목록 표시용 (DB·Next 의존 없음 → 웹 /popups 와 앱 popups.tsx 가 같이 import)
// 화면 문구는 번역 파일 popups.* , 장소·코스 이름은 기존 *_en/_ja/_zh 칸에서 고름

export type PopupLocale = "ko" | "en" | "ja" | "zh";
type T = (key: any, params?: Record<string, string | number>) => string;

export type PopupItem = {
    id: number;
    name: string;
    name_en: string | null;
    name_ja: string | null;
    name_zh: string | null;
    imageUrl: string | null;
    address: string | null;
    address_en: string | null;
    address_ja: string | null;
    address_zh: string | null;
    startDate: string | null; // "2026-10-17"
    endDate: string | null;
    daysToStart: number | null; // 양수면 곧 시작
    daysToEnd: number | null; // 0 = 오늘 종료
    courses: { id: number; title: string; title_en: string | null; title_ja: string | null; title_zh: string | null }[];
};

const pick = (ko: string, en: string | null, ja: string | null, zh: string | null, locale: PopupLocale) =>
    ((locale === "en" ? en : locale === "ja" ? ja : locale === "zh" ? zh : null)?.trim() || ko);

export const popupName = (p: PopupItem, l: PopupLocale) => pick(p.name, p.name_en, p.name_ja, p.name_zh, l);
export const popupCourseTitle = (c: PopupItem["courses"][number], l: PopupLocale) => pick(c.title, c.title_en, c.title_ja, c.title_zh, l);

/** 주소에서 구 단위: "서울 성동구 …" → 성동구, "…, Seongdong-gu, Seoul" → Seongdong-gu, "ソウル 城東区 …" → 城東区 */
export function popupRegion(p: PopupItem, l: PopupLocale) {
    const address = pick(p.address ?? "", p.address_en, p.address_ja, p.address_zh, l);
    // 일본어·중국어 주소는 "ソウル特別市城東区練武場…"처럼 띄어쓰기가 없어서 구 단위 패턴으로 찾음
    const m =
        address.match(/[A-Za-z]+-(?:gu|gun)\b/i) ??
        address.match(/[가-힣]+(?:구|군)(?=[\s,]|$)/) ??
        address.match(/[^\s,市都]{1,6}?(?:区|區|郡)/);
    return m?.[0] ?? "";
}

function date(ymd: string, t: T, todayYear: number) {
    const [y, m, d] = ymd.split("-").map(Number);
    return y !== todayYear ? t("popups.dateWithYear", { y, m, d }) : t("popups.date", { m, d });
}

export function popupPeriod(p: PopupItem, t: T, todayYear: number) {
    const s = p.startDate ? date(p.startDate, t, todayYear) : "";
    const e = p.endDate ? date(p.endDate, t, todayYear) : "";
    return t("popups.period", { start: s, end: e }).trim();
}

/** "D-3 종료" / "오늘 종료" / "5일 후 시작" / 없음 */
export function popupBadge(p: PopupItem, t: T): string | null {
    if (p.daysToStart != null && p.daysToStart > 0) return t("popups.startsInDays", { n: p.daysToStart });
    if (p.daysToEnd === 0) return t("popups.endsToday");
    if (p.daysToEnd != null && p.daysToEnd <= 7) return t("popups.endsInDays", { n: p.daysToEnd });
    return null;
}
