// src/constants/chipRules.ts
// 칩 = "선택 근거" (코스 × 유저 상태 비교 결과, 상위 3개만 노출)

import { REGION_GROUPS } from "./onboardingData";

// ------------------------------------------------------
// 1. 칩 정의 (최소 세트)
// ------------------------------------------------------
export const CHIP_DEFINITIONS = {
    TODAY_GOOD: { id: "TODAY_GOOD", label: "오늘추천", icon: "", basePriority: 10 },
    LOW_MOVE: { id: "LOW_MOVE", label: "이동편함", icon: "", basePriority: 9 },
    WEATHER_SAFE: { id: "WEATHER_SAFE", label: "날씨영향↓", icon: "", basePriority: 8 },
    QUIET_MOOD: { id: "QUIET_MOOD", label: "조용함", icon: "", basePriority: 7 },
    EMOTIONAL: { id: "EMOTIONAL", label: "감성", icon: "", basePriority: 6 },
    PHOTO: { id: "PHOTO", label: "포토", icon: "", basePriority: 5 },
    COUPLE: { id: "COUPLE", label: "연인추천", icon: "", basePriority: 4 },
    FIRST_MEET: { id: "FIRST_MEET", label: "첫만남", icon: "", basePriority: 3 },
    SOLO: { id: "SOLO", label: "혼자가기", icon: "", basePriority: 2 },
    RESERVATION_OK: { id: "RESERVATION_OK", label: "예약추천", icon: "", basePriority: 1 },
    WEEKEND_FIT: { id: "WEEKEND_FIT", label: "주말추천", icon: "", basePriority: 9 },
} as const;

export type ChipId = keyof typeof CHIP_DEFINITIONS;

// ------------------------------------------------------
// 2. 컨텍스트 타입
// ------------------------------------------------------
export type DayType = "today" | "weekend";

export interface ChipContext {
    dayType: DayType;
    companionToday?: string;
    weatherToday?: string;
    userRegions?: string[];
}

export interface ChipCourse {
    region?: string | null;
    concept?: string | null;
    mood?: string[] | string | null;
    goal?: string | null;
    coursePlaces?: Array<{ place?: { reservationUrl?: string | null } }>;
}

// ------------------------------------------------------
// 3. 지역 매칭 (REGION_GROUPS dbValues 기준)
// ------------------------------------------------------
function groupOf(region: string | null | undefined): string | null {
    if (!region?.trim()) return null;
    const r = region.trim();
    const group = REGION_GROUPS.find((g) => g.dbValues.some((v) => r.includes(v) || v.includes(r)));
    return group?.id ?? null;
}

function getUserGroupId(userRegion: string): string | null {
    const g = REGION_GROUPS.find(
        (gr) => gr.label === userRegion || gr.dbValues.some((v) => userRegion.includes(v) || v.includes(userRegion)),
    );
    return g?.id ?? null;
}

function isRegionMatch(courseRegion: string | null | undefined, userRegions: string[] | undefined): boolean {
    if (!courseRegion || !userRegions?.length) return false;
    const courseGroupId = groupOf(courseRegion);
    if (!courseGroupId) return false;
    return userRegions.some((ur) => getUserGroupId(ur) === courseGroupId);
}

// ------------------------------------------------------
// 4. 칩별 조건 + context score
// ------------------------------------------------------
function getChipCandidates(course: ChipCourse, context: ChipContext): { id: ChipId; score: number }[] {
    const candidates: { id: ChipId; score: number }[] = [];
    const concept = (course.concept ?? "").toString().toLowerCase();
    const moodArr = Array.isArray(course.mood) ? course.mood : course.mood ? [String(course.mood)] : [];
    const moodStr = moodArr.join(" ").toLowerCase();
    const goal = (course.goal ?? "").toString().toLowerCase();
    const hasReservationUrl = course.coursePlaces?.some((cp) => cp?.place?.reservationUrl);

    // A. 시간/상황
    if (context.dayType === "today") {
        candidates.push({ id: "TODAY_GOOD", score: 10 });
    }
    if (context.dayType === "weekend") {
        candidates.push({ id: "WEEKEND_FIT", score: 10 });
    }

    // B. 이동 부담 (dbValues/그룹 기준)
    if (isRegionMatch(course.region, context.userRegions)) {
        candidates.push({ id: "LOW_MOVE", score: 8 });
    }

    // C. 날씨 (실내/날씨 무관)
    if (concept.includes("실내") || concept.includes("카페") || concept.includes("전시") || concept.includes("쇼핑")) {
        const weatherBoost =
            context.weatherToday?.includes("비") ||
            context.weatherToday?.includes("눈") ||
            context.weatherToday?.includes("미세")
                ? 12
                : 0;
        candidates.push({ id: "WEATHER_SAFE", score: 5 + weatherBoost });
    }

    // D. 분위기
    if (
        moodStr.includes("조용") ||
        moodStr.includes("프라이빗") ||
        moodStr.includes("힐링") ||
        concept.includes("힐링")
    ) {
        candidates.push({ id: "QUIET_MOOD", score: 6 });
    }
    if (
        moodStr.includes("감성") ||
        moodStr.includes("로맨틱") ||
        concept.includes("감성") ||
        concept.includes("로맨틱") ||
        concept.includes("데이트")
    ) {
        candidates.push({ id: "EMOTIONAL", score: 5 });
    }
    if (concept.includes("인생샷") || concept.includes("포토") || concept.includes("사진")) {
        candidates.push({ id: "PHOTO", score: 5 });
    }

    // E. 관계
    if (context.companionToday === "연인") {
        if (goal.includes("연인") || goal.includes("커플") || goal.includes("데이트") || concept.includes("데이트")) {
            candidates.push({ id: "COUPLE", score: 7 });
        }
    }
    if (context.companionToday === "소개팅") {
        candidates.push({ id: "FIRST_MEET", score: 6 });
    }
    if (context.companionToday === "혼자") {
        candidates.push({ id: "SOLO", score: 6 });
    }

    // F. 예약
    if (hasReservationUrl) {
        candidates.push({ id: "RESERVATION_OK", score: 4 });
    }

    return candidates;
}

// ------------------------------------------------------
// 5. 메인: priority + context score → top 3
// ------------------------------------------------------
export function getChips(course: ChipCourse, context: ChipContext, maxCount = 3): ChipId[] {
    const candidates = getChipCandidates(course, context);
    if (candidates.length === 0) return [];

    const withTotal = candidates.map((c) => ({
        id: c.id,
        total: (CHIP_DEFINITIONS[c.id]?.basePriority ?? 0) + c.score,
    }));

    withTotal.sort((a, b) => b.total - a.total);

    return withTotal.slice(0, maxCount).map((x) => x.id);
}
