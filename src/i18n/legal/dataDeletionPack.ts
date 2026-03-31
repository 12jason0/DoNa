import type { Locale } from "@/context/LocaleContext";
import type { DataDeletionStrings } from "./dataDeletion.ko";
import dataDeletionKo from "./dataDeletion.ko";
import dataDeletionEn from "./dataDeletion.en";
import dataDeletionJa from "./dataDeletion.ja";
import dataDeletionZh from "./dataDeletion.zh";

const dataDeletionByLocale: Record<Locale, DataDeletionStrings> = {
    ko: dataDeletionKo,
    en: dataDeletionEn,
    ja: dataDeletionJa,
    zh: dataDeletionZh,
};

export function getDataDeletionStrings(locale: Locale): DataDeletionStrings {
    return dataDeletionByLocale[locale] ?? dataDeletionKo;
}

export type { DataDeletionStrings };
