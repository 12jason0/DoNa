"use client";

import { useState, useEffect, useCallback } from "react";
import type { Locale } from "@/context/LocaleContext";

const cache = new Map<string, string>();

function cacheKey(text: string, locale: string) {
    return `${locale}:${text}`;
}

/**
 * 코스 제목을 locale에 맞게 번역 (ko는 원문, en/ja/zh는 API 호출)
 * DEEPL_AUTH_KEY 없으면 원문 반환
 */
export function useTranslatedTitle(title: string | null | undefined, locale: Locale): string {
    const [translated, setTranslated] = useState<string>(title || "");

    useEffect(() => {
        if (!title?.trim()) {
            setTranslated("");
            return;
        }
        if (locale === "ko") {
            setTranslated(title);
            return;
        }
        const key = cacheKey(title, locale);
        const cached = cache.get(key);
        if (cached !== undefined) {
            setTranslated(cached);
            return;
        }
        setTranslated(title);
        const params = new URLSearchParams({ text: title, targetLang: locale });
        fetch(`/api/translate?${params}`)
            .then((r) => r.json())
            .then((data) => {
                const t = data?.translated || title;
                cache.set(key, t);
                setTranslated(t);
            })
            .catch(() => {});
    }, [title, locale]);

    return translated || title || "";
}
