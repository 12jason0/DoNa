import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import {
    loadThemePreference,
    saveThemePreference,
    loadLocalePreference,
    saveLocalePreference,
    type ThemePreference,
    type LocalePreference,
} from "../lib/appSettingsStorage";
import { applyDefaultTextFontForLocale } from "../lib/textDefaultFont";

type AppSettingsValue = {
    theme: ThemePreference;
    setTheme: (t: ThemePreference) => void;
    locale: LocalePreference;
    setLocale: (l: LocalePreference) => void;
};

const AppSettingsContext = createContext<AppSettingsValue | null>(null);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ThemePreference>(loadThemePreference);
    const [locale, setLocaleState] = useState<LocalePreference>(loadLocalePreference);

    const setTheme = useCallback((t: ThemePreference) => {
        saveThemePreference(t);
        setThemeState(t);
    }, []);

    const setLocale = useCallback((l: LocalePreference) => {
        saveLocalePreference(l);
        applyDefaultTextFontForLocale(l);  // 리렌더 전에 동기 적용
        setLocaleState(l);
    }, []);

    const value = useMemo(
        () => ({ theme, setTheme, locale, setLocale }),
        [theme, locale, setTheme, setLocale],
    );

    return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsValue {
    const ctx = useContext(AppSettingsContext);
    if (!ctx) {
        throw new Error("useAppSettings must be used within AppSettingsProvider");
    }
    return ctx;
}
