import type { Locale } from "@/context/LocaleContext";
import type { CookiesStrings } from "./cookies.ko";
import cookiesKo from "./cookies.ko";
import cookiesEn from "./cookies.en";
import cookiesJa from "./cookies.ja";
import cookiesZh from "./cookies.zh";

const cookiesByLocale: Record<Locale, CookiesStrings> = {
    ko: cookiesKo,
    en: cookiesEn,
    ja: cookiesJa,
    zh: cookiesZh,
};

export function getCookiesStrings(locale: Locale): CookiesStrings {
    return cookiesByLocale[locale] ?? cookiesKo;
}

export type { CookiesStrings };
