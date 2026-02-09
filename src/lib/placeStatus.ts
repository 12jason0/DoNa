/**
 * 장소 영업 상태 계산 유틸리티
 */

export type PlaceStatus = "영업중" | "곧 마감" | "곧 브레이크" | "브레이크 중" | "오픈 준비중" | "휴무" | "영업종료" | "정보 없음";

export interface PlaceStatusInfo {
    status: PlaceStatus;
    message: string;
    isOpen: boolean;
    nextOpenTime?: string;
}

interface PlaceClosedDay {
    day_of_week: number | null; // 0=일요일, 1=월요일, ..., 6=토요일
    specific_date: Date | string | null;
    note?: string | null;
}

/**
 * 오늘이 휴무일인지 확인
 */
function isClosedToday(closedDays: PlaceClosedDay[]): boolean {
    if (!closedDays || closedDays.length === 0) return false;

    const now = new Date();
    const today = now.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
    const todayDateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

    return closedDays.some((closedDay) => {
        // 요일별 휴무 확인
        if (closedDay.day_of_week !== null && closedDay.day_of_week === today) {
            return true;
        }

        // 특정 날짜 휴무 확인
        if (closedDay.specific_date) {
            const closedDate = new Date(closedDay.specific_date);
            const closedDateStr = closedDate.toISOString().split("T")[0];
            if (closedDateStr === todayDateStr) {
                return true;
            }
        }

        return false;
    });
}

const DAY_ORDER = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 오늘 요일이 dayIndices(0=일~6=토)에 포함되는지 */
function isTodayInDays(dayIndices: number[], today: number): boolean {
    return dayIndices.includes(today);
}

/** 세그먼트: 요일들 + 영업 구간들 + 선택적 브레이크 */
function parseSegment(
    segment: string,
    today: number,
    todayName: string
): { openRanges: { open: string; close: string }[]; breakRange: { start: string; end: string } | null; applies: boolean } {
    const breakRegex = /\s*\(브레이크\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\)\s*$/;
    const breakMatch = segment.match(breakRegex);
    let rest = segment;
    let breakRange: { start: string; end: string } | null = null;
    if (breakMatch) {
        breakRange = {
            start: `${breakMatch[1].padStart(2, "0")}:${breakMatch[2]}`,
            end: `${breakMatch[3].padStart(2, "0")}:${breakMatch[4]}`,
        };
        rest = segment.replace(breakRegex, "").trim();
    }

    const dayRangeMatch = rest.match(/^([월화수목금토일])-([월화수목금토일]):\s*(.+)$/);
    const singleDayMatch = rest.match(/^([월화수목금토일]):\s*(.+)$/);
    let dayIndices: number[] = [];
    let timePart = "";

    if (dayRangeMatch) {
        const startIdx = DAY_ORDER.indexOf(dayRangeMatch[1] as (typeof DAY_ORDER)[number]);
        const endIdx = DAY_ORDER.indexOf(dayRangeMatch[2] as (typeof DAY_ORDER)[number]);
        if (startIdx <= endIdx) for (let i = startIdx; i <= endIdx; i++) dayIndices.push(i);
        else {
            for (let i = startIdx; i <= 6; i++) dayIndices.push(i);
            for (let i = 0; i <= endIdx; i++) dayIndices.push(i);
        }
        timePart = dayRangeMatch[3].trim();
    } else if (singleDayMatch) {
        const idx = DAY_ORDER.indexOf(singleDayMatch[1] as (typeof DAY_ORDER)[number]);
        dayIndices = [idx];
        timePart = singleDayMatch[2].trim();
    }

    const applies = isTodayInDays(dayIndices, today);
    const openRanges: { open: string; close: string }[] = [];
    const rangeRegex = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;
    let m: RegExpExecArray | null;
    while ((m = rangeRegex.exec(timePart)) !== null) {
        openRanges.push({
            open: `${m[1].padStart(2, "0")}:${m[2]}`,
            close: `${m[3].padStart(2, "0")}:${m[4]}`,
        });
    }

    return { openRanges, breakRange, applies };
}

/**
 * 영업시간 문자열 파싱
 * 지원 형식:
 * - "09:00-22:00", "매일 09:00-22:00" (단순)
 * - "월-금: 09:00-18:00, 토-일: 10:00-20:00" (요일별 단일 구간)
 * - "월-목: 11:00-14:00, 17:00-21:00 (브레이크 14:00-17:00); 토-일: 11:00-20:00" (다중 구간 + 브레이크, 세그먼트는 ; 구분)
 */
