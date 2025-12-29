"use client";

import { NavermapsProvider } from "react-naver-maps";
import { AuthProvider } from "@/context/AuthContext"; // 🟢 AuthProvider 추가

export function Providers({ children }: { children: React.ReactNode }) {
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "";

    return (
        /* 🟢 인증 시스템으로 지도와 앱 전체를 감싸서 세션 중복 요청 차단 */
        <AuthProvider>
            <NavermapsProvider ncpClientId={clientId}>{children}</NavermapsProvider>
        </AuthProvider>
    );
}
