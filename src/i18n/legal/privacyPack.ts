import type { Locale } from "@/context/LocaleContext";
import type { PrivacyStrings } from "./privacy.ko";
import privacyKo from "./privacy.ko";
import privacyEn from "./privacy.en";
import privacyJa from "./privacy.ja";
import privacyZh from "./privacy.zh";

const privacyByLocale: Record<Locale, PrivacyStrings> = {
    ko: privacyKo,
    en: privacyEn,
    ja: privacyJa,
    zh: privacyZh,
};

export function getPrivacyStrings(locale: Locale): PrivacyStrings {
    return privacyByLocale[locale] ?? privacyKo;
}

export type { PrivacyStrings };