function parseOpeningHours(openingHours: string | null | undefined): {
    todayOpenRanges: { open: string; close: string }[];
    todayBreak: { start: string; end: string } | null;
    allHours: string;
} {
    if (!openingHours) {
        return { todayOpenRanges: [], todayBreak: null, allHours: "" };
    }

    const now = new Date();
    const today = now.getDay();
    const dayMap: { [key: number]: string } = {
        0: "일", 1: "월", 2: "화", 3: "수", 4: "목", 5: "금", 6: "토",
    };
    const todayName = dayMap[today];
    const s = openingHours.trim();

    // 새 형식: 세그먼트가 ";" 로 구분
    if (s.includes(";")) {
        const segments = s.split(";").map((x) => x.trim()).filter(Boolean);
        for (const seg of segments) {
            const { openRanges, breakRange, applies } = parseSegment(seg, today, todayName);
            if (applies) {
                return {
                    todayOpenRanges: openRanges,
                    todayBreak: breakRange,
                    allHours: openingHours,
                };
            }
        }
        return { todayOpenRanges: [], todayBreak: null, allHours: openingHours };
    }

    // 단순 형식: "09:00-22:00" 또는 "매일 09:00-22:00"
    const simpleFormat = /^(?:매일\s*)?(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;
    const simpleMatch = s.match(simpleFormat);
    if (simpleMatch && !/[일월화수목금토]/.test(s)) {
        const open = `${simpleMatch[1].padStart(2, "0")}:${simpleMatch[2]}`;
        const close = `${simpleMatch[3].padStart(2, "0")}:${simpleMatch[4]}`;
        return {
            todayOpenRanges: [{ open, close }],
            todayBreak: null,
            allHours: openingHours,
        };
    }

    // 요일별 단일 구간 (기존 패턴)
    const dayRangePattern = /([월화수목금토일])-([월화수목금토일]):\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;
    const singleDayPattern = /([월화수목금토일]):\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;
    let match: RegExpExecArray | null;

    while ((match = dayRangePattern.exec(openingHours)) !== null) {
        const startIdx = DAY_ORDER.indexOf(match[1] as (typeof DAY_ORDER)[number]);
        const endIdx = DAY_ORDER.indexOf(match[2] as (typeof DAY_ORDER)[number]);
        const todayIdx = DAY_ORDER.indexOf(todayName as (typeof DAY_ORDER)[number]);
        const inRange =
            (startIdx <= endIdx && todayIdx >= startIdx && todayIdx <= endIdx) ||
            (startIdx > endIdx && (todayIdx >= startIdx || todayIdx <= endIdx));
        if (inRange) {
            const open = `${match[3].padStart(2, "0")}:${match[4]}`;
            const close = `${match[5].padStart(2, "0")}:${match[6]}`;
            return {
                todayOpenRanges: [{ open, close }],
                todayBreak: null,
                allHours: openingHours,
            };
        }
    }

    singleDayPattern.lastIndex = 0;
    while ((match = singleDayPattern.exec(openingHours)) !== null) {
        if (match[1] === todayName) {
            const open = `${match[2].padStart(2, "0")}:${match[3]}`;
            const close = `${match[4].padStart(2, "0")}:${match[5]}`;
            return {
                todayOpenRanges: [{ open, close }],
                todayBreak: null,
                allHours: openingHours,
            };
        }
    }

    const everydayPattern = /매일\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/;
    const everydayMatch = openingHours.match(everydayPattern);
    if (everydayMatch) {
        const open = `${everydayMatch[1].padStart(2, "0")}:${everydayMatch[2]}`;
        const close = `${everydayMatch[3].padStart(2, "0")}:${everydayMatch[4]}`;
        return {
            todayOpenRanges: [{ open, close }],
            todayBreak: null,
            allHours: openingHours,
        };
    }

    return { todayOpenRanges: [], todayBreak: null, allHours: openingHours };
}
/**
 * 시간 문자열을 분으로 변환 (예: "09:30" -> 570)
 */
function timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
}

/**
 * 현재 시간이 영업 시간 내인지 확인
 */
