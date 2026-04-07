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

/** 팁·추천시간·region 표시 공통: 한글 동네 토큰 → onboarding.region.* (긴 토큰 우선) */
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
 * DB region 값(대문자 코드 또는 한국어 동네명)을 locale에 맞게 번역
 * @param region course.region (예: "SEONGSU", "성수")
 */
/** 온보딩 라벨에서 첫 번째 동네명만 추출 ("성수 · 건대" → "성수", "Seongsu · Konkuk" → "Seongsu") */
function shortRegionLabel(label: string): string {
    return label.split(/\s*[·・]\s*/)[0].trim();
}

export function translateCourseRegion(region: string | null | undefined, t: TranslateFn): string {
    if (!region?.trim()) return "";
    const raw = region.trim();
    const upper = raw.toUpperCase();
    const byCode = REGION_KEY_MAP[upper];
    if (byCode) {
        const translated = t(byCode);
        return shortRegionLabel(translated || raw);
    }
    // DB에 한글로 직접 입력된 값(성수, 홍대 등)은 그대로 표시
    if (/[가-힣]/.test(raw)) {
        return raw;
    }
    return raw;
}

/** 리스트 해시태그: 칩 ID(chip.*) 또는 컨셉/무드 한글 → i18n */
export function translateCourseTagLabel(tag: string, t: TranslateFn): string {
    const trimmed = (tag ?? "").trim().replace(/^#+/, "");
    if (!trimmed) return "";
    if (/^[A-Z][A-Z0-9_]*$/.test(trimmed)) {
        const chipKey = `chip.${trimmed}`;
        const out = t(chipKey);
        if (out !== chipKey) return out;
    }
    return translateCourseConcept(trimmed, t);
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

/**
 * 장소 카테고리 한국어 → 로케일별 번역
 * (음식점, 카페, 바, 주점, 영화관 등)
 */
const PLACE_CATEGORY_MAP: Record<string, { en: string; ja: string; zh: string }> = {
    음식점:    { en: "Restaurant",    ja: "レストラン",  zh: "餐厅" },
    식당:      { en: "Restaurant",    ja: "レストラン",  zh: "餐厅" },
    레스토랑:  { en: "Restaurant",    ja: "レストラン",  zh: "餐厅" },
    카페:      { en: "Café",          ja: "カフェ",      zh: "咖啡厅" },
    커피:      { en: "Coffee",        ja: "コーヒー",    zh: "咖啡" },
    디저트:    { en: "Dessert",       ja: "デザート",    zh: "甜品" },
    베이커리:  { en: "Bakery",        ja: "ベーカリー",  zh: "面包店" },
    바:        { en: "Bar",           ja: "バー",        zh: "酒吧" },
    주점:      { en: "Bar",           ja: "居酒屋",      zh: "酒馆" },
    와인바:    { en: "Wine Bar",      ja: "ワインバー",  zh: "葡萄酒吧" },
    칵테일바:  { en: "Cocktail Bar",  ja: "カクテルバー",zh: "鸡尾酒吧" },
    칵테일:    { en: "Cocktail Bar",  ja: "カクテルバー",zh: "鸡尾酒吧" },
    술집:      { en: "Bar",           ja: "居酒屋",      zh: "酒馆" },
    영화관:    { en: "Cinema",        ja: "映画館",      zh: "电影院" },
    공연장:    { en: "Venue",         ja: "ライブハウス",zh: "演出场所" },
    전시관:    { en: "Gallery",       ja: "ギャラリー",  zh: "展览馆" },
    미술관:    { en: "Art Museum",    ja: "美術館",      zh: "美术馆" },
    박물관:    { en: "Museum",        ja: "博物館",      zh: "博物馆" },
    공원:      { en: "Park",          ja: "公園",        zh: "公园" },
    쇼핑:      { en: "Shopping",      ja: "ショッピング",zh: "购物" },
    마켓:      { en: "Market",        ja: "マーケット",  zh: "市场" },
    체험:      { en: "Activity",      ja: "体験",        zh: "体验" },
    액티비티:  { en: "Activity",      ja: "アクティビティ",zh: "活动" },
    스파:      { en: "Spa",           ja: "スパ",        zh: "水疗" },
    호텔:      { en: "Hotel",         ja: "ホテル",      zh: "酒店" },
    서점:      { en: "Bookstore",     ja: "書店",        zh: "书店" },
    독립서점:  { en: "Independent Bookstore", ja: "独立書店", zh: "独立书店" },
    책방:      { en: "Bookstore",     ja: "本屋",        zh: "书店" },
    문구점:    { en: "Stationery",    ja: "文具店",      zh: "文具店" },
    편집숍:    { en: "Select Shop",   ja: "セレクトショップ", zh: "精选店" },
    편집샵:    { en: "Select Shop",   ja: "セレクトショップ", zh: "精选店" },
    갤러리:    { en: "Gallery",       ja: "ギャラリー",  zh: "画廊" },
    플라워샵:  { en: "Flower Shop",   ja: "フラワーショップ", zh: "花店" },
    찜질방:    { en: "Sauna",         ja: "チムジルバン", zh: "汗蒸幕" },
    노래방:    { en: "Karaoke",       ja: "カラオケ",    zh: "卡拉OK" },
    방탈출:    { en: "Escape Room",   ja: "謎解き",      zh: "密室逃脱" },
    볼링장:    { en: "Bowling Alley", ja: "ボウリング場", zh: "保龄球馆" },
    // 카카오 API category_group_name 추가
    관광명소:  { en: "Attraction",   ja: "観光スポット", zh: "景点" },
    숙박:      { en: "Accommodation",ja: "宿泊",         zh: "住宿" },
    문화시설:  { en: "Cultural Venue",ja: "文化施設",    zh: "文化设施" },
    스포츠:    { en: "Sports",       ja: "スポーツ",     zh: "运动" },
    // 기타 자주 등장하는 카테고리
    팝업스토어:{ en: "Pop-up Store", ja: "ポップアップストア", zh: "快闪店" },
    팝업:      { en: "Pop-up Store", ja: "ポップアップ", zh: "快闪" },
    루프탑:    { en: "Rooftop Bar",  ja: "ルーフトップ", zh: "屋顶酒吧" },
    한식:      { en: "Korean",       ja: "韓国料理",     zh: "韩餐" },
    일식:      { en: "Japanese",     ja: "和食",         zh: "日料" },
    중식:      { en: "Chinese",      ja: "中華料理",     zh: "中餐" },
    양식:      { en: "Western",      ja: "洋食",         zh: "西餐" },
    이탈리안:  { en: "Italian",      ja: "イタリアン",   zh: "意大利菜" },
    브런치:    { en: "Brunch",       ja: "ブランチ",     zh: "早午餐" },
    분식:      { en: "Korean Snacks",ja: "軽食",         zh: "小吃" },
};

export function translatePlaceCategory(
    category: string | null | undefined,
    locale: CourseUiLocale,
): string {
    if (!category?.trim()) return "";
    if (locale === "ko") return category.trim();
    const key = category.trim();
    const entry = PLACE_CATEGORY_MAP[key];
    if (entry) return entry[locale] ?? key;
    // 부분 매칭 fallback: 입력이 맵키를 포함하거나, 맵키가 입력을 포함
    for (const [ko, vals] of Object.entries(PLACE_CATEGORY_MAP)) {
        if (key.includes(ko) || ko.includes(key)) return vals[locale] ?? key;
    }
    return key;
}

/**
 * target_situation 값 번역 (콤마 구분, SOME·한국어 키워드 모두 지원)
 */
export function translateTargetSituation(
    raw: string | null | undefined,
    locale: CourseUiLocale,
    t: TranslateFn,
): string {
    if (!raw?.trim()) return "";
    if (locale === "ko") return raw.trim();
    return raw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => {
            if (v === "SOME" || v === "썸") {
                return locale === "en" ? "Situationship"
                    : locale === "ja" ? "サム"
                    : locale === "zh" ? "暧昧关系"
                    : "썸";
            }
            return translateCourseConcept(v, t);
        })
        .join(" · ");
}

/**
 * 소요시간 번역 (N시간 패턴)
 */
export function translateDuration(
    raw: string | null | undefined,
    locale: CourseUiLocale,
): string {
    const v = (raw ?? "").trim();
    if (!v || locale === "ko") return v;
    const fixed: Record<string, { en: string; ja: string; zh: string }> = {
        "1시간":   { en: "1 hour",    ja: "1時間",    zh: "1小时" },
        "2시간":   { en: "2 hours",   ja: "2時間",    zh: "2小时" },
        "3시간":   { en: "3 hours",   ja: "3時間",    zh: "3小时" },
        "4시간":   { en: "4 hours",   ja: "4時間",    zh: "4小时" },
        "5시간":   { en: "5 hours",   ja: "5時間",    zh: "5小时" },
        "6시간+":  { en: "6+ hours",  ja: "6時間以上", zh: "6小时以上" },
        "반나절":  { en: "Half day",  ja: "半日",     zh: "半天" },
        "하루종일":{ en: "Full day",  ja: "一日",     zh: "全天" },
    };
    if (fixed[v]) return fixed[v][locale];
    const m = v.match(/^(?:약\s*)?(\d+)\s*시간(?:\s*(\d+)\s*분)?$/);
    if (m) {
        const h = m[1], min = m[2];
        if (locale === "en") return min ? `${h} hr ${min} min` : `${h} hours`;
        if (locale === "ja") return min ? `${h}時間${min}分` : `${h}時間`;
        return min ? `${h}小时${min}分钟` : `${h}小时`;
    }
    return v;
}

/**
 * 가격대 번역
 * DB 포맷: "1인 3~5만", "2인 6~10만", "3만원 이하", "3~6만원" 등
 */
export function translateBudgetRange(
    raw: string | null | undefined,
    locale: CourseUiLocale,
): string {
    if (!raw?.trim()) return "";
    if (locale === "ko") return raw.trim();
    let s = raw.trim();

    // "N인" prefix: "1인 3~5만" → "per person KRW 30,000-50,000"
    const personMatch = s.match(/^(\d+)인\s*/);
    let personPrefix = "";
    if (personMatch) {
        const n = personMatch[1];
        personPrefix = locale === "en" ? "per person " : (n + "人 ");
        s = s.slice(personMatch[0].length);
    }

    // "X만 이하" / "X만원 이하"
    const upToMatch = s.match(/^(\d+(?:\.\d+)?)\s*만(?:원)?\s*이하$/);
    if (upToMatch) {
        const n = Number(upToMatch[1]);
        if (locale === "en") return personPrefix + "Up to KRW " + (n * 10000).toLocaleString();
        if (locale === "ja") return personPrefix + n + "万ウォン以下";
        return personPrefix + n + "万韩元以下";
    }

    // "X만 이상" / "X만원 이상"
    const overMatch = s.match(/^(\d+(?:\.\d+)?)\s*만(?:원)?\s*이상$/);
    if (overMatch) {
        const n = Number(overMatch[1]);
        if (locale === "en") return personPrefix + "KRW " + (n * 10000).toLocaleString() + "+";
        if (locale === "ja") return personPrefix + n + "万ウォン以上";
        return personPrefix + n + "万韩元以上";
    }

    // "X~Y만원" 또는 "X~Y만" 범위
    const rangeMatch = s.match(/^(\d+(?:\.\d+)?)\s*~\s*(\d+(?:\.\d+)?)\s*만(?:원)?$/);
    if (rangeMatch) {
        const lo = Number(rangeMatch[1]), hi = Number(rangeMatch[2]);
        if (locale === "en") return personPrefix + "KRW " + (lo * 10000).toLocaleString() + "–" + (hi * 10000).toLocaleString();
        if (locale === "ja") return personPrefix + lo + "〜" + hi + "万ウォン";
        return personPrefix + lo + "~" + hi + "万韩元";
    }

    // 단일 금액: "5만원"
    const singleMatch = s.match(/^(\d+(?:\.\d+)?)\s*만(?:원)?$/);
    if (singleMatch) {
        const n = Number(singleMatch[1]);
        if (locale === "en") return personPrefix + "KRW " + (n * 10000).toLocaleString();
        if (locale === "ja") return personPrefix + n + "万ウォン";
        return personPrefix + n + "万韩元";
    }

    return raw.trim();
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
