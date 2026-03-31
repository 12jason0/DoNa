import type { Locale } from "@/context/LocaleContext";

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

export function pickCourseTitle(course: LocalizedCourseText, locale: Locale): string {
    if (locale === "en" && course.title_en?.trim()) return course.title_en.trim();
    if (locale === "ja" && course.title_ja?.trim()) return course.title_ja.trim();
    if (locale === "zh" && course.title_zh?.trim()) return course.title_zh.trim();
    return course.title?.trim() || "";
}

export function pickCourseDescription(course: LocalizedCourseText, locale: Locale): string {
    if (locale === "en" && course.description_en?.trim()) return course.description_en.trim();
    if (locale === "ja" && course.description_ja?.trim()) return course.description_ja.trim();
    if (locale === "zh" && course.description_zh?.trim()) return course.description_zh.trim();
    return course.description?.trim() || "";
}
