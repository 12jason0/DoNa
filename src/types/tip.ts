/**
 * 팁 아이템: 카테고리 + 내용 (JSON 구조화)
 * 무료팁/유료팁 각각 별도 카테고리 세트 사용
 */
export type FreeTipCategory = "PARKING" | "WALKING" | "SIGNATURE_MENU" | "RESTROOM" | "WAITING";
export type PaidTipCategory =
    | "PHOTO_ZONE"
    | "BEST_SPOT"
    | "ROUTE"
    | "ATTIRE"
    | "GOOD_TO_KNOW"
    | "CAUTION"
    | "VIBE_CHECK"
    | "PARKING_LOT";
export type TipCategory = FreeTipCategory | PaidTipCategory | "ETC"; // ETC: 레거시 호환

export interface TipItem {
    category: TipCategory;
    content: string;
}

/** 무료팁 카테고리: 주차, 뚜벅이, 시그니처, 화장실, 웨이팅 */
export const FREE_TIP_CATEGORIES: { value: FreeTipCategory | "ETC"; label: string }[] = [
    { value: "PARKING", label: "주차" },
    { value: "WALKING", label: "뚜벅이" },
    { value: "SIGNATURE_MENU", label: "시그니처" },
    { value: "RESTROOM", label: "화장실" },
    { value: "WAITING", label: "웨이팅" },
    { value: "ETC", label: "기타" },
];

/** 유료팁 카테고리: 포토존, 명당, 동선, 복장, 알고가면 좋은 정보, 리스크, 분위기, 주차장 */
export const PAID_TIP_CATEGORIES: { value: PaidTipCategory | "ETC"; label: string }[] = [
    { value: "PHOTO_ZONE", label: "포토존" },
    { value: "PARKING_LOT", label: "주차장" },
    { value: "BEST_SPOT", label: "명당" },
    { value: "ROUTE", label: "동선" },
    { value: "ATTIRE", label: "복장" },
    { value: "GOOD_TO_KNOW", label: "알고가면 좋은 정보" },
    { value: "CAUTION", label: "리스크" },
    { value: "VIBE_CHECK", label: "분위기" },
    { value: "ETC", label: "기타" },
];

/** @deprecated 무료/유료 분리용 FREE_TIP_CATEGORIES, PAID_TIP_CATEGORIES 사용 */
export const TIP_CATEGORIES = [...FREE_TIP_CATEGORIES, ...PAID_TIP_CATEGORIES];

export function getTipIcon(category: string): string {
    switch (category) {
        case "PARKING":
        case "PARKING_LOT":
            return "🚗";
        case "WALKING":
            return "🚶";
        case "SIGNATURE_MENU":
            return "☕";
        case "RESTROOM":
            return "🚻";
        case "WAITING":
            return "⏳";
        case "PHOTO_ZONE":
            return "📸";
        case "BEST_SPOT":
            return "⭐";
        case "ROUTE":
            return "⚡";
        case "ATTIRE":
            return "👔";
        case "GOOD_TO_KNOW":
            return "💡";
        case "CAUTION":
            return "⚠️";
        case "VIBE_CHECK":
            return "🎵";
        case "ETC":
            return "💡";
        default:
            return "💡";
    }
}

/** 레거시 카테고리 → 새 카테고리 매핑 (하위 호환) */
const LEGACY_CATEGORY_MAP: Record<string, TipCategory> = {
    MENU: "SIGNATURE_MENU",
    PRAISE: "BEST_SPOT",
};

/**
 * DB에서 가져온 값(string | null)을 TipItem[]로 변환
 * - JSON 배열이면 파싱
 * - 기존 줄글(string)이면 ETC로 감싸서 반환 (하위 호환)
 */
export function parseTipsFromDb(value: string | null | undefined): TipItem[] {
    if (!value || typeof value !== "string" || !value.trim()) return [];
    const trimmed = value.trim();
    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
            return parsed
                .filter((x): x is TipItem => x && typeof x.category === "string" && typeof x.content === "string")
                .map((x) => {
                    const cat = x.category as string;
                    const mapped = LEGACY_CATEGORY_MAP[cat] || (cat as TipCategory);
                    const valid =
                        FREE_TIP_CATEGORIES.some((c) => c.value === mapped) ||
                        PAID_TIP_CATEGORIES.some((c) => c.value === mapped);
                    return {
                        category: valid ? mapped : ("ETC" as TipCategory),
                        content: String(x.content || "").trim(),
                    };
                })
                .filter((x) => x.content.length > 0);
        }
    } catch {
        // legacy plain text
    }
    return [{ category: "ETC", content: trimmed }];
}

/**
 * TipItem[]을 DB 저장용 JSON 문자열로 변환
 */
export function tipsToJson(tips: TipItem[]): string | null {
    const valid = tips.filter((t) => t.content.trim().length > 0);
    if (valid.length === 0) return null;
    return JSON.stringify(valid);
}

/**
 * DB 행에서 통합 팁 문자열 반환
 */
export function getMergedTipsFromRow(row: { tips?: string | null }): string | null {
    if (row.tips != null && String(row.tips).trim()) return row.tips.trim();
    return null;
}
