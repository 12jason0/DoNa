/**
 * 코스 제목·컨셉 locale별 번역
 * - 컨셉: 정적 매핑 (courseConcept)
 * - 제목: API 번역 (선택, DEEPL_AUTH_KEY 있을 때만)
 * - 장소명·주소: 원문 유지 (번역 안 함)
 */

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

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
