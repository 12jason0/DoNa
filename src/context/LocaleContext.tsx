"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { TranslationKeys } from "@/types/i18n";

export type Locale = "ko" | "en" | "ja" | "zh";

const LOCALE_KEY = "dona-locale";

interface LocaleContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: TranslationKeys, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

import koMessages from "@/i18n/messages/ko/translation.json";
import enMessages from "@/i18n/messages/en/translation.json";
import jaMessages from "@/i18n/messages/ja/translation.json";
import zhMessages from "@/i18n/messages/zh/translation.json";

const allMessages: Record<Locale, Record<string, unknown>> = {
    ko: koMessages as Record<string, unknown>,
    en: enMessages as Record<string, unknown>,
    ja: jaMessages as Record<string, unknown>,
    zh: zhMessages as Record<string, unknown>,
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
    const [locale, setLocaleState] = useState<Locale>("ko");
    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale);
        if (typeof window !== "undefined") {
            localStorage.setItem(LOCALE_KEY, newLocale);
            document.documentElement.lang = newLocale === "zh" ? "zh-CN" : newLocale;
        }
    }, []);

    const t = useCallback(
        (key: TranslationKeys, params?: Record<string, string | number>): string => {
            const msg = allMessages[locale];
            let value = getNested(msg, key);
            if (!value && locale !== "ko") value = getNested(allMessages.ko, key);
            const result = value || key;
            return interpolate(result, params);
        },
        [locale],
    );

    useEffect(() => {
        const stored = localStorage.getItem(LOCALE_KEY) as Locale | null;
        if (stored && ["ko", "en", "ja", "zh"].includes(stored)) {
            setLocaleState(stored);
            document.documentElement.lang = stored === "zh" ? "zh-CN" : stored;
        }
    }, []);

    return (
        <LocaleContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </LocaleContext.Provider>
    );
}

export function useLocale() {
    const ctx = useContext(LocaleContext);
    if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
    return ctx;
}
