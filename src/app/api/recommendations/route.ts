import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { getChips, type ChipContext, type DayType } from "@/constants/chipRules";
import { REGION_GROUPS } from "@/constants/onboardingData";
import { getRecommendationDailyLimit } from "@/constants/subscription";
import {
    fetchWeekendForecast,
    getWeekendWeatherRisk,
    getWeekendTargetDateStr,
    getDaysUntilWeekend,
    getWeekendMode,
    getIndoorScore,
    isOutdoorOnly,
    calculateRegionMatchV2,
    getUserPreferredGroupIds,
} from "@/lib/weekendRecommendation";
import { checkRateLimit, getIdentifierFromRequest } from "@/lib/rateLimit";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const revalidate = 60;

// data.go.kr 공공데이터 서비스 키 (기상청 날씨 + AirKorea 미세먼지 API 공통 사용)
const KMA_API_KEY = process.env.KMA_API_KEY;
const AIRKOREA_API_KEY = KMA_API_KEY;

// ---------------------------------------------
// [온보딩 UI 텍스트 → 행정구역명 매핑]
// ---------------------------------------------
const regionMapping: Record<string, string> = {
    "성수 · 건대": "성동구",
    "홍대 · 연남 · 신촌": "마포구",
    "종로 · 북촌 · 서촌": "종로구",
    "을지로 (힙지로)": "중구",
    "강남 · 압구정 · 신사": "강남구",
    "한남 · 이태원 · 용산": "용산구",
    "잠실 · 송파": "송파구",
    "여의도 · 영등포": "영등포구",
    // personalized-home Q4 옵션
    "문래·영등포": "영등포구",
    "합정·용산": "용산구", // 합정(마포구)+용산(용산구) 복합 권역 — 날씨 API용으로 용산구 기준 적용
    "안국·서촌": "종로구",
    "을지로": "중구",
    "여의도": "영등포구",
};

// ---------------------------------------------
// [날씨 및 점수 계산 헬퍼 함수 - 기존 로직 100% 동일]
// ---------------------------------------------

function extractWeatherStatus(data: any): string | null {
    const items = data?.response?.body?.items?.item;
    if (!items || items.length === 0) return null;
    let weatherStatus = "맑음";
    let hasRain = false;
    for (const item of items) {
        if (item.category === "PTY" && item.obsrValue !== "0") hasRain = true;
        if (item.category === "SKY") {
            if (item.obsrValue === "4") weatherStatus = "흐림";
            else if (item.obsrValue === "3") weatherStatus = "구름많음";
            else if (item.obsrValue === "1") weatherStatus = "맑음";
        }
    }
    return hasRain ? "비/눈" : weatherStatus;
}

async function fetchWeatherAndCache(nx: number, ny: number): Promise<string | null> {
    if (!KMA_API_KEY) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const now = new Date();
    const baseDate = now.toISOString().slice(0, 10).replace(/-/g, "");
    const baseTime = `${now.getHours().toString().padStart(2, "0")}00`;
    const apiUrl = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst?serviceKey=${encodeURIComponent(
        KMA_API_KEY,
    )}&numOfRows=10&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;
    try {
        const response = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) return null;
        const jsonResponse = await response.json();
        if (jsonResponse?.response?.header?.resultCode !== "00") return null;
        return extractWeatherStatus(jsonResponse);
    } catch (error) {
            captureApiError(error);
        clearTimeout(timeout);
        return null;
    }
}

async function fetchAirQualityStatus(sidoName: string): Promise<string | null> {
    if (!AIRKOREA_API_KEY || !sidoName) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const apiUrl = `https://apis.data.go.kr/B552584/ArpltnInforinquireSvc/getCtprvnRltmMesureDnsty?serviceKey=${encodeURIComponent(
            AIRKOREA_API_KEY,
        )}&numOfRows=1&pageNo=1&sidoName=${encodeURIComponent(sidoName)}&ver=1.3&returnType=json`;
        const response = await fetch(apiUrl, { next: { revalidate: 3600 }, signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) return null;
        const jsonResponse = await response.json();
        const items = jsonResponse?.response?.body?.items;
        if (!Array.isArray(items) || items.length === 0) return null;
        const item = items[0] || {};
        const pm10Value = parseInt(String(item.pm10Value ?? ""), 10);
        const pm25Value = parseInt(String(item.pm25Value ?? ""), 10);
        if (pm10Value > 150 || pm25Value > 75) return "황사";
        if (pm10Value > 75 || pm25Value > 35) return "미세먼지";
        return null;
    } catch (error) {
            captureApiError(error);
        clearTimeout(timeout);
        return null;
    }
}

function calculateWeatherPenalty(courseConcept: string | null, weatherToday: string): number {
    let penalty = 0;
    if (!courseConcept) return 0;

    if (weatherToday.includes("비") || weatherToday.includes("눈")) {
        if (courseConcept.includes("야외") || courseConcept.includes("공원")) penalty -= 0.2;
        if (courseConcept.includes("실내")) penalty += 0.05;
    } else if (weatherToday.includes("미세먼지") || weatherToday.includes("황사")) {
        if (courseConcept.includes("활동적인") || courseConcept.includes("야외")) penalty -= 0.15;
        if (courseConcept.includes("전시") || courseConcept.includes("실내") || courseConcept.includes("맛집") || courseConcept.includes("카페")) penalty += 0.03;
    } else if (weatherToday.includes("맑음")) {
        if (courseConcept.includes("야외") || courseConcept.includes("활동적인")) penalty += 0.1;
    }
    return penalty;
}

