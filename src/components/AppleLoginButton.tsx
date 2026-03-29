"use client";

import React, { useEffect, useState } from "react";
import { useLocale } from "@/context/LocaleContext";

interface AppleLoginButtonProps {
    onSuccess: (credential: any) => void;
    onError?: (error: any) => void;
    disabled?: boolean;
    next?: string; // 리다이렉트 경로
    /** icon: 검은 원형 버튼(로그인/회원가입 소셜 행과 맞춤) */
    variant?: "default" | "icon";
}

export default function AppleLoginButton({
    onSuccess,
    onError,
    disabled,
    next,
    variant = "default",
}: AppleLoginButtonProps) {
    const { t } = useLocale();
    const [isMobileApp, setIsMobileApp] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

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

        // 🟢 [Fix]: 앱 환경에서는 onSuccess 핸들러를 실행하지 않음 (중복 로그인 방지)
        // 앱에서 injectJavaScript로 이미 서버에 로그인 요청을 보내므로, onSuccess는 웹 환경에서만 실행
        const handleAppleLoginSuccess = (event: CustomEvent) => {
            // 앱 환경이면 onSuccess를 호출하지 않음 (서버에서 이미 처리됨)
            const isApp = !!(window as any).ReactNativeWebView || /ReactNative|Expo/i.test(navigator.userAgent);
            if (!isApp) {
                onSuccess(event.detail);
            }
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
        if (disabled || isLoggingIn) return;

        // 🟢 로그인 시작
        setIsLoggingIn(true);

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
                // 🟢 앱 환경에서는 로그인 성공 이벤트를 기다림 (최대 30초)
                const timeout = setTimeout(() => {
                    setIsLoggingIn(false);
                }, 30000);

                // 🟢 로그인 성공 이벤트 리스너 (앱 환경)
                const handleAppLoginSuccess = () => {
                    clearTimeout(timeout);
                    setIsLoggingIn(false);
                    window.removeEventListener("authLoginSuccess", handleAppLoginSuccess);
                };
                window.addEventListener("authLoginSuccess", handleAppLoginSuccess);
            } catch (error) {
                setIsLoggingIn(false);
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
                setIsLoggingIn(false);
                onError?.({ message: t("authPage.login.errorPopupBlocked") });
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
                    console.log("[AppleLogin] 성공 메시지 수신, 리다이렉트 준비");
                    hasReceivedMessage = true;
                    setIsLoggingIn(false);
                    clearInterval(popupCheckInterval);
                    window.removeEventListener("message", messageHandler);
                    if (popup && !popup.closed) {
                        popup.close();
                    }

                    // 🟢 [Magic Fix]: 앱 환경 감지
                    const isApp = !!(window as any).ReactNativeWebView || /ReactNative|Expo/i.test(navigator.userAgent);

                    // 🟢 앱인 경우 Native(WebScreen.tsx)가 리다이렉트를 처리하므로 여기서는 중단
                    // WebScreen.tsx의 injectJavaScript가 이미 리다이렉트를 처리하므로 중복 방지
                    if (isApp) {
                        console.log("[AppleLogin] 앱 환경 감지, 리다이렉트는 WebScreen.tsx에서 처리");
                        // 전역 로그인 상태만 업데이트 (리다이렉트는 WebScreen.tsx가 처리)
                        window.dispatchEvent(new CustomEvent("authLoginSuccess"));
                        // 🟢 [Fix]: 로그인 성공 시간을 타임스탬프로 저장 (쿠키 동기화 시간 계산용)
                        sessionStorage.setItem("login_success_trigger", Date.now().toString());
                        return; // 🟢 앱 환경에서는 여기서 종료
                    }

                    // 🟢 웹 환경인 경우에만 여기서 리다이렉트 처리
                    // 1. 전역 로그인 상태 업데이트
                    window.dispatchEvent(new CustomEvent("authLoginSuccess"));
                    // 🟢 [Fix]: 로그인 성공 시간을 타임스탬프로 저장 (쿠키 동기화 시간 계산용)
                    sessionStorage.setItem("login_success_trigger", Date.now().toString());

                    // 2. 최종 목적지 결정 (서버에서 온 경로 우선)
                    const finalRedirect =
                        serverNext || (next && !next.startsWith("/login") && next !== "/login" ? next : "/");

                    // 🟢 웹 환경에서는 300ms 지연 후 리다이렉트
                    setTimeout(() => {
                        window.location.replace(finalRedirect);
                    }, 300);
                } else if (type === "APPLE_LOGIN_ERROR") {
                    console.error("[AppleLogin] 로그인 에러:", error);
                    hasReceivedMessage = true;
                    setIsLoggingIn(false);
                    clearInterval(popupCheckInterval);
                    window.removeEventListener("message", messageHandler);
                    if (popup && !popup.closed) {
                        popup.close();
                    }
                    onError?.({ message: error || t("authPage.login.errorAppleFailed") });
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
                        setIsLoggingIn(false);
                    }
                }
            }, 500);
        } catch (error) {
            // 🟢 [Fix]: 실제 에러가 발생한 경우에만 에러 표시
            console.error("[AppleLogin] 예상치 못한 에러:", error);
            setIsLoggingIn(false);
            onError?.(error);
        }
    };

    const appleSvg = (
        <svg
            className={variant === "icon" ? "h-7 w-7" : "w-5 h-5 mr-3"}
            fill="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
    );

    if (variant === "icon") {
        return (
            <button
                type="button"
                onClick={handleAppleLogin}
                disabled={disabled || isLoggingIn}
                title={t("authPage.login.appleSubmit")}
                aria-label={t("authPage.login.appleSubmit")}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black text-white shadow-md transition-colors hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-[#1a241b] disabled:cursor-not-allowed disabled:opacity-50"
            >
                {appleSvg}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={handleAppleLogin}
            disabled={disabled || isLoggingIn}
            className="flex w-full cursor-pointer items-center justify-center rounded-2xl bg-black px-4 py-4 text-[15px] font-bold text-white shadow-sm transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {appleSvg}
            {disabled || isLoggingIn ? t("authPage.login.submitting") : t("authPage.login.appleSubmit")}
        </button>
    );
}
