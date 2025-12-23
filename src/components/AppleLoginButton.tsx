"use client";

import React, { useEffect, useState } from "react";

interface AppleLoginButtonProps {
    onSuccess: (credential: any) => void;
    onError?: (error: any) => void;
    disabled?: boolean;
}

export default function AppleLoginButton({ onSuccess, onError, disabled }: AppleLoginButtonProps) {
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
            const appleAuthUrl = "/api/auth/apple";

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

            // 팝업에서 메시지 수신 대기
            const messageHandler = async (event: MessageEvent) => {
                if (event.origin !== window.location.origin) {
                    return;
                }

                const { type, code: authCode, error: authError } = event.data;

                if (type === "APPLE_AUTH_CODE" && authCode) {
                    window.removeEventListener("message", messageHandler);
                    popup.close();

                    try {
                        // authorization code를 서버로 전송하여 토큰 교환
                        const response = await fetch("/api/auth/apple", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                code: authCode,
                                user: event.data.user || null, // 최초 1회만 제공되는 user 데이터
                            }),
                        });

                        const data = await response.json();

                        if (!response.ok) {
                            throw new Error(data.error || "Apple 로그인 처리 실패");
                        }

                        // 성공 이벤트 발생
                        onSuccess({
                            identityToken: data.token,
                            user: data.user,
                        });
                    } catch (err: any) {
                        onError?.(err);
                    }
                } else if (type === "APPLE_AUTH_ERROR") {
                    window.removeEventListener("message", messageHandler);
                    popup.close();
                    onError?.({ message: authError || "Apple 로그인에 실패했습니다." });
                }
            };

            window.addEventListener("message", messageHandler);

            // 팝업 닫힘 감시
            const checkPopup = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkPopup);
                    window.removeEventListener("message", messageHandler);
                }
            }, 500);
        } catch (error) {
            onError?.(error);
        }
    };

    return (
        <button
            type="button"
            onClick={handleAppleLogin}
            disabled={disabled}
            className="w-full flex items-center justify-center px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-semibold shadow"
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
