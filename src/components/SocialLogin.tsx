"use client";

import { useState } from "react";

interface SocialLoginProps {
    onSuccess?: (token: string, user: unknown) => void;
    onError?: (error: string) => void;
}

export default function SocialLogin({ onSuccess, onError }: SocialLoginProps) {
    const [isLoading, setIsLoading] = useState<string | null>(null);

    const handleKakaoLogin = async () => {
        setIsLoading("kakao");
        try {
            // 모바일 앱 환경 감지
            // 1. ReactNativeWebView가 있으면 앱 환경
            // 2. User-Agent에 특정 패턴이 있으면 앱 환경 (추가 체크)
            const isMobileApp =
                !!(window as any).ReactNativeWebView ||
                /ReactNative|Expo/i.test(navigator.userAgent) ||
                navigator.userAgent.includes("wv"); // Android WebView

            // 모바일 앱에서는 팝업 대신 리디렉션 방식 사용
            if (isMobileApp) {
                // 리디렉션 방식: 현재 창에서 카카오 인증 페이지로 이동
                window.location.href = "/api/auth/kakao";
                return; // 리디렉션되므로 여기서 종료
            }

            // 웹 환경에서는 팝업 방식 사용
            const kakaoClientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
            const redirectUri = `${window.location.origin}/api/auth/kakao/callback`;

            if (!kakaoClientId) {
                onError?.("환경변수 NEXT_PUBLIC_KAKAO_CLIENT_ID가 설정되지 않았습니다.");
                setIsLoading(null);
                return;
            }

            const authUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${kakaoClientId}&redirect_uri=${encodeURIComponent(
                redirectUri
            )}&response_type=code`;

            const popup = window.open(authUrl, "kakao-login", "width=500,height=600");

            window.addEventListener("message", async (event) => {
                if (event.origin !== window.location.origin) return;

                if (event.data.type === "KAKAO_AUTH_SUCCESS") {
                    const { code } = event.data;

                    const response = await fetch("/api/auth/kakao", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code }),
                    });

                    const data = await response.json();

                    if (data.success) {
                        onSuccess?.(data.token, data.user);
                    } else {
                        onError?.(data.error);
                    }

                    popup?.close();
                    setIsLoading(null);
                }
            });
        } catch (error) {
            console.error("Kakao login error:", error);
            onError?.("카카오 로그인에 실패했습니다.");
            setIsLoading(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="text-center mb-6">
                <p className="text-gray-600 mb-2">소셜 계정으로 간편하게 로그인하세요</p>
            </div>

            {/* Kakao 로그인 */}
            <button
                onClick={handleKakaoLogin}
                disabled={isLoading !== null}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-yellow-400 text-black rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50"
            >
                <div className="w-6 h-6 bg-yellow-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">K</span>
                </div>
                <span className="font-medium">{isLoading === "kakao" ? "로그인 중..." : "카카오로 계속하기"}</span>
            </button>
        </div>
    );
}
