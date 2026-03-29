import { storage } from "./mmkv";

const THEME_KEY = "appThemePreference";
const LOCALE_KEY = "appLocalePreference";

export type ThemePreference = "light" | "dark";
export type LocalePreference = "ko" | "en" | "ja" | "zh";

export function loadThemePreference(): ThemePreference {
    const v = storage.getString(THEME_KEY);
    return v === "dark" || v === "light" ? v : "light";
}

export function saveThemePreference(t: ThemePreference): void {
    storage.set(THEME_KEY, t);
}

export function loadLocalePreference(): LocalePreference {
    const v = storage.getString(LOCALE_KEY);
    return v === "en" || v === "ja" || v === "zh" || v === "ko" ? v : "ko";
}

export function saveLocalePreference(l: LocalePreference): void {
    storage.set(LOCALE_KEY, l);
}
