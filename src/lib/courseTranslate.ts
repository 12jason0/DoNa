/**
 * 코스 제목·컨셉 locale별 번역
 * - 컨셉: 정적 매핑 (courseConcept)
 * - 제목: API 번역 (선택, DEEPL_AUTH_KEY 있을 때만)
 * - 장소명·주소: 원문 유지 (번역 안 함)
 */

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

/** DB concept/mood/target → courseConcept 번역 키 매핑 */
const CONCEPT_MAP: Array<{ keyword: string; key: string }> = [
    // 컨셉
    { keyword: "이색데이트", key: "unique" },
    { keyword: "감성데이트", key: "emotionalDate" },
    { keyword: "야경", key: "nightView" },
    { keyword: "힐링", key: "healing" },
    { keyword: "가성비", key: "cost" },
    { keyword: "인생샷", key: "photoSpot" },
    { keyword: "맛집탐방", key: "foodTour" },
    { keyword: "카페투어", key: "cafeTour" },
    { keyword: "술자리", key: "drinking" },
    { keyword: "실내데이트", key: "indoorDate" },
    { keyword: "공연·전시", key: "exhibition" },
    { keyword: "맛집", key: "food" },
    { keyword: "감성", key: "emotional" },
    { keyword: "데이트", key: "default" },
    // 분위기(Mood)
    { keyword: "로맨틱", key: "romantic" },
    { keyword: "힙한", key: "hip" },
    { keyword: "활기찬", key: "lively" },
    { keyword: "레트로", key: "retro" },
    { keyword: "고급스러운", key: "premiumMood" },
    { keyword: "조용한", key: "quiet" },
    { keyword: "이국적인", key: "exotic" },
    // 상황(Target)
    { keyword: "연인", key: "couple" },
    { keyword: "썸", key: "some" },
    { keyword: "친구", key: "friends" },
    { keyword: "가족", key: "family" },
    { keyword: "혼자", key: "solo" },
    { keyword: "기념일", key: "anniversary" },
    { keyword: "소개팅", key: "blindDate" },
    // 조건
    { keyword: "실내", key: "indoor" },
    { keyword: "야외", key: "outdoor" },
    { keyword: "비오는날", key: "rainy" },
];

/**
 * 컨셉 문자열을 locale에 맞게 번역
 * @param concept DB에서 온 concept (예: "힐링", "맛집 탐방")
 * @param t useLocale().t
 * @returns 번역된 컨셉 또는 원문
 */
export function translateCourseConcept(concept: string | null | undefined, t: TranslateFn): string {
    if (!concept?.trim()) return t("courseConcept.default");
    const c = concept.trim();
    for (const { keyword, key } of CONCEPT_MAP) {
        if (c.includes(keyword)) {
            const translated = t(`courseConcept.${key}`);
            return translated || c;
        }
    }
    return c;
}
