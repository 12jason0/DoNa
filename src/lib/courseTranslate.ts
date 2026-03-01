/**
 * 코스 제목·컨셉 locale별 번역
 * - 컨셉: 정적 매핑 (courseConcept)
 * - 제목: API 번역 (선택, DEEPL_AUTH_KEY 있을 때만)
 * - 장소명·주소: 원문 유지 (번역 안 함)
 */

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

/** DB concept → courseConcept 번역 키 매핑 (긴 키워드 먼저) */
const CONCEPT_MAP: Array<{ keyword: string; key: string }> = [
    { keyword: "맛집탐방", key: "food" },
    { keyword: "인생샷", key: "photo" },
    { keyword: "가성비", key: "cost" },
    { keyword: "액티비티", key: "activity" },
    { keyword: "로맨틱", key: "romantic" },
    { keyword: "야경", key: "nightView" },
    { keyword: "실내", key: "indoor" },
    { keyword: "야외", key: "outdoor" },
    { keyword: "체험", key: "experience" },
    { keyword: "문화", key: "culture" },
    { keyword: "쇼핑", key: "shopping" },
    { keyword: "힐링", key: "healing" },
    { keyword: "포토", key: "photo" },
    { keyword: "사진", key: "photo" },
    { keyword: "맛집", key: "food" },
    { keyword: "먹방", key: "food" },
    { keyword: "감성", key: "emotional" },
    { keyword: "데이트", key: "default" },
    { keyword: "카페", key: "cafe" },
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