function calculateConceptMatch(courseConcept: string | null, longTermConcepts: string[], goal: string): number {
    if (!courseConcept) return 0;
    const courseConcepts = [courseConcept];

    // 🟢 [UX 개선]: 일치하는 컨셉 개수 계산
    let matchCount = 0;
    longTermConcepts.forEach((pref) => {
        if (courseConcepts.some((c) => c.includes(pref) || pref.includes(c))) matchCount++;
    });

    // 오늘의 목적(goal) 기반 매칭 (ANNIVERSARY/100일/생일/연말 → 기념일, DATE → 데이트)
    const goalNorm =
        goal === "ANNIVERSARY" || goal === "100일" || goal === "생일" || goal === "연말"
            ? "기념일"
            : goal === "DATE"
              ? "데이트"
              : goal;
    const goalConceptMap: Record<string, string[]> = {
        기념일: ["프리미엄", "특별한", "로맨틱", "감성데이트", "인생샷"],
        데이트: ["로맨틱", "감성", "데이트"],
        힐링: ["힐링", "감성", "조용한"],
        활동: ["활동적인", "액티비티", "체험"],
    };
    (goalConceptMap[goalNorm] || []).forEach((gc) => {
        if (courseConcepts.some((c) => c.includes(gc) || gc.includes(c))) matchCount++;
    });

    // 🟢 UX 친화적 점수 계산: 하나만 맞아도 70%부터 시작
    if (matchCount === 0) return 0.2; // 일치하는게 하나도 없으면 낮게 측정
    if (longTermConcepts.length === 0 && !goal) return 0.5; // 데이터 없으면 중간값

    // 하나만 맞아도 기본 0.7(70%)부터 시작하고, 많이 맞을수록 가산점 (최대 3개까지 고려)
    return 0.7 + (Math.min(matchCount, 3) / 3) * 0.3;
}

function calculateMoodMatch(courseMoods: string[], longTermMoods: string[], moodToday: string): number {
    if (!courseMoods || courseMoods.length === 0) return 0;

    // 🟢 [UX 개선]: 일치하는 무드 개수 계산
    let matchCount = 0;
    longTermMoods.forEach((pref) => {
        if (courseMoods.some((m) => m.includes(pref) || pref.includes(m))) matchCount++;
    });

    // 오늘의 무드 기반 매칭 (트렌디한→힙한, 편안한→조용한 흡수)
    const moodMap: Record<string, string[]> = {
        조용한: ["조용한", "편안한", "프라이빗"],
        힙한: ["힙한", "트렌디한", "핫플"],
        활동적인: ["활동적인", "액티비티", "체험"],
    };
    (moodMap[moodToday] || []).forEach((tm) => {
        if (courseMoods.some((m) => m.includes(tm) || tm.includes(m))) matchCount++;
    });

    // 🟢 UX 친화적 점수 계산: 하나만 맞아도 70%부터 시작
    if (matchCount === 0) return 0.2; // 일치하는게 하나도 없으면 낮게 측정
    if (longTermMoods.length === 0 && !moodToday) return 0.5; // 데이터 없으면 중간값

    // 하나만 맞아도 기본 0.7(70%)부터 시작하고, 많이 맞을수록 가산점 (최대 3개까지 고려)
    return 0.7 + (Math.min(matchCount, 3) / 3) * 0.3;
}

function calculateRegionMatch(courseRegion: string | null, longTermRegions: string[], regionToday: string): number {
    if (!courseRegion) return 0.5; // 지역 정보 없으면 중간값

    // 🟢 지역이 맞지 않으면 점수를 대폭 깎음 (UX 개선)
    if (regionToday) {
        return courseRegion.includes(regionToday) || regionToday.includes(courseRegion) ? 1.0 : 0.1;
    }

    if (longTermRegions?.length > 0) {
        // 장기 선호 지역과 일치하면 높은 점수, 아니면 낮은 점수
        return longTermRegions.some((r) => courseRegion.includes(r) || r.includes(courseRegion)) ? 0.8 : 0.2;
    }

    return 0.5; // 선호 지역 정보가 없으면 중간값
}

/** goal별 Soft Gate: 기념일인데 힐링/찜질방 등 → 패널티 (오늘 선택이 방향 결정) */
function goalPenalty(course: any, goal: string): number {
    const isAnniversary =
        goal === "ANNIVERSARY" || goal === "기념일" || goal === "100일" || goal === "생일" || goal === "연말";
    if (!isAnniversary) return 0;

    const concept = String(course.concept ?? "");
    const title = String(course.title ?? "");
    const subTitle = String(course.sub_title ?? "");
    const tagsArr = Array.isArray(course.tags) ? course.tags : [];
    const text = [concept, title, subTitle, ...tagsArr.map((t: any) => String(t ?? ""))].join(" ");

    const badForAnniversary = ["힐링", "가성비", "찜질방", "편의점", "스파"];
    if (badForAnniversary.some((k) => text.includes(k))) return -0.3;
    return 0;
}

/** goalDetail 보너스: 100일/생일/연말에 맞는 컨셉 가산 (기념일일 때만) */
function goalDetailBonus(course: any, goal: string, goalDetail: string): number {
    if (goal !== "ANNIVERSARY") return 0;
    if (!goalDetail) return 0;
    const concept = String(course.concept ?? "");
    const mood = (course.mood ?? []).join(" ");

    if (goalDetail === "100일") {
        return concept.includes("감성") || concept.includes("로맨틱") || mood.includes("감성") ? 0.08 : 0;
    }
    if (goalDetail === "생일") {
        return concept.includes("프리미엄") || concept.includes("특별") || concept.includes("인생샷") ? 0.08 : 0;
    }
    if (goalDetail === "연말") {
        return concept.includes("야경") || concept.includes("감성") || mood.includes("감성") ? 0.08 : 0;
    }
    return 0;
}

function calculateGoalMatch(
    courseGoal: string | null,
    courseConcept: string | null,
    goal: string,
    companionToday: string,
): number {
    if (!goal) return 0;
    let score = 0;

    // 동반자 매칭 (온보딩/personalized-home 동행자 선택지 전체 지원)
    if (companionToday && courseGoal) {
        const companionMap: Record<string, string[]> = {
            연인: ["연인", "커플", "데이트"],
            친구: ["친구"],
            소개팅: ["데이트", "로맨틱", "감성", "소개팅"],
            "썸 상대": ["데이트", "로맨틱", "감성"],
            "소개팅 상대": ["데이트", "로맨틱", "감성", "소개팅"],
            혼자: ["혼자", "솔로", "나들이"],
        };
        if ((companionMap[companionToday] || []).some((ct) => courseGoal.includes(ct))) score += 0.5;
    }

    // goal 태그 매칭 (ANNIVERSARY/기념일 계열 → 기념일, DATE/일상 → 데이트)
    const goalNorm =
        goal === "ANNIVERSARY" || goal === "100일" || goal === "생일" || goal === "연말"
            ? "기념일"
            : goal === "DATE"
              ? "데이트"
              : goal;
    const goalTags: Record<string, string[]> = {
        기념일: ["기념일", "특별한", "로맨틱", "감성"],
        데이트: ["데이트", "로맨틱"],
        활동: ["활동적인", "액티비티", "체험"],
        힐링: ["힐링", "감성", "조용한"],
    };
    const goalKeywords = goalTags[goalNorm] || [];

    if (courseGoal && goalKeywords.some((gt) => courseGoal.includes(gt))) {
        score += 0.5;
    }
    if (courseConcept && goalKeywords.some((gt) => courseConcept.includes(gt))) {
        score += 0.5;
    }

    return Math.min(score, 1.0);
}

