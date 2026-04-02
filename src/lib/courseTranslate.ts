/**
 * 코스 제목·컨셉 locale별 번역
 * - 컨셉: 정적 매핑 (courseConcept)
 * - 제목: API 번역 (선택, DEEPL_AUTH_KEY 있을 때만)
 * - 장소명·주소: 원문 유지 (번역 안 함)
 */

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

/** 동적 i18n 키용 — 페이지의 `t`(TranslationKeys)는 호출부에서 이 타입으로 단언 */
export type CourseUiTranslate = TranslateFn;

/** DB concept/mood/target → courseConcept 번역 키 매핑 (표시용 한국어 canonical 이름) */
const CONCEPT_MAP: Array<{ keyword: string; key: string }> = [
    // 컨셉
    { keyword: "이색데이트", key: "unique" },
    { keyword: "감성데이트", key: "emotionalDate" },
    { keyword: "맛집탐방", key: "foodTour" },
    { keyword: "실내데이트", key: "indoorDate" },
    { keyword: "카페투어", key: "cafeTour" },
    { keyword: "공연·전시", key: "exhibition" },
    { keyword: "전시관람", key: "exhibitionViewing" },
    { keyword: "야경", key: "nightView" },
    { keyword: "힐링", key: "healing" },
    { keyword: "가성비", key: "cost" },
    { keyword: "인생샷", key: "photoSpot" },
    { keyword: "술자리", key: "drinking" },
    { keyword: "액티비티", key: "activity" },
    { keyword: "신상", key: "newArrival" },
    { keyword: "핫플레이스", key: "hotPlace" },
    { keyword: "핫플", key: "hotPlace" },
    { keyword: "힙스터", key: "hipster" },
    { keyword: "주점", key: "bar" },
    { keyword: "맛집", key: "food" },
    { keyword: "감성", key: "emotional" },
    { keyword: "데이트", key: "default" },
    // 분위기(Mood)
    { keyword: "로맨틱", key: "romantic" },
    { keyword: "고급스러운", key: "premiumMood" },
    { keyword: "이국적인", key: "exotic" },
    { keyword: "힙한", key: "hip" },
    { keyword: "활기찬", key: "lively" },
    { keyword: "레트로", key: "retro" },
    { keyword: "조용한", key: "quiet" },
    // 상황(Target)
    { keyword: "연인", key: "couple" },
    { keyword: "기념일", key: "anniversary" },
    { keyword: "소개팅", key: "blindDate" },
    { keyword: "친구", key: "friends" },
    { keyword: "가족", key: "family" },
    { keyword: "혼자", key: "solo" },
    { keyword: "썸", key: "some" },
    // 조건
    { keyword: "비오는날", key: "rainy" },
    { keyword: "실내", key: "indoor" },
    { keyword: "야외", key: "outdoor" },
];

/** 긴 키워드 우선 매칭 (예: "감성"이 "감성데이트"보다 먼저 잡히지 않도록) */
const CONCEPT_MAP_SORTED = [...CONCEPT_MAP].sort((a, b) => b.keyword.length - a.keyword.length);

/**
 * 컨셉 문자열을 locale에 맞게 번역
 * @param concept DB에서 온 concept (예: "힐링", "맛집 탐방")
 * @param t useLocale().t
 * @returns 번역된 컨셉 또는 원문
 */
/** DB/관리자 UI region 코드 → i18n (문구는 onboarding.region.*) */
const REGION_KEY_MAP: Record<string, string> = {
    SEONGSU: "onboarding.region.SEONGSU",
    HONGDAE: "onboarding.region.HONGDAE",
    JONGNO: "onboarding.region.JONGNO",
    GANGNAM: "onboarding.region.GANGNAM",
    YONGSAN: "onboarding.region.YONGSAN",
    JAMSIL: "onboarding.region.JAMSIL",
    YEOUIDO: "onboarding.region.YEOUIDO",
    MAPO: "onboarding.region.MAPO",
    EULJIRO: "onboarding.region.EULJIRO",
};

/**
 * DB region 값(대문자 코드 또는 한국어 동네명)을 locale에 맞게 번역
 * @param region course.region (예: "SEONGSU", "성수")
 */
export function translateCourseRegion(region: string | null | undefined, t: TranslateFn): string {
    if (!region?.trim()) return "";
    const raw = region.trim();
    const upper = raw.toUpperCase();
    const byCode = REGION_KEY_MAP[upper];
    if (byCode) {
        const translated = t(byCode);
        return translated || raw;
    }
    // 상세/리스트 표시는 DB 단일 지명을 그대로 유지한다.
    return raw;
}

export function translateCourseConcept(concept: string | null | undefined, t: TranslateFn): string {
    if (!concept?.trim()) return t("courseConcept.default");
    const c = concept.trim();
    for (const { keyword, key } of CONCEPT_MAP_SORTED) {
        if (c.includes(keyword)) {
            const translated = t(`courseConcept.${key}`);
            return translated || c;
        }
    }
    return c;
}

