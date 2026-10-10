// 팝업·전시처럼 기간 한정 장소 (places.start_date / end_date, null = 상설)

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 오늘 날짜를 @db.Date 비교용 Date(UTC 자정)로 */
export function kstToday(now = new Date()): Date {
    const k = new Date(now.getTime() + KST_OFFSET_MS);
    return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
}

/** 코스 where 조건: 종료일 지난 장소가 하나라도 있는 코스 제외 */
export function notExpiredCourseWhere(now = new Date()) {
    return { coursePlaces: { none: { place: { end_date: { lt: kstToday(now) } } } } };
}

/**
 * 캡션 끝의 기간 "10/17~1/24", "2026.10.17-2027.1.24", "10월17일~1월24일" 인식.
 * 연도 없으면 시작일은 올해(KST), 종료일이 시작일보다 앞이면 다음 해. 기간을 뺀 나머지 문장도 돌려줌.
 */
export function parsePeriod(text: string, now = new Date()): { rest: string; start: Date; end: Date } | null {
    const d = String.raw`(?:(\d{4})\s*[/.년-]\s*)?(\d{1,2})\s*[/.월]\s*(\d{1,2})\s*일?`;
    const m = text.match(new RegExp(`${d}\\s*[~〜-]\\s*${d}`));
    if (!m) return null;
    const year = kstToday(now).getUTCFullYear();
    const sy = m[1] ? Number(m[1]) : year;
    const start = new Date(Date.UTC(sy, Number(m[2]) - 1, Number(m[3])));
    let end = new Date(Date.UTC(m[4] ? Number(m[4]) : sy, Number(m[5]) - 1, Number(m[6])));
    if (!m[4] && end < start) end = new Date(Date.UTC(sy + 1, Number(m[5]) - 1, Number(m[6])));
    // 13월, 2/30 같은 잘못된 날짜는 인식 안 함
    const valid = (dt: Date, mo: string, da: string) => dt.getUTCMonth() === Number(mo) - 1 && dt.getUTCDate() === Number(da);
    if (!valid(start, m[2], m[3]) || !valid(end, m[5], m[6]) || end < start) return null;
    const rest = (text.slice(0, m.index) + text.slice(m.index! + m[0].length)).replace(/[|,\s]+$/, "").trim();
    return { rest, start, end };
}

/**
 * 관리자 입력 기간 검사: "" → null(상설), "2026-10-17" → Date. 안 보냈으면 undefined(그대로 둠).
 * 형식이 틀리거나 종료일이 시작일보다 앞이면 error
 */
export function readPeriodInput(start: unknown, end: unknown): { start_date?: Date | null; end_date?: Date | null; error?: string } {
    const one = (v: unknown) => {
        if (v === undefined) return undefined;
        if (v === null || v === "") return null;
        const dt = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null;
        return dt && !isNaN(dt.getTime()) && ymd(dt) === v ? dt : "bad";
    };
    const s = one(start), e = one(end);
    if (s === "bad" || e === "bad") return { error: "기간은 YYYY-MM-DD 형식으로 입력해주세요." };
    if (s && e && e < s) return { error: "종료일이 시작일보다 앞이에요." };
    return { ...(s !== undefined ? { start_date: s } : {}), ...(e !== undefined ? { end_date: e } : {}) };
}

/** "2026-10-17" */
export const ymd = (dt: Date | null | undefined) => (dt ? dt.toISOString().slice(0, 10) : null);
