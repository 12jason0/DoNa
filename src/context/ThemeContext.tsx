"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: ResolvedTheme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("system");
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
    const [mounted, setMounted] = useState(false);

    // 🟢 기기 다크모드 감지
    const getSystemTheme = (): ResolvedTheme => {
        if (typeof window === "undefined") return "light";
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    };

    // 🟢 테마 결정 (system이면 기기 설정, 아니면 선택한 테마)
    const resolveTheme = (currentTheme: Theme): ResolvedTheme => {
        if (currentTheme === "system") {
            return getSystemTheme();
        }
        return currentTheme;
    };

    // 🟢 초기 로드 및 localStorage에서 테마 가져오기
    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem("theme") as Theme | null;
        const initialTheme = stored || "system";
        setThemeState(initialTheme);
        setResolvedTheme(resolveTheme(initialTheme));
    }, []);

    // 🟢 테마 변경 시 document에 클래스 적용
    useEffect(() => {
        if (!mounted) return;

        const resolved = resolveTheme(theme);
        setResolvedTheme(resolved);

        const root = document.documentElement;
        if (resolved === "dark") {
            root.classList.add("dark");
            root.setAttribute("data-theme", "dark");
        } else {
            root.classList.remove("dark");
            root.setAttribute("data-theme", "light");
        }
    }, [theme, mounted]);

    // 🟢 시스템 테마 변경 감지
    useEffect(() => {
        if (!mounted || theme !== "system") return;

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => {
            setResolvedTheme(getSystemTheme());
            const root = document.documentElement;
            if (getSystemTheme() === "dark") {
                root.classList.add("dark");
                root.setAttribute("data-theme", "dark");
            } else {
                root.classList.remove("dark");
                root.setAttribute("data-theme", "light");
            }
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [theme, mounted]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem("theme", newTheme);
    };

    const toggleTheme = useCallback(() => {
        // 🟢 현재 document의 dark 클래스를 확인하여 라이트 ↔ 다크 직접 전환
        if (typeof window === "undefined") return;
        
        const root = document.documentElement;
        const isDark = root.classList.contains("dark");
        const newTheme = isDark ? "light" : "dark";
        
        // 상태와 localStorage 업데이트
        setThemeState(newTheme);
        localStorage.setItem("theme", newTheme);
        
        // 즉시 클래스 적용 (useEffect보다 빠르게 반응)
        if (isDark) {
            root.classList.remove("dark");
            root.setAttribute("data-theme", "light");
        } else {
            root.classList.add("dark");
            root.setAttribute("data-theme", "dark");
        }
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};

