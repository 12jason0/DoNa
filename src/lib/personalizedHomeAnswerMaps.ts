/**
 * 맞춤 홈 질문 답변: UI·저장용 안정 코드 ↔ 추천 API가 기대하는 한국어 문맥
 */

export const GOAL_DETAIL_CODE_TO_API: Record<string, string> = {
    day100: "100일",
    birthday: "생일",
    yearend: "연말",
};

/** purpose_today 선택 코드 → goal / mood (기념일의 세부 goal_detail은 별도 처리) */
export const PURPOSE_CODE_TO_GOAL_MOOD: Record<
    string,
    { goal: string; goalDetail: string; moodToday: string }
> = {
    anniversary: { goal: "ANNIVERSARY", goalDetail: "", moodToday: "" },
    casual: { goal: "DATE", goalDetail: "", moodToday: "" },
    emotional: { goal: "힐링", goalDetail: "", moodToday: "조용한" },
    active: { goal: "활동", goalDetail: "", moodToday: "활동적인" },
    trendy: { goal: "DATE", goalDetail: "", moodToday: "힙한" },
};

export const COMPANION_CODE_TO_API: Record<string, string> = {
    lover: "연인",
    some: "썸 상대",
    blind: "소개팅 상대",
    friend: "친구",
    alone: "혼자",
};

export const REGION_CODE_TO_API: Record<string, string> = {
    mulla_yeongdeungpo: "문래·영등포",
    hapjeong_yongsan: "합정·용산",
    anguk_seochon: "안국·서촌",
    euljiro: "을지로",
    yeouido: "여의도",
};

const LEGACY_PURPOSE: Record<string, keyof typeof PURPOSE_CODE_TO_GOAL_MOOD> = {
    기념일: "anniversary",
    무난: "casual",
    감성: "emotional",
    활동: "active",
    트렌디: "trendy",
};

const LEGACY_GOAL_DETAIL: Record<string, keyof typeof GOAL_DETAIL_CODE_TO_API> = {
    "100일": "day100",
    생일: "birthday",
    연말: "yearend",
};

const LEGACY_COMPANION: Record<string, keyof typeof COMPANION_CODE_TO_API> = {
    연인: "lover",
    "썸 상대": "some",
    "소개팅 상대": "blind",
    친구: "friend",
    혼자: "alone",
};

const LEGACY_REGION: Record<string, keyof typeof REGION_CODE_TO_API> = {
    "문래·영등포": "mulla_yeongdeungpo",
    "합정·용산": "hapjeong_yongsan",
    "안국·서촌": "anguk_seochon",
    을지로: "euljiro",
    여의도: "yeouido",
};

const PURPOSE_CODE_TO_FEEDBACK_KO: Record<string, string> = {
    anniversary: "기념일",
    casual: "무난",
    emotional: "감성",
    active: "활동",
    trendy: "트렌디",
};

export function normalizePurposeCode(raw: string): string {
    if (!raw) return "";
    if (PURPOSE_CODE_TO_GOAL_MOOD[raw]) return raw;
    return LEGACY_PURPOSE[raw] || raw;
}

export function normalizeGoalDetailCode(raw: string): string {
    if (!raw) return "";
    if (GOAL_DETAIL_CODE_TO_API[raw]) return raw;
    return LEGACY_GOAL_DETAIL[raw] || raw;
}

export function normalizeCompanionCode(raw: string): string {
    if (!raw) return "";
    if (COMPANION_CODE_TO_API[raw]) return raw;
    return LEGACY_COMPANION[raw] || raw;
}

export function normalizeRegionCode(raw: string): string {
    if (!raw) return "";
    if (REGION_CODE_TO_API[raw]) return raw;
    return LEGACY_REGION[raw] || raw;
}

/** 피드백·저장용: 코드 기반 답변을 API·대시보드용 한국어 문맥으로 */
export function answersToKoreanContext(answers: Record<string, string>): Record<string, string> {
    const p = normalizePurposeCode(answers.purpose_today || "");
    const gd = normalizeGoalDetailCode(answers.goal_detail || "");
    const c = normalizeCompanionCode(answers.companion_today || "");
    const r = normalizeRegionCode(answers.region_today || "");
    return {
        purpose_today: PURPOSE_CODE_TO_FEEDBACK_KO[p] || answers.purpose_today || "",
        goal_detail: gd ? GOAL_DETAIL_CODE_TO_API[gd] || answers.goal_detail || "" : "",
        companion_today: c ? COMPANION_CODE_TO_API[c] || answers.companion_today || "" : "",
        region_today: r ? REGION_CODE_TO_API[r] || answers.region_today || "" : "",
    };
}
