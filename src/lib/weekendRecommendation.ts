/**
 * 두나 주말 추천 계산 모듈
 * - 주말 날짜/모드 계산
 * - 주말 날씨(단기예보) 조회 및 비 위험 판단
 * - 권역 기반 거리 점수 (REGION_GROUPS)
 */

import { REGION_GROUPS } from "@/constants/onboardingData";

export type RegionGroup = (typeof REGION_GROUPS)[number];
export type WeekendMode = "safe" | "partial" | "strong";

/** getVilageFcst 응답 item (camelCase / snake_case 둘 다 지원) */
export interface FcstItem {
    category: string;
    fcstDate?: string;
    fcstTime?: string;
    fcstValue?: string;
    fcst_date?: string;
    fcst_time?: string;
    fcst_value?: string;
}

export interface WeekendWeatherRisk {
    rainLikely: boolean;
    confidence: "high" | "medium" | "low";
}

// ---------------------------------------------
// 1) 주말 대상 날짜
// ---------------------------------------------

/** KST 기준 "다가오는 토요일" 반환 */
export function getWeekendTargetDate(): Date {
    const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const day = kst.getDay();
    let daysToAdd: number;
    if (day === 0) daysToAdd = 6;
    else if (day === 6) daysToAdd = 7;
    else daysToAdd = 6 - day;
    const target = new Date(kst);
    target.setDate(target.getDate() + daysToAdd);
    return target;
}

/** 주말까지 남은 일수 */
export function getDaysUntilWeekend(): number {
    const target = getWeekendTargetDate();
    const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    return Math.ceil((target.getTime() - kst.getTime()) / (24 * 60 * 60 * 1000));
}

/** 토요일 YYYYMMDD 문자열 */
export function getWeekendTargetDateStr(): string {
    const d = getWeekendTargetDate();
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${y}${m}${day}`;
}

// ---------------------------------------------
// 2) 주말 모드 (daysUntilWeekend 기반)
// ---------------------------------------------

export function getWeekendMode(daysUntil?: number): WeekendMode {
    const d = daysUntil ?? getDaysUntilWeekend();
    if (d >= 4) return "safe";
    if (d >= 2) return "partial";
    return "strong";
}

// ---------------------------------------------
// 3) 주말 날씨 조회 (getVilageFcst)
// ---------------------------------------------

export async function fetchWeekendForecast(
    nx: number,
    ny: number,
    apiKey: string,
): Promise<FcstItem[]> {
    if (!apiKey) return [];
    const baseTimes = ["0200", "0500", "0800", "1100", "1400", "1700", "2000", "2300"];
    const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const baseDate = kst.toISOString().slice(0, 10).replace(/-/g, "");
    const hour = kst.getHours();
    const minute = kst.getMinutes();
    const currentMinutes = hour * 60 + minute;
    let chosenBaseTime = baseTimes[baseTimes.length - 1];
    for (let i = baseTimes.length - 1; i >= 0; i--) {
        const [h] = baseTimes[i].match(/\d{2}/) || ["23"];
        const tMinutes = parseInt(h, 10) * 60;
        if (currentMinutes >= tMinutes + 30) {
            chosenBaseTime = baseTimes[i];
            break;
        }
    }

    const url =
        `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?` +
        `serviceKey=${encodeURIComponent(apiKey)}` +
        `&numOfRows=500&pageNo=1&dataType=JSON` +
        `&base_date=${baseDate}&base_time=${chosenBaseTime}` +
        `&nx=${nx}&ny=${ny}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return [];
        const json = await res.json();
        const raw = json?.response?.body?.items?.item;
        const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
        return items as FcstItem[];
    } catch {
        clearTimeout(timeout);
        return [];
    }
}

// ---------------------------------------------
// 4) 비 위험 판단
// ---------------------------------------------

const PTY_RAIN_SNOW = ["1", "2", "3", "4", "5", "6", "7"];

function getFcstValue(it: FcstItem): string {
    return String(it.fcstValue ?? it.fcst_value ?? "");
}

function getFcstDate(it: FcstItem): string {
    return String(it.fcstDate ?? it.fcst_date ?? "");
}

export function getWeekendWeatherRisk(
    fcstItems: FcstItem[],
    targetDateStr: string,
): WeekendWeatherRisk {
    const items = fcstItems.filter(
        (it) => getFcstDate(it) === targetDateStr && ["POP", "PCP", "PTY"].includes(it.category),
    );

    let maxPop = 0;
    let hasPcp = false;
    let hasRainPty = false;

    for (const it of items) {
        const val = getFcstValue(it);
        if (it.category === "POP") {
            const v = parseInt(val, 10);
            if (!isNaN(v)) maxPop = Math.max(maxPop, v);
        }
        if (it.category === "PCP") {
            const v = parseFloat(String(val || "0").replace(/[^0-9.-]/g, ""));
            if (!isNaN(v) && v > 0) hasPcp = true;
        }
        if (it.category === "PTY" && PTY_RAIN_SNOW.includes(val)) {
            hasRainPty = true;
        }
    }

    const rainLikely = maxPop >= 50 || hasPcp || hasRainPty;

    const daysUntil = getDaysUntilWeekend();
    let confidence: "high" | "medium" | "low";
    if (daysUntil <= 1) confidence = "high";
    else if (daysUntil <= 3) confidence = "medium";
    else confidence = "low";

    return { rainLikely, confidence };
}

