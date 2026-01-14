"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchSession, logout as logoutApi, type AuthUser } from "@/lib/authClient";

interface UseAuthReturn {
    user: AuthUser;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    logout: () => Promise<void>;
}

/**
 * 🟢 통합 인증 훅 (쿠키 기반)
 *
 * 모든 컴포넌트에서 일관된 인증 상태를 관리하기 위한 커스텀 훅입니다.
 * localStorage 대신 쿠키 기반으로 동작합니다.
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated, isLoading, logout } = useAuth();
 *
 * if (isLoading) return <div>로딩 중...</div>;
 * if (!isAuthenticated) return <div>로그인이 필요합니다.</div>;
 * return <div>안녕하세요, {user?.name}님!</div>;
 * ```
 */
export function useAuth(): UseAuthReturn {
    const [user, setUser] = useState<AuthUser>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * 세션을 확인하고 인증 상태를 업데이트합니다.
     */
    const checkSession = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const session = await fetchSession();

            if (session.authenticated && session.user) {
                setUser(session.user);
                setIsAuthenticated(true);
            } else {
                setUser(null);
                setIsAuthenticated(false);
            }
        } catch (err) {
            console.error("[useAuth] 세션 확인 실패:", err);
            setError(err instanceof Error ? err.message : "인증 확인 중 오류가 발생했습니다.");
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // [Optimization] checkSession을 ref로 저장하여 이벤트 리스너에서 안정적으로 참조
    const checkSessionRef = useRef(checkSession);
    useEffect(() => {
        checkSessionRef.current = checkSession;
    }, [checkSession]);

    /**
     * 로그아웃 처리
     */
    const handleLogout = useCallback(async () => {
        try {
            const success = await logoutApi();
            if (success) {
                setUser(null);
                setIsAuthenticated(false);
                // 🟢 로그아웃 이벤트 발생 (다른 컴포넌트에 알림)
                window.dispatchEvent(new CustomEvent("authLogout"));

                // 🟢 [이중 안전장치]: 앱(WebView)에 로그아웃 알림 (authClient에서도 보내지만 추가 보장)
                // authClient의 logout 함수에서 이미 메시지를 보내지만, useAuth에서도 보내어 확실히 처리
                if (typeof window !== "undefined" && (window as any).ReactNativeWebView) {
                    try {
                        (window as any).ReactNativeWebView.postMessage(
                            JSON.stringify({
                                type: "logout", // WebScreen.tsx의 조건문과 반드시 일치해야 함
                                redirect: "/",
                                clearState: true,
                            })
                        );
                    } catch (e) {
                        console.warn("[useAuth] WebView 메시지 전송 실패:", e);
                    }
                }
            } else {
                throw new Error("로그아웃에 실패했습니다.");
            }
        } catch (err) {
            console.error("[useAuth] 로그아웃 실패:", err);
            setError(err instanceof Error ? err.message : "로그아웃 중 오류가 발생했습니다.");
        }
    }, []);

    // 초기 로드 시 세션 확인
    useEffect(() => {
        checkSession();
    }, [checkSession]);

    // 🟢 로그인 성공 이벤트 리스너 (다른 컴포넌트에서 로그인 성공 시 호출)
    useEffect(() => {
        const handleLoginSuccess = () => {
            checkSessionRef.current();
        };

        const handleLogout = () => {
            // 🟢 [긴급 Fix]: 로그아웃 시 즉시 상태 초기화 (fetchSession 캐시 무시)
            setUser(null);
            setIsAuthenticated(false);
            setIsLoading(false);

            // 🟢 약간의 지연 후 세션 확인하여 확실히 로그아웃 상태 확인
            setTimeout(() => {
                checkSessionRef.current();
            }, 300);
        };

        window.addEventListener("authLoginSuccess", handleLoginSuccess);
        window.addEventListener("authLogout", handleLogout);

        return () => {
            window.removeEventListener("authLoginSuccess", handleLoginSuccess);
            window.removeEventListener("authLogout", handleLogout);
        };
    }, []); // 이벤트 리스너는 마운트 시에만 등록하고, checkSession은 ref로 안정적으로 참조

    return {
        user,
        isAuthenticated,
        isLoading,
        error,
        refresh: checkSession,
        logout: handleLogout,
    };
}