/** 코스 UI(추천 시간·팁 본문 등)용 locale — 모바일·웹 공통 */
export type CourseUiLocale = "ko" | "en" | "ja" | "zh";

const KO_SNIPPET_TO_SEGMENT: [string, string][] = [
    ["브런치", "brunch"],
    ["점심", "lunch"],
    ["저녁", "dinner"],
    ["카페", "cafe"],
    ["데이트", "date"],
];
KO_SNIPPET_TO_SEGMENT.sort((a, b) => b[0].length - a[0].length);

/** 팁·추천시간에 자주 나오는 한글 동네 표기 → onboarding.region.* (긴 토큰 우선) */
const KO_SNIPPET_TO_REGION_CODE: [string, string][] = [
    ["을지로", "EULJIRO"],
    ["여의도", "YEOUIDO"],
    ["잠실", "JAMSIL"],
    ["이태원", "YONGSAN"],
    ["한남", "YONGSAN"],
    ["압구정", "GANGNAM"],
    ["신사", "GANGNAM"],
    ["북촌", "JONGNO"],
    ["서촌", "JONGNO"],
    ["연남", "HONGDAE"],
    ["합정", "MAPO"],
    ["영등포", "YEOUIDO"],
    ["송파", "JAMSIL"],
    ["건대", "SEONGSU"],
    ["성수", "SEONGSU"],
    ["신촌", "HONGDAE"],
    ["홍대", "HONGDAE"],
    ["종로", "JONGNO"],
    ["강남", "GANGNAM"],
    ["용산", "YONGSAN"],
    ["마포", "MAPO"],
];
KO_SNIPPET_TO_REGION_CODE.sort((a, b) => b[0].length - a[0].length);

function tResolved(t: TranslateFn, key: string): string | null {
    const out = t(key);
    return out && out !== key ? out : null;
}

/**
 * DB에 한글로만 적힌 추천 시간·팁 문장을 비한국어 UI에서 토큰 치환으로 현지화
 * - tips_en 등이 있으면 그쪽이 우선(parseTipsFromDbForLocale)이고, 폴백 한글에만 적용하면 됨
 */
export function translateCourseFreeformKoText(
    raw: string | null | undefined,
    locale: CourseUiLocale,
    t: TranslateFn,
): string {
    if (!raw?.trim()) return "";
    const trimmed = raw.trim();
    if (locale === "ko") return trimmed;
    if (!/[가-힣]/.test(trimmed)) return trimmed;

    let s = trimmed;

    for (const [ko, code] of KO_SNIPPET_TO_REGION_CODE) {
        if (!s.includes(ko)) continue;
        const mapKey = REGION_KEY_MAP[code];
        const label = tResolved(t, mapKey);
        if (label) s = s.split(ko).join(label);
    }

    for (const [ko, seg] of KO_SNIPPET_TO_SEGMENT) {
        if (!s.includes(ko)) continue;
        const label = tResolved(t, `courseDetail.segment.${seg}`);
        if (label) s = s.split(ko).join(label);
    }

    const morning = tResolved(t, "courseDetail.recommendedTime.morning");
    if (morning && s.includes("오전")) s = s.split("오전").join(morning);
    const afternoon = tResolved(t, "courseDetail.recommendedTime.afternoon");
    if (afternoon && s.includes("오후")) s = s.split("오후").join(afternoon);
    const breakfast = tResolved(t, "courseDetail.recommendedTime.breakfast");
    if (breakfast && s.includes("아침")) s = s.split("아침").join(breakfast);
    const lateNight = tResolved(t, "courseDetail.recommendedTime.lateNight");
    if (lateNight && s.includes("야간")) s = s.split("야간").join(lateNight);
    const night = tResolved(t, "courseDetail.recommendedTime.night");
    if (night && s.includes("밤")) s = s.split("밤").join(night);

    s = s.replace(/(\d{1,2})\s*시(?!간)/g, (_, n: string) => {
        if (locale === "en") return `${n}:00`;
        if (locale === "ja") return `${n}時`;
        if (locale === "zh") return `${n}点`;
        return `${n}시`;
    });
    s = s.replace(/(\d{1,2})\s*분(?!위)/g, (_, n: string) => {
        if (locale === "en") return `${n} min`;
        if (locale === "ja") return `${n}分`;
        if (locale === "zh") return `${n}分钟`;
        return `${n}분`;
    });

    return s;
}

export function localizeParsedTipsForUi<T extends { category: string; content: string }>(
    tips: T[],
    locale: CourseUiLocale,
    t: TranslateFn,
): T[] {
    if (locale === "ko" || tips.length === 0) return tips;
    return tips.map((row) => ({
        ...row,
        content: translateCourseFreeformKoText(row.content, locale, t),
    }));
}