// ---------------------------------------------
// 5) 코스 실내/야외 점수 (날씨 반영용)
// ---------------------------------------------

export function getIndoorScore(concept: string | null): number {
    if (!concept) return 0.5;
    const c = concept.toLowerCase();
    if (c.includes("실내") || c.includes("카페") || c.includes("전시") || c.includes("쇼핑"))
        return 1;
    if (c.includes("야외") && !c.includes("대체")) return 0;
    if (c.includes("공원") || c.includes("산책")) return 0.2;
    return 0.5;
}

export function isOutdoorOnly(concept: string | null): boolean {
    if (!concept) return false;
    const c = concept.toLowerCase();
    return (
        (c.includes("야외") || c.includes("공원") || c.includes("산책")) &&
        !c.includes("실내") &&
        !c.includes("카페") &&
        !c.includes("쇼핑")
    );
}

// ---------------------------------------------
// 6) 권역 기반 거리 점수 (REGION_GROUPS)
// ---------------------------------------------

export const ADJACENT_REGION_GROUPS: Record<string, string[]> = {
    SEONGSU: ["HONGDAE", "YONGSAN", "JONGNO"],
    HONGDAE: ["SEONGSU", "EULJIRO", "YEOUIDO"],
    JONGNO: ["SEONGSU", "EULJIRO", "GANGNAM"],
    EULJIRO: ["JONGNO", "HONGDAE", "YONGSAN"],
    GANGNAM: ["JONGNO", "YONGSAN", "JAMSIL"],
    YONGSAN: ["SEONGSU", "EULJIRO", "GANGNAM", "JAMSIL"],
    JAMSIL: ["GANGNAM", "YONGSAN"],
    YEOUIDO: ["HONGDAE", "YONGSAN"],
};

export function getCourseRegionGroupId(
    courseRegion: string | null,
    regionGroups: readonly RegionGroup[],
): string | null {
    if (!courseRegion?.trim()) return null;
    const r = courseRegion.trim();
    const g = regionGroups.find((gr) =>
        gr.dbValues.some((v) => r.includes(v) || v.includes(r)),
    );
    return g?.id ?? null;
}

export function getUserPreferredGroupIds(
    userRegions: string[],
    regionGroups: readonly RegionGroup[],
    topN = 5,
): Set<string> {
    const freq: Record<string, number> = {};
    for (const ur of userRegions) {
        if (!ur?.trim()) continue;
        const g = regionGroups.find(
            (gr) =>
                gr.dbValues.some((v) => ur.includes(v) || v.includes(ur)) || gr.label === ur,
        );
        if (g) freq[g.id] = (freq[g.id] || 0) + 1;
    }
    return new Set(
        Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, topN)
            .map(([id]) => id),
    );
}

/**
 * 권역 기반 거리 점수
 * 1.0: 같은 그룹 + 같은 dbValue
 * 0.85: 같은 그룹 + 다른 dbValue
 * 0.7: 인접 그룹
 * 0.3: 그 외
 */
export function calculateRegionMatchV2(
    courseRegion: string | null,
    userPreferredGroupIds: Set<string>,
    regionGroups: readonly RegionGroup[],
    adjacentMap: Record<string, string[]> = ADJACENT_REGION_GROUPS,
): number {
    const courseGroupId = getCourseRegionGroupId(courseRegion, regionGroups);
    if (!courseGroupId || userPreferredGroupIds.size === 0) return 0.5;

    if (userPreferredGroupIds.has(courseGroupId)) {
        const grp = regionGroups.find((g) => g.id === courseGroupId);
        if (!grp) return 0.85;
        const courseSubMatch = grp.dbValues.some(
            (v) => courseRegion && (courseRegion.includes(v) || v.includes(courseRegion)),
        );
        const userLabels = Array.from(userPreferredGroupIds).flatMap((uid) => {
            const ug = regionGroups.find((g) => g.id === uid);
            return ug ? [ug.label, ...ug.dbValues] : [];
        });
        const userHasExact = userLabels.some(
            (v) => courseRegion && (courseRegion.includes(v) || v.includes(courseRegion)),
        );
        return userHasExact || courseSubMatch ? 1.0 : 0.85;
    }

    for (const uid of userPreferredGroupIds) {
        const adj = adjacentMap[uid];
        if (adj?.includes(courseGroupId)) return 0.7;
    }

    return 0.3;
}
