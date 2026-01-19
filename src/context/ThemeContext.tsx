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
    const [theme, setThemeState] = useState<Theme>("light");
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
    const [mounted, setMounted] = useState(false);

    // 테마 결정 (system은 더 이상 사용하지 않음, 기본값은 light)
    const resolveTheme = (currentTheme: Theme): ResolvedTheme => {
        // 🟢 system 옵션 제거: 무조건 light 또는 dark만 사용
        if (currentTheme === "system") {
            return "light";
        }
        return currentTheme;
    };

    // 초기 로드: localStorage에서 테마 가져오기 (없으면 light)
    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem("theme") as Theme | null;
        const root = document.documentElement;

        if (stored && (stored === "light" || stored === "dark")) {
            // 🟢 저장된 테마가 light 또는 dark이면 사용
            setThemeState(stored);
            setResolvedTheme(stored);

            if (stored === "dark") {
                root.classList.add("dark");
                root.setAttribute("data-theme", "dark");
            } else {
                root.classList.remove("dark");
                root.setAttribute("data-theme", "light");
            }
        } else {
            // 🟢 저장된 테마가 없거나 system이면 무조건 light 모드
            setThemeState("light");
            setResolvedTheme("light");
            root.classList.remove("dark");
            root.setAttribute("data-theme", "light");
        }

        // 🟢 초기 로드 시에도 theme-color 메타 태그 설정
        const resolved = resolveTheme(stored || "light");
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        const newThemeColor = resolved === "dark" ? "#0f1710" : "#7FCC9F";
        
        if (themeColorMeta) {
            themeColorMeta.setAttribute("content", newThemeColor);
        } else {
            const meta = document.createElement("meta");
            meta.name = "theme-color";
            meta.content = newThemeColor;
            document.head.appendChild(meta);
        }
    }, []);

    // 🟢 테마 변경 시 document에 클래스 적용 및 theme-color 메타 태그 업데이트
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

        // 🟢 상태표시줄 위아래 영역 색상 동기화: theme-color 메타 태그 업데이트
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        const newThemeColor = resolved === "dark" ? "#0f1710" : "#7FCC9F";
        
        if (themeColorMeta) {
            themeColorMeta.setAttribute("content", newThemeColor);
        } else {
            // 메타 태그가 없으면 생성
            const meta = document.createElement("meta");
            meta.name = "theme-color";
            meta.content = newThemeColor;
            document.head.appendChild(meta);
        }
    }, [theme, mounted]);

    const setTheme = (newTheme: Theme) => {
        // 🟢 system 옵션은 더 이상 저장하지 않음 (light 또는 dark만 저장)
        if (newTheme === "system") {
            setThemeState("light");
            localStorage.setItem("theme", "light");
        } else {
            setThemeState(newTheme);
            localStorage.setItem("theme", newTheme);
        }
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

        // 🟢 theme-color 메타 태그 즉시 업데이트
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        const newThemeColor = newTheme === "dark" ? "#0f1710" : "#7FCC9F";
        
        if (themeColorMeta) {
            themeColorMeta.setAttribute("content", newThemeColor);
        } else {
            const meta = document.createElement("meta");
            meta.name = "theme-color";
            meta.content = newThemeColor;
            document.head.appendChild(meta);
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