/** VALUE(분위기파 vs 실속파) 별도 가중치 */
function calculateValueMatch(course: any, userValue: string | null): number {
    if (!userValue) return 0.5;

    const concept = String(course.concept || "");
    const tagsObj = course.tags;
    const tagsStr =
        typeof tagsObj === "object" && tagsObj !== null
            ? JSON.stringify(tagsObj)
            : Array.isArray(tagsObj)
              ? tagsObj.join(" ")
              : String(tagsObj || "");
    const text = (concept + " " + tagsStr).toLowerCase();

    if (userValue === "visual") {
        return ["인생샷", "뷰", "프리미엄", "야경", "감성"].some((k) => text.includes(k.toLowerCase())) ? 1.0 : 0.4;
    }
    if (userValue === "taste") {
        return ["가성비", "맛집", "맛집탐방", "food_tour"].some((k) => text.includes(k.toLowerCase())) ? 1.0 : 0.4;
    }
    return 0.5;
}

/** 예산 매칭 (VALUE 미선택 시 추론: taste→3~5만, visual→5만+) */
function calculateBudgetMatch(course: any, userBudget: string | null, userValue: string | null): number {
    const budget = userBudget || (userValue === "taste" ? "3~5만원" : userValue === "visual" ? "5만원 이상" : null);
    if (!budget) return 0.5;

    const min = course.budget_min ?? 0;
    const max = course.budget_max ?? 999999;

    if (budget === "3만원 이하" || budget === "3만 이하") return max <= 30000 ? 1.0 : 0.25;
    if (budget === "3~5만원" || budget === "3-5만원") return min >= 15000 && max <= 60000 ? 1.0 : 0.5;
    if (budget === "5만원 이상" || budget === "5만 이상") return min >= 40000 ? 1.0 : 0.4;
    return 0.5;
}

/** 시간대 매칭 (CoursePlace.segment: brunch/dinner) */
function calculateTimeMatch(course: any, userTime: string | null): number {
    if (!userTime) return 0.5;
    const segments =
        course.coursePlaces?.map((p: any) => p.segment).filter(Boolean) || [];

    if (userTime === "점심" && segments.includes("brunch")) return 1.0;
    if (userTime === "저녁" && segments.includes("dinner")) return 1.0;
    if (userTime === "야간" && segments.some((s: string) => s?.includes("night") || s === "dinner")) return 0.9;
    return 0.6;
}

// ---------------------------------------------
// 🟢 [Fixed]: 데이터 희소성 해결을 위한 동적 가중치 정규화 로직
// ---------------------------------------------
function calculateNewRecommendationScore(course: any, longTermPrefs: any, todayContext: any): number {
    // 1. 기본 가중치 설정 (VALUE·예산·시간대 추가)
    const WEIGHTS = {
        concept: 0.22,
        mood: 0.22,
        region: 0.18,
        goal: 0.23,
        value: 0.1,
        budget: 0.05,
        time: 0.0, // 시간대: todayContext.timeOfDay 있을 때만 활성화
    };

    let weightedScoreSum = 0;
    let activeWeightTotal = 0;

    // 2. 컨셉/목적 매칭 (데이터가 있을 때만 가중치 합산)
    if ((longTermPrefs.concept && longTermPrefs.concept.length > 0) || todayContext.goal) {
        weightedScoreSum +=
            calculateConceptMatch(course.concept, longTermPrefs.concept || [], todayContext.goal || "") *
            WEIGHTS.concept;
        activeWeightTotal += WEIGHTS.concept;
    }

    // 3. 무드 매칭
    if ((longTermPrefs.mood && longTermPrefs.mood.length > 0) || todayContext.mood_today) {
        weightedScoreSum +=
            calculateMoodMatch(course.mood || [], longTermPrefs.mood || [], todayContext.mood_today || "") *
            WEIGHTS.mood;
        activeWeightTotal += WEIGHTS.mood;
    }

    // 4. 지역 매칭
    if ((longTermPrefs.regions && longTermPrefs.regions.length > 0) || todayContext.region_today) {
        weightedScoreSum +=
            calculateRegionMatch(course.region, longTermPrefs.regions || [], todayContext.region_today || "") *
            WEIGHTS.region;
        activeWeightTotal += WEIGHTS.region;
    }

    // 5. 목적/동반자 매칭
    if (todayContext.goal || todayContext.companion_today) {
        weightedScoreSum +=
            calculateGoalMatch(
                course.goal,
                course.concept,
                todayContext.goal || "",
                todayContext.companion_today || "",
            ) * WEIGHTS.goal;
        activeWeightTotal += WEIGHTS.goal;
    }

    // 5-1. VALUE(분위기파/실속파) 별도 가중치
    if (todayContext.value) {
        weightedScoreSum += calculateValueMatch(course, todayContext.value) * WEIGHTS.value;
        activeWeightTotal += WEIGHTS.value;
    }

    // 5-2. 예산 매칭 (VALUE에서 추론 가능)
    const effectiveBudget = todayContext.budget || (todayContext.value ? "infer" : null);
    if (effectiveBudget || todayContext.value) {
        weightedScoreSum +=
            calculateBudgetMatch(course, todayContext.budget || null, todayContext.value || null) *
            WEIGHTS.budget;
        activeWeightTotal += WEIGHTS.budget;
    }

    // 5-3. 시간대 매칭
    if (todayContext.timeOfDay) {
        const timeWeight = 0.08;
        weightedScoreSum += calculateTimeMatch(course, todayContext.timeOfDay) * timeWeight;
        activeWeightTotal += timeWeight;
    }

    // 6. 🟢 핵심: 입력된 정보가 하나라도 있다면 그 정보의 비중을 1.0으로 정규화
    // 정보가 전혀 없다면 기본 점수 0.5 부여
    let finalBaseScore = activeWeightTotal > 0 ? weightedScoreSum / activeWeightTotal : 0.5;

    // 7. 날씨 페널티
    finalBaseScore += calculateWeatherPenalty(course.concept, todayContext.weather_today || "");

    // 8. goal별 Soft Gate: 기념일인데 힐링/찜질방 등 → 패널티
    finalBaseScore += goalPenalty(course, todayContext.goal || "");

    return Math.max(0, Math.min(finalBaseScore, 1.0));
}

