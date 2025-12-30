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

        const handleAuthLogout = () => {
            setUser(null);
            setIsLoading(false);
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
