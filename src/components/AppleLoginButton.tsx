"use client";

import React, { useEffect, useState } from "react";

interface AppleLoginButtonProps {
    onSuccess: (credential: any) => void;
    onError?: (error: any) => void;
    disabled?: boolean;
    next?: string; // 리다이렉트 경로
}

export default function AppleLoginButton({ onSuccess, onError, disabled, next }: AppleLoginButtonProps) {
    const [isMobileApp, setIsMobileApp] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // 모바일 앱 환경 감지
        const checkMobileApp = () => {
            const hasWebView = !!(window as any).ReactNativeWebView;
            const isExpo = /ReactNative|Expo/i.test(navigator.userAgent);
            const isIOSDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent);

            setIsMobileApp(hasWebView || isExpo);
            setIsIOS(isIOSDevice);
        };

        checkMobileApp();

        // Apple 로그인 성공 이벤트 리스너
        const handleAppleLoginSuccess = (event: CustomEvent) => {
            onSuccess(event.detail);
        };

        // Apple 로그인 에러 이벤트 리스너
        const handleAppleLoginError = (event: CustomEvent) => {
            onError?.(event.detail);
        };

        window.addEventListener("appleLoginSuccess" as any, handleAppleLoginSuccess as EventListener);
        window.addEventListener("appleLoginError" as any, handleAppleLoginError as EventListener);

        return () => {
            window.removeEventListener("appleLoginSuccess" as any, handleAppleLoginSuccess as EventListener);
            window.removeEventListener("appleLoginError" as any, handleAppleLoginError as EventListener);
        };
    }, [onSuccess, onError]);

    const handleAppleLogin = async () => {
        if (disabled) return;

        // 🟢 [Debug]: 환경 변수 확인 (클라이언트 사이드)
        if (process.env.NODE_ENV === "development") {
            console.log("[AppleLogin] 클라이언트 환경 변수:", {
                NEXT_PUBLIC_APPLE_REDIRECT_URI:
                    process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI || "미설정 (서버에서 fallback 사용)",
                NEXT_PUBLIC_APPLE_CLIENT_ID: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || "미설정",
            });
        }

        // 모바일 앱 환경에서는 WebView를 통해 네이티브 Apple 로그인 호출
        if (isMobileApp && (window as any).ReactNativeWebView) {
            try {
                (window as any).ReactNativeWebView.postMessage(
                    JSON.stringify({
                        type: "appleLogin",
                        action: "start",
                    })
                );
            } catch (error) {
                onError?.(error);
            }
            return;
        }

        // 웹 환경에서는 Apple 웹 인증 사용
        try {
            // Apple 인증 URL로 리디렉션 (팝업 방식)
            // next 파라미터를 전달
            const appleAuthUrl = next ? `/api/auth/apple?next=${encodeURIComponent(next)}` : "/api/auth/apple";

            // next 값을 sessionStorage에 저장 (팝업 인증 후 사용)
            if (next) {
                sessionStorage.setItem("auth:next", next);
            }

            // 팝업 열기
            const popup = window.open(
                appleAuthUrl,
                "apple-login",
                `width=500,height=700,left=${window.screen.width / 2 - 250},top=${window.screen.height / 2 - 350}`
            );

            if (!popup) {
                onError?.({ message: "팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요." });
                return;
            }

            // 🟢 [Fix]: 팝업이 실제로 열렸는지 확인
            let popupOpened = false;
            let hasReceivedMessage = false;
            const popupCheckInterval = setInterval(() => {
                try {
                    // 팝업이 열렸는지 확인 (팝업이 차단되면 null이거나 closed가 true)
                    if (popup && !popup.closed) {
                        // 팝업이 열렸는지 확인하기 위해 팝업의 location에 접근 시도
                        popup.location;
                        popupOpened = true;
                    }
                } catch (e) {
                    // Cross-origin 에러는 정상 (팝업이 다른 도메인으로 이동 중)
                    if (popup && !popup.closed) {
                        popupOpened = true;
                    }
                }
            }, 100);

            // 팝업에서 메시지 수신 대기
            const messageHandler = (event: MessageEvent) => {
                // 🟢 [Fix]: origin 검증 강화
                if (event.origin !== window.location.origin) {
                    return;
                }

                const { type, token, error, next: serverNext } = event.data;

                // 🟢 [Fix]: Apple 로그인 성공 메시지 처리
                if (type === "APPLE_LOGIN_SUCCESS") {
                    console.log("[AppleLogin] 로그인 성공 메시지 수신");
                    hasReceivedMessage = true;
                    clearInterval(popupCheckInterval);
                    window.removeEventListener("message", messageHandler);
                    if (popup && !popup.closed) {
                        popup.close();
                    }

                    // 1. 로그인 성공 이벤트 즉시 발생 (전역 상태 업데이트)
                    window.dispatchEvent(new CustomEvent("authLoginSuccess"));
                    sessionStorage.setItem("login_success_trigger", "true");

                    // 2. 리다이렉트 경로 결정 (서버에서 온 경로 우선)
                    const finalRedirect =
                        serverNext || (next && !next.startsWith("/login") && next !== "/login" ? next : "/");

                    // 🟢 [Fix]: 쿠키가 브라우저에 완전히 정착될 시간을 벌어줌 (100ms 지연으로 미들웨어 인식 오류 방지)
                    setTimeout(() => {
                        window.location.replace(finalRedirect);
                    }, 100);
                } else if (type === "APPLE_LOGIN_ERROR") {
                    console.error("[AppleLogin] 로그인 에러:", error);
                    hasReceivedMessage = true;
                    clearInterval(popupCheckInterval);
                    window.removeEventListener("message", messageHandler);
                    if (popup && !popup.closed) {
                        popup.close();
                    }
                    onError?.({ message: error || "Apple 로그인에 실패했습니다." });
                }
            };

            window.addEventListener("message", messageHandler);

            // 팝업 닫힘 감시 (사용자가 직접 닫은 경우만 처리)
            const checkPopup = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkPopup);
                    clearInterval(popupCheckInterval);
                    window.removeEventListener("message", messageHandler);

                    // 🟢 [Fix]: 팝업이 열렸고 메시지를 받지 않았을 때만 에러 표시
                    // (사용자가 팝업을 직접 닫은 경우)
                    if (popupOpened && !hasReceivedMessage) {
                        // 사용자가 팝업을 직접 닫은 경우이므로 에러를 표시하지 않음
                        console.log("[AppleLogin] 사용자가 팝업을 닫았습니다.");
                    }
                }
            }, 500);
        } catch (error) {
            // 🟢 [Fix]: 실제 에러가 발생한 경우에만 에러 표시
            console.error("[AppleLogin] 예상치 못한 에러:", error);
            onError?.(error);
        }
    };

    return (
        <button
            type="button"
            onClick={handleAppleLogin}
            disabled={disabled}
            className="w-full flex items-center justify-center px-4 py-4 bg-black text-white rounded-2xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-bold shadow-sm text-[15px]"
        >
            {/* Apple 공식 로고 SVG (공식 가이드라인 준수) */}
            <svg
                className="w-5 h-5 mr-3"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
            >
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            {disabled ? "Apple 로그인 중..." : "Apple로 로그인"}
        </button>
    );
}
