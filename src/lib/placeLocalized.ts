import type { Locale } from "@/context/LocaleContext";
import type { TranslationKeys } from "@/types/i18n";

/** Prisma `Place` 등 이름·설명·주소 다국어 컬럼이 있을 때 UI용으로 고르기 */
export type PlaceLocalizedFields = {
    name: string;
    name_en?: string | null;
    name_ja?: string | null;
    name_zh?: string | null;
    address?: string | null;
    address_en?: string | null;
    address_ja?: string | null;
    address_zh?: string | null;
    description?: string | null;
    description_en?: string | null;
    description_ja?: string | null;
    description_zh?: string | null;
};

export function pickPlaceName(place: PlaceLocalizedFields, locale: Locale): string {
    if (locale === "en" && place.name_en?.trim()) return place.name_en.trim();
    if (locale === "ja" && place.name_ja?.trim()) return place.name_ja.trim();
    if (locale === "zh" && place.name_zh?.trim()) return place.name_zh.trim();
    return place.name;
}

export function pickPlaceDescription(place: PlaceLocalizedFields, locale: Locale): string | null {
    if (locale === "en" && place.description_en?.trim()) return place.description_en.trim();
    if (locale === "ja" && place.description_ja?.trim()) return place.description_ja.trim();
    if (locale === "zh" && place.description_zh?.trim()) return place.description_zh.trim();
    const base = place.description ?? null;
    return base?.trim() ? base.trim() : null;
}

/** locale별 주소; 번역 컬럼이 없으면 기본 address(한국어) */
export function pickPlaceAddress(place: PlaceLocalizedFields, locale: Locale): string {
    if (locale === "en" && place.address_en?.trim()) return place.address_en.trim();
    if (locale === "ja" && place.address_ja?.trim()) return place.address_ja.trim();
    if (locale === "zh" && place.address_zh?.trim()) return place.address_zh.trim();
    return (place.address ?? "").trim();
}

type TranslateFn = (key: TranslationKeys) => string;

const PLACE_CATEGORY_MAP: { keywords: string[]; key: string }[] = [
    { keywords: ["카페", "cafe", "커피", "coffee", "베이커리", "bakery"], key: "CAFE" },
    { keywords: ["식당", "음식", "맛집", "한식", "중식", "양식", "일식", "이탈리안", "피자", "restaurant", "italian", "레스토랑", "뷔페"], key: "RESTAURANT" },
    { keywords: ["술", "바", "맥주", "호프", "주점", "bar", "pub", "와인"], key: "BAR" },
    { keywords: ["미술관", "박물관", "갤러리", "gallery", "museum", "도서관", "library"], key: "MUSEUM" },
    { keywords: ["쇼핑몰", "쇼핑", "mall", "shopping", "공방"], key: "SHOPPING" },
    { keywords: ["관광", "명소", "놀거리", "문화", "전시", "테마파크", "이색데이트", "공원", "park"], key: "ATTRACTION" },
    { keywords: ["서점", "책", "북", "bookstore", "book"], key: "BOOKSTORE" },
    { keywords: ["뷰티", "미용", "헤어", "네일", "beauty", "spa"], key: "BEAUTY" },
];

/**
 * DB에 한국어로 저장된 place.category를 i18n 키로 변환
 * 예: "카페" → t("placeCategory.CAFE") → "Cafe" (en)
 */
export function translatePlaceCategory(
    category: string | null | undefined,
    t: TranslateFn,
): string {
    if (!category?.trim()) return "";
    const c = category.toLowerCase();
    for (const { keywords, key } of PLACE_CATEGORY_MAP) {
        if (keywords.some((kw) => c.includes(kw))) {
            return t(`placeCategory.${key}` as TranslationKeys);
        }
    }
    return category;
}
