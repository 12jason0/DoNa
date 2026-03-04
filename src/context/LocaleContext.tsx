"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { TranslationKeys } from "@/types/i18n";

export type Locale = "ko" | "en" | "ja" | "zh";

const LOCALE_KEY = "dona-locale";

interface LocaleContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    /** 메시지 로드 후 locale 전환 (번역 깜빡임 방지). 언어 버튼은 이것만 사용 */
    setLocaleSafe: (locale: Locale) => void;
    isLocaleLoading: boolean;
    /** ko이거나 현재 locale의 메시지가 로드됐을 때 true. 마이페이지 본문은 이때만 렌더하면 zh/ko 섞임 방지 */
    isLocaleReady: boolean;
    t: (key: TranslationKeys, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

// ko는 기본 언어로 번들에 포함 (초기 로딩 최소화)
import koMessages from "@/i18n/messages/ko/translation.json";

const ko = koMessages as Record<string, unknown>;

const messageLoaders: Record<Exclude<Locale, "ko">, () => Promise<Record<string, unknown>>> = {
    en: () => import("@/i18n/messages/en/translation.json").then((m) => m.default as Record<string, unknown>),
    ja: () => import("@/i18n/messages/ja/translation.json").then((m) => m.default as Record<string, unknown>),
    zh: () => import("@/i18n/messages/zh/translation.json").then((m) => m.default as Record<string, unknown>),
};

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
    const keys = path.split(".");
    let current: unknown = obj;
    for (const key of keys) {
        if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
            current = (current as Record<string, unknown>)[key];
        } else {
            return undefined;
        }
    }
    return typeof current === "string" ? current : undefined;
}

function interpolate(str: string, params?: Record<string, string | number>): string {
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
    // 항상 "ko"로 시작 → 서버/클라이언트 첫 렌더 일치(하이드레이션 에러 방지). 저장된 언어는 useEffect에서 복원
    const [locale, setLocaleState] = useState<Locale>("ko");
    const [messagesCache, setMessagesCache] = useState<Partial<Record<Locale, Record<string, unknown>>>>(() => ({
        ko,
    }));
    const [isLocaleLoading, setIsLocaleLoading] = useState(false);

    const applyLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale);
        if (typeof window !== "undefined") {
            localStorage.setItem(LOCALE_KEY, newLocale);
            document.documentElement.lang = newLocale === "zh" ? "zh-CN" : newLocale;
        }
    }, []);

    const setLocale = applyLocale;

    const setLocaleSafe = useCallback(
        (newLocale: Locale) => {
            if (newLocale === "ko") {
                applyLocale("ko");
                return;
            }
            if (messagesCache[newLocale]) {
                applyLocale(newLocale);
                return;
            }
            setIsLocaleLoading(true);
            const loader = messageLoaders[newLocale];
            if (!loader) {
                setIsLocaleLoading(false);
                return;
            }
            loader()
                .then((data) => {
                    setMessagesCache((prev) => ({ ...prev, [newLocale]: data }));
                    applyLocale(newLocale);
                })
                .finally(() => setIsLocaleLoading(false));
        },
        [applyLocale, messagesCache],
    );

    const t = useCallback(
        (key: TranslationKeys, params?: Record<string, string | number>): string => {
            const msg = messagesCache[locale] ?? ko;
            let value = getNested(msg, key);
            if (!value && locale !== "ko") value = getNested(ko, key);
            const result = value || key;
            return interpolate(result, params);
        },
        [locale, messagesCache],
    );

    const isLocaleReady = locale === "ko" || !!messagesCache[locale];

    // 클라이언트: 저장된 언어 복원 — 해당 언어 메시지 로드 후에만 locale 전환 (번역 깜빡임 방지)
    useEffect(() => {
        const stored = localStorage.getItem(LOCALE_KEY) as Locale | null;
        if (!stored || !["ko", "en", "ja", "zh"].includes(stored)) return;
        if (stored === "ko") {
            setLocaleState("ko");
            document.documentElement.lang = "ko";
            return;
        }
        const applyStored = (data: Record<string, unknown>) => {
            setMessagesCache((prev) => ({ ...prev, [stored]: data }));
            setLocaleState(stored);
            document.documentElement.lang = stored === "zh" ? "zh-CN" : stored;
        };
        messageLoaders[stored]().then(applyStored);
    }, []);

    // html lang 속성 초기화
    useEffect(() => {
        if (typeof window === "undefined") return;
        document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
    }, [locale]);

    // en/ja/zh 번역 로드 (비동기)
    useEffect(() => {
        if (locale === "ko" || messagesCache[locale]) return;
        const loader = messageLoaders[locale];
        if (!loader) return;
        let cancelled = false;
        loader().then((data) => {
            if (!cancelled) {
                setMessagesCache((prev) => ({ ...prev, [locale]: data }));
            }
        });
        return () => {
            cancelled = true;
        };
    }, [locale, messagesCache]);

    // 앱 마운트 시 en/ja/zh 선로딩 → 온보딩 등 직진입 시에도 선택 언어 즉시 반영
    useEffect(() => {
        (["en", "ja", "zh"] as const).forEach((loc) => {
            messageLoaders[loc]().then((data) => {
                setMessagesCache((prev) => (prev[loc] ? prev : { ...prev, [loc]: data }));
            });
        });
    }, []);

    const contextValue = useMemo(
        () => ({ locale, setLocale, setLocaleSafe, isLocaleLoading, isLocaleReady, t }),
        [locale, setLocale, setLocaleSafe, isLocaleLoading, isLocaleReady, t],
    );

    return (
        <LocaleContext.Provider value={contextValue}>
            {children}
        </LocaleContext.Provider>
    );
}

export function useLocale() {
    const ctx = useContext(LocaleContext);
    if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
    return ctx;
}
