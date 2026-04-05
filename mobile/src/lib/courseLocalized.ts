/**
 * 웹 src/lib/courseLocalized.ts 와 동일 — 코스 제목/설명 로케일별 필드 선택
 */
import type { LocalePreference } from "./appSettingsStorage";

type LocalizedCourseText = {
    title?: string | null;
    title_en?: string | null;
    title_ja?: string | null;
    title_zh?: string | null;
    description?: string | null;
    description_en?: string | null;
    description_ja?: string | null;
    description_zh?: string | null;
};

export function pickCourseTitle(course: LocalizedCourseText, locale: LocalePreference): string {
    if (locale === "en" && course.title_en?.trim()) return course.title_en.trim();
    if (locale === "ja" && course.title_ja?.trim()) return course.title_ja.trim();
    if (locale === "zh" && course.title_zh?.trim()) return course.title_zh.trim();
    return course.title?.trim() || "";
}

export function pickCourseDescription(course: LocalizedCourseText, locale: LocalePreference): string {
    if (locale === "en" && course.description_en?.trim()) return course.description_en.trim();
    if (locale === "ja" && course.description_ja?.trim()) return course.description_ja.trim();
    if (locale === "zh" && course.description_zh?.trim()) return course.description_zh.trim();
    return course.description?.trim() || "";
}

type LocalizedPlaceText = {
    name?: string | null;
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

export function pickPlaceName(place: LocalizedPlaceText, locale: LocalePreference): string {
    if (locale === "en" && place.name_en?.trim()) return place.name_en.trim();
    if (locale === "ja" && place.name_ja?.trim()) return place.name_ja.trim();
    if (locale === "zh" && place.name_zh?.trim()) return place.name_zh.trim();
    return place.name?.trim() || "";
}

export function pickPlaceAddress(place: LocalizedPlaceText, locale: LocalePreference): string {
    if (locale === "en" && place.address_en?.trim()) return place.address_en.trim();
    if (locale === "ja" && place.address_ja?.trim()) return place.address_ja.trim();
    if (locale === "zh" && place.address_zh?.trim()) return place.address_zh.trim();
    return place.address?.trim() || "";
}

export function pickPlaceDescription(place: LocalizedPlaceText, locale: LocalePreference): string {
    if (locale === "en" && place.description_en?.trim()) return place.description_en.trim();
    if (locale === "ja" && place.description_ja?.trim()) return place.description_ja.trim();
    if (locale === "zh" && place.description_zh?.trim()) return place.description_zh.trim();
    return place.description?.trim() || "";
}