/** 🟢 주말 전용: Region V2 + 주말 날씨 모드 반영 */
function calculateWeekendRecommendationScore(
    course: any,
    longTermPrefs: any,
    todayContext: any,
    userPreferredGroupIds: Set<string>,
    weekendWeatherRisk: { rainLikely: boolean } | null,
    weekendMode: "safe" | "partial" | "strong" | null,
): number {
    const WEIGHTS = {
        concept: 0.21,
        mood: 0.21,
        region: 0.17,
        goal: 0.22,
        value: 0.1,
        budget: 0.05,
        time: 0.04,
    };
    let weightedScoreSum = 0;
    let activeWeightTotal = 0;

    if ((longTermPrefs.concept?.length > 0) || todayContext.goal) {
        weightedScoreSum +=
            calculateConceptMatch(course.concept, longTermPrefs.concept || [], todayContext.goal || "") *
            WEIGHTS.concept;
        activeWeightTotal += WEIGHTS.concept;
    }
    if ((longTermPrefs.mood?.length > 0) || todayContext.mood_today) {
        weightedScoreSum +=
            calculateMoodMatch(course.mood || [], longTermPrefs.mood || [], todayContext.mood_today || "") *
            WEIGHTS.mood;
        activeWeightTotal += WEIGHTS.mood;
    }
    if ((longTermPrefs.regions?.length > 0) || todayContext.region_today || userPreferredGroupIds.size > 0) {
        const regionScore =
            userPreferredGroupIds.size > 0
                ? calculateRegionMatchV2(course.region, userPreferredGroupIds, REGION_GROUPS)
                : calculateRegionMatch(
                      course.region,
                      longTermPrefs.regions || [],
                      todayContext.region_today || "",
                  );
        weightedScoreSum += regionScore * WEIGHTS.region;
        activeWeightTotal += WEIGHTS.region;
    }
    if (todayContext.goal || todayContext.companion_today) {
        weightedScoreSum +=
            calculateGoalMatch(
                course.goal,
                course.concept,
                todayContext.goal || "",
                todayContext.companion_today || "",
            ) * WEIGHTS.goal;
        activeWeightTotal += WEIGHTS.goal;
    }
    if (todayContext.value) {
        weightedScoreSum += calculateValueMatch(course, todayContext.value) * WEIGHTS.value;
        activeWeightTotal += WEIGHTS.value;
    }
    if (todayContext.budget || todayContext.value) {
        weightedScoreSum +=
            calculateBudgetMatch(course, todayContext.budget || null, todayContext.value || null) *
            WEIGHTS.budget;
        activeWeightTotal += WEIGHTS.budget;
    }
    if (todayContext.timeOfDay) {
        weightedScoreSum += calculateTimeMatch(course, todayContext.timeOfDay) * WEIGHTS.time;
        activeWeightTotal += WEIGHTS.time;
    }

    let finalBaseScore = activeWeightTotal > 0 ? weightedScoreSum / activeWeightTotal : 0.5;

    const indoorScore = getIndoorScore(course.concept);
    const outdoorOnly = isOutdoorOnly(course.concept);
    if (weekendWeatherRisk && weekendMode) {
        const rainRisk = weekendWeatherRisk.rainLikely || weekendMode === "safe";
        if (rainRisk) {
            if (outdoorOnly) finalBaseScore -= 0.35;
            else if (indoorScore >= 0.8) finalBaseScore += 0.1;
        } else if (weekendMode === "strong") {
            if (indoorScore >= 0.8) finalBaseScore += 0.03;
            if (outdoorOnly) finalBaseScore += 0.08;
        }
    }

    finalBaseScore += goalPenalty(course, todayContext.goal || "");
    return Math.max(0, Math.min(finalBaseScore, 1.0));
}

/** 매칭 이유 라벨 생성 (설명 없이 근거 키워드만) — 칩 UI용 */
function getMatchReason(
    course: any,
    longTermPrefs: any,
    todayContext: { goal?: string; goal_detail?: string; mood_today?: string; region_today?: string },
    hasLongTermPreferences: boolean,
): string {
    const isAnniversary =
        todayContext.goal === "ANNIVERSARY" || ["100일", "생일", "연말"].includes(todayContext.goal_detail || "");

    if (hasLongTermPreferences) {
        const userConcepts = longTermPrefs.concept || [];
        const userMoods = longTermPrefs.mood || [];
        const userRegions = longTermPrefs.regions || [];
        const courseConcept = course.concept || "";
        const courseMoods = Array.isArray(course.mood) ? course.mood : [];
        const courseRegion = course.region || "";

        if (userConcepts.length > 0 && courseConcept && userConcepts.some((c: string) => courseConcept.includes(c))) {
            const matched = userConcepts.find((c: string) => courseConcept.includes(c));
            return `취향: ${matched || courseConcept}`;
        }
        if (userMoods.length > 0 && courseMoods.some((m: string) => userMoods.includes(m))) {
            const matched = courseMoods.find((m: string) => userMoods.includes(m));
            return `무드: ${matched}`;
        }
        if (userRegions.length > 0 && courseRegion) {
            const regionGroup = REGION_GROUPS.find((g) => g.dbValues.some((v) => courseRegion.includes(v)));
            if (regionGroup && userRegions.some((r: string) => (regionGroup.dbValues as readonly string[]).includes(r))) {
                return `지역: ${regionGroup.label}`;
            }
        }
        if (userConcepts[0]) return `취향: ${userConcepts[0]}`;
        if (userMoods[0]) return `무드: ${userMoods[0]}`;
        if (userRegions[0]) return `지역: ${courseRegion || "근처"}`;
    }
    const { mood_today, region_today, goal_detail } = todayContext;
    const prefix = isAnniversary ? (goal_detail || "기준") : "오늘";
    if (region_today && mood_today) return `${prefix}: ${region_today} · ${mood_today}`;
    if (region_today) return `${prefix}: ${region_today}`;
    if (mood_today) return `${prefix}: ${mood_today}`;
    return isAnniversary ? `${goal_detail || "기준"} 기준` : "오늘 기준";
}

