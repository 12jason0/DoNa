"use client";

import { NavermapsProvider } from "react-naver-maps";
import { AuthProvider } from "@/context/AuthContext"; // 🟢 AuthProvider 추가
import { ThemeProvider } from "@/context/ThemeContext"; // 🟢 ThemeProvider 추가

export function Providers({ children }: { children: React.ReactNode }) {
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "";

    return (
        /* 🟢 인증 시스템과 테마 시스템으로 앱 전체를 감싸기 */
        <ThemeProvider>
            <AuthProvider>
                <NavermapsProvider ncpClientId={clientId}>{children}</NavermapsProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
