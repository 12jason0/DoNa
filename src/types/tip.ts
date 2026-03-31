import type { TranslationKeys } from "@/types/i18n";

/**
 * 팁 아이템: 카테고리 + 내용 (JSON 구조화)
 */
export type TipCategory =
    | "PARKING"
    | "WALKING"
    | "SIGNATURE_MENU"
    | "RESTROOM"
    | "WAITING"
    | "PHOTO_ZONE"
    | "BEST_SPOT"
    | "ROUTE"
    | "ATTIRE"
    | "GOOD_TO_KNOW"
    | "CAUTION"
    | "VIBE_CHECK"
    | "PARKING_LOT"
    | "ETC";

export interface TipItem {
    category: TipCategory;
    content: string;
}

/** 유효 카테고리 값 목록 (어드민 select·검증용) */
export const TIP_CATEGORY_VALUES: readonly TipCategory[] = [
    "PARKING",
    "WALKING",
    "SIGNATURE_MENU",
    "RESTROOM",
    "WAITING",
    "PHOTO_ZONE",
    "PARKING_LOT",
    "BEST_SPOT",
    "ROUTE",
    "ATTIRE",
    "GOOD_TO_KNOW",
    "CAUTION",
    "VIBE_CHECK",
    "ETC",
] as const;

const TIP_CATEGORY_SET = new Set<string>(TIP_CATEGORY_VALUES);

function isKnownTipCategory(c: string): c is TipCategory {
    return TIP_CATEGORY_SET.has(c);
}

/**
 * UI 표시용 라벨 — translation.json `tipCategory.{PARKING|...}`
 */
export function getTipCategoryLabel(
    category: string,
    t: (key: TranslationKeys, params?: Record<string, string | number>) => string,
): string {
    const key = `tipCategory.${category}` as TranslationKeys;
    const out = t(key);
    if (out === key || !out) {
        return t("tipCategory.ETC");
    }
    return out;
}

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
                    const valid = isKnownTipCategory(mapped);
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

export type CoursePlaceTipsRow = {
    tips?: string | null;
    tips_en?: string | null;
    tips_ja?: string | null;
    tips_zh?: string | null;
};

export type AppLocale = "ko" | "en" | "ja" | "zh";

/**
 * DB locale 컬럼 + 기본 tips(한국어)에서 현재 locale에 맞는 TipItem[] 생성
 */
export function parseTipsFromDbForLocale(row: CoursePlaceTipsRow, locale: AppLocale): TipItem[] {
    if (locale === "ko") return parseTipsFromDb(row.tips);
    const alt =
        locale === "en"
            ? row.tips_en
            : locale === "ja"
              ? row.tips_ja
              : row.tips_zh;
    if (alt != null && String(alt).trim()) return parseTipsFromDb(alt);
    return parseTipsFromDb(row.tips);
}

/**
 * DB 행에서 통합 팁 문자열 반환
 */
export function getMergedTipsFromRow(row: { tips?: string | null }): string | null {
    if (row.tips != null && String(row.tips).trim()) return row.tips.trim();
    return null;
}
