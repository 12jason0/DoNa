import type { Locale } from "@/context/LocaleContext";
import type { TermsStrings } from "./terms.ko";
import termsKo from "./terms.ko";
import termsEn from "./terms.en";
import termsJa from "./terms.ja";
import termsZh from "./terms.zh";

const termsByLocale: Record<Locale, TermsStrings> = {
    ko: termsKo,
    en: termsEn,
    ja: termsJa,
    zh: termsZh,
};

export function getTermsStrings(locale: Locale): TermsStrings {
    return termsByLocale[locale] ?? termsKo;
}

export type { TermsStrings };
