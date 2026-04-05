import type { LocalePreference } from "./appSettingsStorage";

/** locale 코드 → BCP47 태그 변환 (날짜 포맷 등에 사용) */
export function localeTag(locale: string): string {
    if (locale === "en") return "en-US";
    if (locale === "ja") return "ja-JP";
    if (locale === "zh") return "zh-CN";
    return "ko-KR";
}

/** 조회수 축약 (locale별 단위) */
export function formatViewsCompact(views: number, locale: LocalePreference): string {
    if (views >= 10000) {
        const n = (views / 10000).toFixed(views % 10000 ? 1 : 0);
        if (locale === "ko") return `${n}만`;
        if (locale === "ja" || locale === "zh") return `${n}万`;
        return `${(views / 1000).toFixed(views % 1000 ? 1 : 0)}k`;
    }
    if (views >= 1000) {
        const n = (views / 1000).toFixed(views % 1000 ? 1 : 0);
        if (locale === "ko") return `${n}천`;
        if (locale === "ja" || locale === "zh") return `${n}千`;
        return `${n}k`;
    }
    return String(views);
}