// ---------------------------------------------
// 🚀 [메인 GET 핸들러]
// ---------------------------------------------

export async function GET(req: NextRequest) {
    try {
        // 🟢 [보안] Rate limiting: 추천 API 남용 방지
        const userIdForRl = resolveUserId(req);
        const identifier = userIdForRl ? `user:${userIdForRl}` : getIdentifierFromRequest(req);
        const rl = await checkRateLimit("recommendation", identifier);
        if (!rl.success) {
            return NextResponse.json(
                { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", tier: "FREE", limit: rl.limit, used: rl.limit - rl.remaining },
                { status: 429, headers: { "X-RateLimit-Limit": String(rl.limit), "X-RateLimit-Remaining": String(rl.remaining) } }
            );
        }

        const userId = userIdForRl;
        const { searchParams } = new URL(req.url);
        const mode = searchParams.get("mode");
        const limit = Math.min(Math.max(Number(searchParams.get("limit") || 6), 1), 24);
        const goal = searchParams.get("goal") || "";
        const goalDetail = searchParams.get("goal_detail") || "";
        const companionToday = searchParams.get("companion_today") || "";
        const moodToday = searchParams.get("mood_today") || "";
        const regionToday = searchParams.get("region_today") || "";
        const strictRegion = searchParams.get("strict") === "true";
        const dayTypeParam = searchParams.get("dayType") as "today" | "weekend" | null;

        let longTermPrefs: any = {};
        let recentBehaviorData: any = { concepts: [], regions: [], moods: [], goals: [] };

        // 🟢 유저 등급 조회 (메인 추천·오늘의 데이트 모두 등급별 필터에 사용)
        let userTier: "FREE" | "BASIC" | "PREMIUM" = "FREE";
        if (userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { subscriptionTier: true },
            });
            const t = user?.subscriptionTier?.toUpperCase?.();
            if (t === "BASIC" || t === "PREMIUM") userTier = t;
        }
        if (userId && mode === "ai") {
            // 🟢 등급별 1일 추천 한도 체크 (FREE 1회, BASIC 5회, PREMIUM 무제한)
            const limit = getRecommendationDailyLimit(userTier);
            if (limit < Number.POSITIVE_INFINITY) {
                const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
                const y = kst.getFullYear();
                const m = kst.getMonth();
                const d = kst.getDate();
                const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - 9 * 3600 * 1000);
                const endUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - 9 * 3600 * 1000);
                const usedToday = await (prisma as any).aiRecommendationUsage.count({
                    where: {
                        userId,
                        usedAt: { gte: startUtc, lte: endUtc },
                    },
                });
                if (usedToday >= limit) {
                    return NextResponse.json(
                        {
                            error: "오늘 사용 횟수를 초과했습니다. 내일 다시 시도해주세요.",
                            tier: userTier,
                            limit,
                            used: usedToday,
                        },
                        { status: 429 },
                    );
                }
            }
        }

        // 🟢 [Fixed]: 개별 처리로 TypeScript 타입 추론 에러(18047, 2339) 해결
        let savedCourseIds: number[] = []; // 🟢 이미 저장한 코스 ID 목록
        if (userId) {
            const [prefsData, interactionData, savedCourses] = await Promise.all([
                prisma.userPreference
                    .findUnique({
                        where: { userId },
                        select: { preferences: true },
                    })
                    .catch(() => null),
                (prisma as any).userInteraction
                    .findMany({
                        where: { userId, action: { in: ["view", "like", "save", "start", "complete"] } },
                        orderBy: { createdAt: "desc" },
                        take: 50,
                        select: {
                            action: true, // 🔥 행동 유형 추가
                            course: {
                                select: {
                                    concept: true,
                                    region: true,
                                    mood: true, // 🔥 컬럼으로 변경
                                    goal: true, // 🔥 컬럼으로 변경
                                },
                            },
                        },
                    })
                    .catch(() => []), // 🟢 에러 시 빈 배열 반환하여 'null' 가능성 제거 (18047 해결)
                // 🟢 오늘의 데이트 추천 모드일 때만 이미 저장한 코스 목록 조회
                mode === "ai"
                    ? prisma.savedCourse
                          .findMany({
                              where: { userId },
                              select: { courseId: true },
                          })
                          .catch(() => [])
                    : Promise.resolve([]),
            ]);

            if (prefsData?.preferences) {
                longTermPrefs = prefsData.preferences; // 🟢 명확한 속성 접근 (2339 해결)
            }

            // 🔥 다차원 분석: concept, region, mood, goal 추출 + 행동 유형별 가중치 적용
            const ACTION_WEIGHTS: { [key: string]: number } = {
                like: 1.0,
                view: 0.3,
                save: 0.8,
                start: 1.1,
                complete: 1.5,
            };

            interactionData.forEach((interaction: any) => {
                const weight = ACTION_WEIGHTS[interaction.action] || 0.3;
                const course = interaction.course;

                if (!course) return;

                // Concept
                if (course.concept) {
                    for (let i = 0; i < weight * 10; i++) {
                        recentBehaviorData.concepts.push(course.concept);
                    }
                }

                // Region
                if (course.region) {
                    for (let i = 0; i < weight * 10; i++) {
                        recentBehaviorData.regions.push(course.region);
                    }
                }

                // Mood (배열이므로 각각 추가)
                if (course.mood && Array.isArray(course.mood)) {
                    course.mood.forEach((m: string) => {
                        for (let i = 0; i < weight * 10; i++) {
                            recentBehaviorData.moods.push(m);
                        }
                    });
                }

                // Goal (컬럼에서 추출)
                if (course.goal) {
                    for (let i = 0; i < weight * 10; i++) {
                        recentBehaviorData.goals.push(course.goal);
                    }
                }
            });

            // 🔥 패턴 분석 결과를 DB에 저장 (비동기로 저장, 추천 결과에는 영향 없음)
            if (recentBehaviorData.concepts.length > 0) {
                // 배열을 빈도 카운트 객체로 변환
                const countFrequency = (arr: string[]) => {
                    const freq: { [key: string]: number } = {};
                    arr.forEach((item) => {
                        freq[item] = (freq[item] || 0) + 1;
                    });
                    return freq;
                };

                const conceptPattern = countFrequency(recentBehaviorData.concepts);
                const regionPattern = countFrequency(recentBehaviorData.regions);
                const moodPattern = countFrequency(recentBehaviorData.moods);
                const goalPattern = countFrequency(recentBehaviorData.goals);

                // 비동기로 저장 (추천 API 응답에 영향 없음)
                (prisma as any).userBehaviorPattern
                    .create({
                        data: {
                            userId,
                            conceptPattern,
                            regionPattern,
                            moodPattern,
                            goalPattern,
                        },
                    })
                    .catch((err: any) => {
                        console.error("패턴 저장 실패:", err);
                    });
            }

            savedCourseIds = Array.isArray(savedCourses) ? savedCourses.map((sc: any) => sc.courseId) : [];
        }

        const whereConditions: any = { isPublic: true };
        if (mode === "ai") {
            // 🟢 오늘의 데이트 추천: FREE/BASIC/PREMIUM 모두 조회 후 등급별 필터링
            whereConditions.grade = { in: ["FREE", "BASIC", "PREMIUM"] };
        } else {
            // 🟢 메인 추천 (PersonalizedSection): 등급별 필터
            // 미로그인 & FREE: FREE만 | BASIC: BASIC+FREE | PREMIUM: 전체
            if (!userId || userTier === "FREE") {
                whereConditions.grade = "FREE";
            } else if (userTier === "BASIC") {
                whereConditions.grade = { in: ["FREE", "BASIC"] };
            } else {
                whereConditions.grade = { in: ["FREE", "BASIC", "PREMIUM"] };
            }
        }
        // 🟢 strict 모드: UI 선택지(예: "홍대 · 연남 · 신촌")를 행정구역명(예: "마포구")으로 매핑해 DB 조회 (그대로 쓰면 0건)
        let usedStrictRegion = false;
        if (strictRegion && regionToday) {
            const regionForQuery = regionMapping[regionToday] || regionToday;
            whereConditions.region = { contains: regionForQuery };
            usedStrictRegion = true;
        }

        // 🟢 [주석처리] 이미 저장한 코스 제외 - BASIC+PREMIUM 2개 추천을 위해 제외하지 않음
        // if (mode === "ai" && savedCourseIds.length > 0) {
        //     whereConditions.id = { notIn: savedCourseIds };
        // }

        const courseSelect = {
            id: true,
            title: true,
            sub_title: true,
            description: true,
            imageUrl: true,
            region: true,
            concept: true,
            rating: true,
            view_count: true,
            createdAt: true,
            mood: true,
            goal: true,
            scene: true,
            target_audience: true,
            budget_level: true,
            budget_range: true,
            budget_min: true,
            budget_max: true,
            route_difficulty: true,
            target_description: true,
            perfect_for: true,
            tags: true,
            is_editor_pick: true,
            grade: true,
            coursePlaces: {
                take: 10,
                select: {
                    order_index: true,
                    segment: true,
                    place: {
                        select: {
                            id: true,
                            name: true,
                            imageUrl: true,
                            reservationUrl: true,
                            category: true,
                            address: true,
                        },
                    },
                },
                orderBy: { order_index: "asc" },
            },
        };

        let allCourses = await (prisma as any).course.findMany({
            where: whereConditions,
            take: 200,
            select: courseSelect,
        });

        // 🟢 strict 지역 필터 결과 0건이면 지역 조건 제거 후 재조회 (추천 결과는 항상 보이도록)
        if (usedStrictRegion && allCourses.length === 0) {
            delete whereConditions.region;
            allCourses = await (prisma as any).course.findMany({
                where: whereConditions,
                take: 200,
                select: courseSelect,
            });
        }

        if (!userId) {
            const byViews = allCourses.sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0));
            const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
            const dateSeed =
                kst.getFullYear() * 10000 + (kst.getMonth() + 1) * 100 + kst.getDate();
            const poolSize = Math.min(10, byViews.length);
            const todayFirstIdx = poolSize > 0 ? dateSeed % poolSize : 0;
            const todayFirst = byViews[todayFirstIdx];
            const rest = byViews.filter((c: any) => c.id !== todayFirst?.id).slice(0, limit - 1);
            const popular = todayFirst ? [todayFirst, ...rest] : byViews.slice(0, limit);
            const dayType: DayType = kst.getDay() === 0 || kst.getDay() === 6 ? "weekend" : "today";
            const guestChipContext: ChipContext = { dayType };
            const popularWithChips = popular.map((c: any) => ({
                ...c,
                id: String(c.id),
                imageUrl: c.imageUrl || c.coursePlaces?.[0]?.place?.imageUrl || "",
                chips: getChips(
                    { region: c.region, concept: c.concept, mood: c.mood, goal: c.goal, coursePlaces: c.coursePlaces },
                    guestChipContext,
                    3,
                ),
            }));
            return NextResponse.json({
                recommendations: popularWithChips,
                hasOnboardingData: false,
                upsellFor: mode === "ai" ? ("BASIC" as const) : undefined,
            });
        }

        // 🟢 날씨 정보 조회: regionToday가 없으면 온보딩에서 저장한 첫 번째 지역 사용
        let weatherToday = "";
        const rawRegion = regionToday || longTermPrefs.regions?.[0] || "";
        if (rawRegion) {
            // UI 텍스트를 행정구역명으로 매핑 (온보딩 선택지 → 구 단위)
            const searchKeyword = regionMapping[rawRegion] || rawRegion;

            const sidoName =
                (searchKeyword.split(" ")[0] || "").replace(/시|도$/g, "") === "서울"
                    ? "서울특별시"
                    : searchKeyword.split(" ")[0];

            const gridData = await prisma.gridCode.findFirst({
                where: { region_name: { contains: searchKeyword } },
                select: { nx: true, ny: true },
            });

            const [kma, air] = await Promise.all([
                gridData ? fetchWeatherAndCache(gridData.nx, gridData.ny) : Promise.resolve(null),
                fetchAirQualityStatus(sidoName),
            ]);
            weatherToday = [kma, air].filter(Boolean).join("/");
        }

        // 🟢 주말 모드: 단기예보로 토요일 날씨 조회
        let weekendWeatherRisk: { rainLikely: boolean; confidence: string } | null = null;
        if (dayTypeParam === "weekend" && userId) {
            const rawRegion = regionToday || longTermPrefs.regions?.[0] || "";
            if (rawRegion) {
                const searchKeyword = regionMapping[rawRegion] || rawRegion;
                const gridData = await prisma.gridCode.findFirst({
                    where: { region_name: { contains: searchKeyword } },
                    select: { nx: true, ny: true },
                });
                if (gridData && KMA_API_KEY) {
                    const fcstItems = await fetchWeekendForecast(gridData.nx, gridData.ny, KMA_API_KEY);
                    const targetStr = getWeekendTargetDateStr();
                    weekendWeatherRisk = getWeekendWeatherRisk(fcstItems, targetStr);
                }
            }
            if (!weekendWeatherRisk) {
                weekendWeatherRisk = { rainLikely: false, confidence: "low" };
            }
        }

        // 🟢 companion_today가 비면 온보딩에서 저장한 longTermPrefs.companion 사용 (메인 추천 정확도 향상)
        const effectiveCompanionToday = companionToday || (longTermPrefs?.companion || "");

        const todayContext = {
            goal,
            goal_detail: goalDetail,
            companion_today: effectiveCompanionToday,
            mood_today: moodToday,
            region_today: regionToday,
            weather_today: weatherToday,
            value: (searchParams.get("value_today") || longTermPrefs?.value || "") || null,
            budget: (searchParams.get("budget") || longTermPrefs?.budgetRange || null) || null,
            timeOfDay: (searchParams.get("timeOfDay") || longTermPrefs?.timeOfDay || "") || null,
        };

        // 🟢 온보딩 완료 여부: 장기 선호도(분위기/가치관/지역)가 있어야 함 (오늘 질문만 있으면 X)
        const hasLongTermPreferences =
            (longTermPrefs.concept && longTermPrefs.concept.length > 0) ||
            (longTermPrefs.mood && longTermPrefs.mood.length > 0) ||
            (longTermPrefs.regions && longTermPrefs.regions.length > 0);

        // 🟢 선호도 데이터나 오늘의 컨텍스트가 하나라도 있어야 점수 계산 (온보딩 companion/value 포함)
        const hasOnboardingData =
            hasLongTermPreferences ||
            goal ||
            effectiveCompanionToday ||
            moodToday ||
            regionToday ||
            !!todayContext.value ||
            !!todayContext.budget ||
            !!todayContext.timeOfDay;

        // 🟢 주말 모드: 유저 선호 권역 (recentBehavior + longTerm 합쳐서)
        const userRegionList =
            dayTypeParam === "weekend"
                ? [
                      ...recentBehaviorData.regions,
                      ...(Array.isArray(longTermPrefs.regions) ? longTermPrefs.regions : []),
                  ]
                : [];
        const userPreferredGroupIds =
            dayTypeParam === "weekend" && userRegionList.length > 0
                ? getUserPreferredGroupIds(userRegionList, REGION_GROUPS, 5)
                : new Set<string>();

        const weekendMode =
            dayTypeParam === "weekend" ? getWeekendMode(getDaysUntilWeekend()) : null;
        const treatAsRainRisk =
            dayTypeParam === "weekend" &&
            weekendWeatherRisk &&
            (weekendMode === "safe" || weekendWeatherRisk.rainLikely);

        const scoredCourses = allCourses.map((course: any) => {
            // 🟢 온보딩 데이터가 없으면 matchScore를 null로 설정 (취향저격 표시 안 함)
            if (!hasOnboardingData) {
                return {
                    ...course,
                    id: String(course.id),
                    imageUrl: course.imageUrl || course.coursePlaces?.[0]?.place?.imageUrl || "",
                    matchScore: null,
                };
            }

            if (treatAsRainRisk && isOutdoorOnly(course.concept)) {
                return {
                    ...course,
                    id: String(course.id),
                    imageUrl: course.imageUrl || course.coursePlaces?.[0]?.place?.imageUrl || "",
                    matchScore: 0,
                };
            }

            const baseScore =
                dayTypeParam === "weekend" && weekendMode && weekendWeatherRisk
                    ? calculateWeekendRecommendationScore(
                          course,
                          longTermPrefs,
                          todayContext,
                          userPreferredGroupIds,
                          weekendWeatherRisk,
                          weekendMode,
                      )
                    : calculateNewRecommendationScore(course, longTermPrefs, todayContext);
            let bonus = 0;

            // goalDetail 보너스 (100일/생일/연말) - 기념일일 때만 적용
            bonus += goalDetailBonus(course, todayContext.goal, todayContext.goal_detail || "");

            // 에디터 추천 보너스
            if (course.is_editor_pick) bonus += 0.1;

            // 🔥 다차원 최근 행동 패턴 보너스 (가중치 반영)
            const conceptFreq = recentBehaviorData.concepts.filter((c: string) => c === course.concept).length;
            const regionFreq = recentBehaviorData.regions.filter((r: string) => r === course.region).length;

            // mood는 배열이므로 각 mood에 대해 빈도 체크
            const moodFreq =
                course.mood && Array.isArray(course.mood)
                    ? course.mood.reduce(
                          (sum: number, m: string) =>
                              sum + recentBehaviorData.moods.filter((rm: string) => rm === m).length,
                          0,
                      )
                    : 0;

            const goalFreq = course.goal ? recentBehaviorData.goals.filter((g: string) => g === course.goal).length : 0;

            // 빈도를 정규화해서 보너스 계산 (최대 50회 = 1.0 가중치로 가정)
            bonus += Math.min((conceptFreq / 50) * 0.15, 0.15); // concept: 최대 0.15
            bonus += Math.min((regionFreq / 50) * 0.1, 0.1); // region: 최대 0.1
            bonus += Math.min((moodFreq / 50) * 0.1, 0.1); // mood: 최대 0.1
            bonus += Math.min((goalFreq / 50) * 0.1, 0.1); // goal: 최대 0.1

            const finalScore = Math.min(baseScore + bonus, 1.0);

            // 🟢 UX 스케일링: 0.0~1.0의 범위를 0.6(60%) ~ 0.98(98%)로 변환
            // 점수가 낮아도 '취향저격 60%'부터 시작하게 하여 긍정적 경험 제공
            const uxScore = finalScore > 0 ? 0.6 + finalScore * 0.38 : 0;

            return {
                ...course,
                id: String(course.id),
                imageUrl: course.imageUrl || course.coursePlaces?.[0]?.place?.imageUrl || "",
                matchScore: Math.min(uxScore, 1.0),
            };
        });

        (prisma as any).locationLog
            .create({ data: { userId, purpose: "DATE_COURSE_RECOMMENDATION" } })
            .catch(() => {});

        // 🟢 비/눈일 때 야외·공원 코스는 추천에서 제외 (오늘) | 주말은 treatAsRainRisk 시 야외-only 제외
        let candidates = scoredCourses;
        if (dayTypeParam === "weekend" && treatAsRainRisk) {
            candidates = scoredCourses.filter((c: any) => !isOutdoorOnly(c.concept));
        } else if (weatherToday.includes("비") || weatherToday.includes("눈")) {
            candidates = scoredCourses.filter(
                (c: any) => !c.concept?.includes("야외") && !c.concept?.includes("공원"),
            );
        }

        const sorted = candidates.sort((a: any, b: any) => {
            if (a.matchScore === null && b.matchScore === null) return 0;
            if (a.matchScore === null) return 1;
            if (b.matchScore === null) return -1;
            return b.matchScore - a.matchScore;
        });

        // 🟢 AI 모드: 이미 저장한 코스 제외 (이전 추천에서 저장한 코스는 다시 추천하지 않음)
        const excludeIds =
            mode === "ai" && savedCourseIds.length > 0
                ? new Set(savedCourseIds.map((id: number) => Number(id)))
                : new Set<number>();
        const sortedFiltered =
            mode === "ai" && excludeIds.size > 0 ? sorted.filter((c: any) => !excludeIds.has(Number(c.id))) : sorted;

        // 🟢 KST 날짜 시드: 같은 날엔 같은 결과. weekend는 dayType 포함해 today와 다른 1등 선택
        const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        const dateSeed =
            kstNow.getFullYear() * 10000 + (kstNow.getMonth() + 1) * 100 + kstNow.getDate();
        const seedWithDayType =
            dateSeed * 10 + (dayTypeParam === "weekend" ? 7 : 0);

        // 상위 10개 풀에서 날짜 시드로 1등 고르기 (맞춤형 유지 + 일별 변동)
        const poolSize = Math.min(10, sorted.length);
        const todayFirstIdx = poolSize > 0 ? seedWithDayType % poolSize : 0;
        const todayFirst = sorted[todayFirstIdx];
        const rest = sorted.filter((c: any) => c.id !== todayFirst?.id).slice(0, limit - 1);
        const dateRotated = todayFirst ? [todayFirst, ...rest] : sorted.slice(0, limit);

        // 🟢 오늘의 데이트 추천: 등급별 1개씩 + 업셀 안내 (AI 모드: 저장한 코스 제외된 풀에서 선택)
        let finalRecs: any[] = mode === "ai" ? sortedFiltered.slice(0, limit) : dateRotated;
        let upsellFor: "BASIC" | "PREMIUM" | null = null;

        if (mode === "ai") {
            const byGrade = (g: string) => sortedFiltered.filter((c: any) => (c.grade || "FREE") === g);
            const freeList = byGrade("FREE");
            const basicList = byGrade("BASIC");
            const premiumList = byGrade("PREMIUM");

            // 🟢 FREE: FREE 1개 + BASIC 1개 | BASIC: FREE+BASIC 1개 + PREMIUM 1개 | PREMIUM: 전체 코스에서 매칭 1등 1개
            if (userTier === "FREE") {
                const oneFree = freeList[0];
                const oneBasic = basicList[0];
                finalRecs = [oneFree, oneBasic].filter(Boolean);
                upsellFor = "BASIC";
            } else if (userTier === "BASIC") {
                const freeOrBasicList = sortedFiltered.filter(
                    (c: any) => (c.grade || "FREE") === "FREE" || (c.grade || "FREE") === "BASIC",
                );
                const oneFreeOrBasic = freeOrBasicList[0];
                const onePremium = premiumList[0];
                finalRecs = [oneFreeOrBasic, onePremium].filter(Boolean);
                upsellFor = "PREMIUM";
            } else {
                // PREMIUM: 등급 제한 없이 전체 풀에서 매칭 점수 1등 1개 추천
                finalRecs = sortedFiltered.slice(0, 1);
                upsellFor = null;
            }
        }

        // 칩: 코스 × 유저 상태 비교 → 상위 3개
        const dayType: DayType =
            (() => {
                if (dayTypeParam === "weekend" || dayTypeParam === "today") return dayTypeParam;
                const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
                const d = kst.getDay();
                return d === 0 || d === 6 ? "weekend" : "today";
            })();
        const chipContext: ChipContext = {
            dayType,
            companionToday: companionToday || undefined,
            weatherToday:
                dayTypeParam === "weekend" && weekendWeatherRisk?.rainLikely
                    ? "비/눈"
                    : weatherToday || undefined,
            userRegions: longTermPrefs.regions,
        };
        const recommendationsWithChips = finalRecs.map((c: any) => ({
            ...c,
            chips: getChips(
                {
                    region: c.region,
                    concept: c.concept,
                    mood: c.mood,
                    goal: c.goal,
                    coursePlaces: c.coursePlaces,
                },
                chipContext,
                3,
            ),
            matchReason: getMatchReason(c, longTermPrefs, todayContext, hasLongTermPreferences),
        }));

        // 🟢 AI 추천 사용 로그 기록 (등급별 한도용)
        if (userId && mode === "ai") {
            (prisma as any)
                .aiRecommendationUsage.create({
                    data: { userId },
                })
                .catch((err: unknown) => console.error("AiRecommendationUsage create 실패:", err));
        }

        return NextResponse.json({
            recommendations: recommendationsWithChips,
            hasOnboardingData: hasOnboardingData,
            hasLongTermPreferences,
            upsellFor: upsellFor,
            userTier: userTier,
        });
    } catch (e: any) {
            captureApiError(e);
        console.error("Recommendation Error:", e.message);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
