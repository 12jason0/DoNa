/** App `Locale` (`ko` | `en` | …) → BCP 47 for `Intl` */
export function localeToBcp47(locale: string): string {
    const map: Record<string, string> = { ko: "ko-KR", en: "en-US", ja: "ja-JP", zh: "zh-CN" };
    return map[locale] ?? "en-US";
}
