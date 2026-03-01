"use client";

import { useLocale } from "@/context/LocaleContext";
import { useTranslatedTitle } from "@/hooks/useTranslatedTitle";

/**
 * 코스 제목을 locale에 맞게 번역하여 표시
 * (장소명·주소는 번역하지 않음 - 원문 유지)
 */
export default function TranslatedCourseTitle({
    title,
    as: Component = "span",
    className,
    ...rest
}: {
    title: string | null | undefined;
    as?: "span" | "h1" | "h2" | "h3" | "h4" | "p";
    className?: string;
    [key: string]: unknown;
}) {
    const { locale } = useLocale();
    const translated = useTranslatedTitle(title, locale);
    return (
        <Component className={className} {...rest}>
            {translated || title || ""}
        </Component>
    );
}
