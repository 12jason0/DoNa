"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchSession, AuthUser } from "@/lib/authClient";

interface AuthContextType {
    user: AuthUser;
    isAuthenticated: boolean;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser>(null);
    const [isLoading, setIsLoading] = useState(true);

    // [Point] 인증 확인 로직을 이곳으로 일원화
    const checkAuth = async () => {
        const session = await fetchSession();
        setUser(session.user);
        setIsLoading(false);
    };

    useEffect(() => {
        checkAuth(); // 🟢 앱 로드 시 최초 1회만 실행하여 서버 부하 감소
    }, []);

    // 🟢 로그인 성공 이벤트 리스너 추가 (로컬 로그인 지원)
    useEffect(() => {
        const handleAuthLoginSuccess = () => {
            checkAuth();
        };

        const handleAuthLogout = async () => {
            // 🟢 [긴급 Fix]: 로그아웃 시 즉시 상태 초기화 및 세션 캐시 무시
            setUser(null);
            setIsLoading(false);
            
            // 🟢 세션 캐시를 무시하고 강제로 다시 확인하여 확실히 로그아웃 상태 확인
            // 약간의 지연을 두어 서버 쿠키 삭제가 완료될 시간 확보
            setTimeout(async () => {
                try {
                    // 🟢 fetchSession 캐시를 무시하기 위해 직접 API 호출
                    const res = await fetch("/api/auth/session", {
                        method: "GET",
                        credentials: "include",
                        cache: "no-store",
                    });
                    const data = await res.json();
                    if (!data.authenticated) {
                        setUser(null);
                        setIsLoading(false);
                    }
                } catch (e) {
                    // 🟢 에러 발생 시에도 로그아웃 상태 유지
                    setUser(null);
                    setIsLoading(false);
                }
            }, 300);
        };

        window.addEventListener("authLoginSuccess", handleAuthLoginSuccess);
        window.addEventListener("authLogout", handleAuthLogout);

        return () => {
            window.removeEventListener("authLoginSuccess", handleAuthLoginSuccess);
            window.removeEventListener("authLogout", handleAuthLogout);
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, refresh: checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
}

// 컴포넌트에서 쉽게 꺼내 쓸 수 있는 커스텀 훅
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};
