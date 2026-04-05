/**
 * 모바일 i18n hook
 * - 웹의 src/i18n/messages/[locale]/translation.json 재사용
 * - locale 상태는 AppSettingsContext에서 관리
 * - ko/en/ja/zh 는 정적 import → 언어 선택 직후 즉시 반영 (동적 import 실패·로딩 레이스 방지)
 */
import { useCallback, useMemo } from "react";
import { useAppSettings } from "../context/AppSettingsContext";
import type { LocalePreference } from "./appSettingsStorage";

import koMessages from "../../../src/i18n/messages/ko/translation.json";
import enMessages from "../../../src/i18n/messages/en/translation.json";
import jaMessages from "../../../src/i18n/messages/ja/translation.json";
import zhMessages from "../../../src/i18n/messages/zh/translation.json";

type Messages = Record<string, unknown>;

const messagesByLocale: Record<LocalePreference, Messages> = {
    ko: koMessages as Messages,
    en: enMessages as Messages,
    ja: jaMessages as Messages,
    zh: zhMessages as Messages,
};

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
            const messages = messagesByLocale[locale];
            let value = getNested(messages, key);
            if (!value && locale !== "ko") value = getNested(messagesByLocale.ko, key);
            return interpolate(value ?? key, params);
        },
        [locale],
    );

    return useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
}
