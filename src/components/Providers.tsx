"use client";

import { NavermapsProvider } from "react-naver-maps";
import { AuthProvider } from "@/context/AuthContext"; // 🟢 AuthProvider 추가
import { ThemeProvider } from "@/context/ThemeContext"; // 🟢 ThemeProvider 추가
import { VersionProvider } from "@/providers/VersionProvider"; // 🟢 [VERSION CONTROL]: 버전 관리 Provider 추가

export function Providers({ children }: { children: React.ReactNode }) {
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "";

    return (
        /* 🟢 인증 시스템, 테마 시스템, 버전 관리 시스템으로 앱 전체를 감싸기 */
        <ThemeProvider>
            <AuthProvider>
                <VersionProvider>
                    <NavermapsProvider ncpClientId={clientId}>{children}</NavermapsProvider>
                </VersionProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
