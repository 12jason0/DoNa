/**
 * 모바일 i18n hook
 * - 웹의 src/i18n/messages/[locale]/translation.json 재사용
 * - locale 상태는 AppSettingsContext에서 관리
 */
import { useCallback, useMemo } from "react";
import { useAppSettings } from "../context/AppSettingsContext";
import type { LocalePreference } from "./appSettingsStorage";

// ko는 번들에 포함 (초기 로딩 최적화) — 웹과 동일 파일 단일 소스
import koMessages from "../../../src/i18n/messages/ko/translation.json";

type Messages = Record<string, unknown>;

const cache: Partial<Record<LocalePreference, Messages>> = { ko: koMessages as Messages };

const loaders: Record<Exclude<LocalePreference, "ko">, () => Promise<Messages>> = {
    en: () => import("../../../src/i18n/messages/en/translation.json").then((m) => m.default as Messages),
    ja: () => import("../../../src/i18n/messages/ja/translation.json").then((m) => m.default as Messages),
    zh: () => import("../../../src/i18n/messages/zh/translation.json").then((m) => m.default as Messages),
};

// 비동기 사전로딩 (앱 시작 시 한 번)
(["en", "ja", "zh"] as const).forEach((loc) => {
    if (!cache[loc]) {
        loaders[loc]().then((data) => { cache[loc] = data; }).catch(() => {});
    }
});

function getNested(obj: Messages, path: string): string | undefined {
    const keys = path.split(".");
    let cur: unknown = obj;
    for (const key of keys) {
        if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
            cur = (cur as Record<string, unknown>)[key];
        } else {
            return undefined;
        }
    }
    return typeof cur === "string" ? cur : undefined;
}

function interpolate(str: string, params?: Record<string, string | number>): string {
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

export function useLocale() {
    const { locale, setLocale } = useAppSettings();

    const t = useCallback(
        (key: string, params?: Record<string, string | number>): string => {
            const messages = cache[locale] ?? (koMessages as Messages);
            let value = getNested(messages, key);
            if (!value && locale !== "ko") value = getNested(koMessages as Messages, key);
            return interpolate(value ?? key, params);
        },
        [locale],
    );

    return useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
}
