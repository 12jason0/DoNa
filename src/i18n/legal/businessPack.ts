import type { Locale } from "@/context/LocaleContext";
import type { BusinessStrings } from "./business.ko";
import businessKo from "./business.ko";
import businessEn from "./business.en";
import businessJa from "./business.ja";
import businessZh from "./business.zh";

const businessByLocale: Record<Locale, BusinessStrings> = {
    ko: businessKo,
    en: businessEn,
    ja: businessJa,
    zh: businessZh,
};

export function getBusinessStrings(locale: Locale): BusinessStrings {
    return businessByLocale[locale] ?? businessKo;
}

export type { BusinessStrings };
