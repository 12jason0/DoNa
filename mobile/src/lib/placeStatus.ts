export type PlaceStatus = "open" | "closingSoon" | "closed" | "unknown";

const DAY_ORDER = ["일", "월", "화", "수", "목", "금", "토"] as const;
const CLOSING_SOON_THRESHOLD_MIN = 60;

function isTodayInDays(dayIndices: number[], today: number): boolean {
    return dayIndices.includes(today);
}

function timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
}

function getKstCurrentMinutes(): number {
    const now = new Date();
    const kstHours = (now.getUTCHours() + 9) % 24;
    const kstMins = now.getUTCMinutes();
    return kstHours * 60 + kstMins;
}

function isWithinBusinessHours(openTime: string, closeTime: string, currentMinutes: number): boolean {
    const openMinutes = timeToMinutes(openTime);
    const closeMinutes = timeToMinutes(closeTime);

    // 자정을 넘어가는 경우 (예: 22:00-02:00)
    if (closeMinutes < openMinutes) {
        return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

function getMinutesUntilClose(closeTime: string, currentMinutes: number): number {
    const closeMinutes = timeToMinutes(closeTime);
    if (closeMinutes < currentMinutes) return 24 * 60 - currentMinutes + closeMinutes;
    return closeMinutes - currentMinutes;
}

function parseSegment(
    segment: string,
    today: number
): { openRanges: { open: string; close: string }[]; applies: boolean } {
    const dayRangeMatch = segment.match(/^([월화수목금토일])-([월화수목금토일]):\s*(.+)$/);
    const singleDayMatch = segment.match(/^([월화수목금토일]):\s*(.+)$/);

    let dayIndices: number[] = [];
    let timePart = "";

    if (dayRangeMatch) {
        const startIdx = DAY_ORDER.indexOf(dayRangeMatch[1] as (typeof DAY_ORDER)[number]);
        const endIdx = DAY_ORDER.indexOf(dayRangeMatch[2] as (typeof DAY_ORDER)[number]);
        if (startIdx <= endIdx) {
            for (let i = startIdx; i <= endIdx; i += 1) dayIndices.push(i);
        } else {
            for (let i = startIdx; i <= 6; i += 1) dayIndices.push(i);
            for (let i = 0; i <= endIdx; i += 1) dayIndices.push(i);
        }
        timePart = dayRangeMatch[3].trim();
    } else if (singleDayMatch) {
        const idx = DAY_ORDER.indexOf(singleDayMatch[1] as (typeof DAY_ORDER)[number]);
        dayIndices = [idx];
        timePart = singleDayMatch[2].trim();
    } else {
        return { openRanges: [], applies: false };
    }

    const applies = isTodayInDays(dayIndices, today);
    const openRanges: { open: string; close: string }[] = [];
    const rangeRegex = /(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/g;
    let m: RegExpExecArray | null;
    while ((m = rangeRegex.exec(timePart)) !== null) {
        openRanges.push({
            open: `${m[1].padStart(2, "0")}:${m[2]}`,
            close: `${m[3].padStart(2, "0")}:${m[4]}`,
        });
    }
    return { openRanges, applies };
}

function parseOpeningHours(openingHours?: string | null): { todayOpenRanges: { open: string; close: string }[] } {
    if (!openingHours) return { todayOpenRanges: [] };

    const now = new Date();
    const today = (now.getUTCDay() + 0) % 7;
    const s = openingHours.trim();

    // 세그먼트 형식: "월-금: ...; 토-일: ..."
    if (s.includes(";")) {
        const segments = s.split(";").map((x) => x.trim()).filter(Boolean);
        for (const seg of segments) {
            const { openRanges, applies } = parseSegment(seg, today);
            if (applies) return { todayOpenRanges: openRanges };
        }
        return { todayOpenRanges: [] };
    }

    // 단순 형식: "09:00-22:00" 또는 "매일 09:00-22:00"
    const simpleFormat = /^(?:매일\s*)?(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})$/;
    const simpleMatch = s.match(simpleFormat);
    if (simpleMatch && !/[일월화수목금토]/.test(s)) {
        const open = `${simpleMatch[1].padStart(2, "0")}:${simpleMatch[2]}`;
        const close = `${simpleMatch[3].padStart(2, "0")}:${simpleMatch[4]}`;
        return { todayOpenRanges: [{ open, close }] };
    }

    // 요일별 단일/복수 구간
    const dayRangePattern = /([월화수목금토일])-([월화수목금토일]):\s*([0-9:\-~,\s]+)/g;
    const singleDayPattern = /([월화수목금토일]):\s*([0-9:\-~,\s]+)/g;
    const todayName = DAY_ORDER[today];
    let match: RegExpExecArray | null;

    while ((match = dayRangePattern.exec(s)) !== null) {
        const startIdx = DAY_ORDER.indexOf(match[1] as (typeof DAY_ORDER)[number]);
        const endIdx = DAY_ORDER.indexOf(match[2] as (typeof DAY_ORDER)[number]);
        const inRange =
            (startIdx <= endIdx && today >= startIdx && today <= endIdx) ||
            (startIdx > endIdx && (today >= startIdx || today <= endIdx));
        if (inRange) {
            const ranges: { open: string; close: string }[] = [];
            const rangeRegex = /(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/g;
            let r: RegExpExecArray | null;
            while ((r = rangeRegex.exec(match[3])) !== null) {
                ranges.push({
                    open: `${r[1].padStart(2, "0")}:${r[2]}`,
                    close: `${r[3].padStart(2, "0")}:${r[4]}`,
                });
            }
            return { todayOpenRanges: ranges };
        }
    }

    singleDayPattern.lastIndex = 0;
    while ((match = singleDayPattern.exec(s)) !== null) {
        if (match[1] === todayName) {
            const ranges: { open: string; close: string }[] = [];
            const rangeRegex = /(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/g;
            let r: RegExpExecArray | null;
            while ((r = rangeRegex.exec(match[2])) !== null) {
                ranges.push({
                    open: `${r[1].padStart(2, "0")}:${r[2]}`,
                    close: `${r[3].padStart(2, "0")}:${r[4]}`,
                });
            }
            return { todayOpenRanges: ranges };
        }
    }

    return { todayOpenRanges: [] };
}

/**
 * 웹 placeStatus 기준으로 모바일에서도 동일한 핵심 상태를 표시한다.
 * - 영업중
 * - 곧 마감(1시간 이내)
 * - 영업종료
 */
export function getPlaceOpenStatus(openingHours?: string | null): PlaceStatus {
    if (!openingHours) return "unknown";

    const { todayOpenRanges } = parseOpeningHours(openingHours);
    if (todayOpenRanges.length === 0) return "unknown";

    const currentMinutes = getKstCurrentMinutes();

    for (const range of todayOpenRanges) {
        if (isWithinBusinessHours(range.open, range.close, currentMinutes)) {
            const minutesUntilClose = getMinutesUntilClose(range.close, currentMinutes);
            if (minutesUntilClose <= CLOSING_SOON_THRESHOLD_MIN) return "closingSoon";
            return "open";
        }
    }

    return "closed";
}

export const STATUS_LABEL: Record<PlaceStatus, string> = {
    open: "영업중",
    closingSoon: "곧 마감",
    closed: "영업종료",
    unknown: "",
};

export const STATUS_COLOR: Record<PlaceStatus, string> = {
    open: "#16a34a",
    closingSoon: "#ea580c",
    closed: "#dc2626",
    unknown: "#9ca3af",
};

export const STATUS_BG: Record<PlaceStatus, string> = {
    open: "#dcfce7",
    closingSoon: "#ffedd5",
    closed: "#fee2e2",
    unknown: "#f3f4f6",
};