function isWithinBusinessHours(openTime: string, closeTime: string): boolean {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = timeToMinutes(openTime);
    const closeMinutes = timeToMinutes(closeTime);

    // 자정을 넘어가는 경우 처리 (예: 22:00-02:00)
    if (closeMinutes < openMinutes) {
        return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

/**
 * 마감까지 남은 시간 계산 (분 단위)
 */
function getMinutesUntilClose(closeTime: string): number {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const closeMinutes = timeToMinutes(closeTime);

    // 자정을 넘어가는 경우 처리
    if (closeMinutes < currentMinutes) {
        return 24 * 60 - currentMinutes + closeMinutes;
    }

    return closeMinutes - currentMinutes;
}

/**
 * 장소의 현재 영업 상태를 계산
 * 휴무 → (오픈 준비중: 다음 오픈 30분 이내) → 브레이크 중 → (곧 브레이크: 영업중이면서 브레이크 30분 이내) → 영업중/곧 마감 → 영업종료
 */
const MINUTES_THRESHOLD = 30;

export function getPlaceStatus(
    openingHours: string | null | undefined,
    closedDays: PlaceClosedDay[] = []
): PlaceStatusInfo {
    if (isClosedToday(closedDays)) {
        return {
            status: "휴무",
            message: "오늘은 휴무일입니다",
            isOpen: false,
        };
    }

    if (!openingHours) {
        return {
            status: "정보 없음",
            message: "영업시간 정보가 없습니다",
            isOpen: false,
        };
    }

    const { todayOpenRanges, todayBreak, allHours } = parseOpeningHours(openingHours);

    if (todayOpenRanges.length === 0) {
        return {
            status: "정보 없음",
            message: allHours || "영업시간 정보가 없습니다",
            isOpen: false,
        };
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 다음 오픈 시간 계산 (영업 전이거나 브레이크 끝난 후)
    let nextOpen: string | undefined;
    let nextOpenM = 24 * 60 + 1;
    for (const range of todayOpenRanges) {
        const openM = timeToMinutes(range.open);
        if (currentMinutes < openM && openM < nextOpenM) {
            nextOpenM = openM;
            nextOpen = range.open;
        }
    }
    if (todayBreak && currentMinutes < timeToMinutes(todayBreak.end)) {
        const endM = timeToMinutes(todayBreak.end);
        if (endM < nextOpenM) {
            nextOpen = todayBreak.end;
            nextOpenM = endM;
        }
    }

    const inBreak = todayBreak && isWithinBusinessHours(todayBreak.start, todayBreak.end);
    const inAnyOpenRange = todayOpenRanges.some((range) => isWithinBusinessHours(range.open, range.close));

    // (2) 오픈 준비중: 아직 영업 전이고, 다음 오픈이 30분 이내
    if (!inAnyOpenRange && !inBreak && nextOpen && nextOpenM <= 24 * 60) {
        const minutesUntilOpen = nextOpenM - currentMinutes;
        if (minutesUntilOpen > 0 && minutesUntilOpen <= MINUTES_THRESHOLD) {
            return {
                status: "오픈 준비중",
                message: `${nextOpen}에 영업 시작 (약 ${Math.ceil(minutesUntilOpen / 10) * 10}분 후)`,
                isOpen: false,
                nextOpenTime: nextOpen,
            };
        }
    }

    // (3) 브레이크 중
    if (inBreak) {
        return {
            status: "브레이크 중",
            message: `${todayBreak!.start} - ${todayBreak!.end} 브레이크 (${todayBreak!.end}에 영업 재개)`,
            isOpen: false,
            nextOpenTime: todayBreak!.end,
        };
    }

    // (4) 영업 구간 안: 곧 브레이크 → 곧 마감 → 영업중
    for (const range of todayOpenRanges) {
        if (isWithinBusinessHours(range.open, range.close)) {
            const breakStartM = todayBreak ? timeToMinutes(todayBreak.start) : 24 * 60 + 1;
            const minutesUntilBreak = breakStartM - currentMinutes;
            if (todayBreak && currentMinutes < breakStartM && minutesUntilBreak > 0 && minutesUntilBreak <= MINUTES_THRESHOLD) {
                return {
                    status: "곧 브레이크",
                    message: `${todayBreak.start}부터 브레이크 (약 ${Math.ceil(minutesUntilBreak / 10) * 10}분 후)`,
                    isOpen: true,
                };
            }
            const minutesUntilClose = getMinutesUntilClose(range.close);
            if (minutesUntilClose <= 60) {
                return {
                    status: "곧 마감",
                    message: `${range.close} 마감 (약 ${Math.ceil(minutesUntilClose / 10) * 10}분 후)`,
                    isOpen: true,
                };
            }
            const first = todayOpenRanges[0];
            const last = todayOpenRanges[todayOpenRanges.length - 1];
            return {
                status: "영업중",
                message: `${first.open} - ${last.close} 영업중`,
                isOpen: true,
            };
        }
    }

    // (5) 영업종료
    const lastClose = todayOpenRanges[todayOpenRanges.length - 1].close;
    const lastCloseM = timeToMinutes(lastClose);
    if (currentMinutes >= lastCloseM) {
        return {
            status: "영업종료",
            message: `${lastClose}에 영업 종료`,
            isOpen: false,
        };
    }
    return {
        status: "영업종료",
        message: nextOpen ? `${nextOpen}에 영업 시작` : "영업 종료",
        isOpen: false,
        nextOpenTime: nextOpen,
    };
}
