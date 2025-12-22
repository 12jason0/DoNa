"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { fetchSession } from "@/lib/authClient";

const Login = () => {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement | null>(null);

    // 페이지 로드 시 스크롤을 맨 위로
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // URL 파라미터에서 메시지 확인
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlMessage = urlParams.get("message");

        if (urlMessage) {
            setMessage(decodeURIComponent(urlMessage));
            // URL에서 메시지 파라미터 제거
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, "", cleanUrl);
        }
    }, []);

    // 로그인 페이지 스크롤 잠금 해제: 페이지 전체 스크롤 허용 (전역 잠금 제거)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setMessage("");

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (response.ok) {
                // 토큰 저장 로직 (기존 유지)
                if (data?.token) {
                    localStorage.setItem("authToken", data.token);
                    if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));
                    localStorage.setItem("loginTime", Date.now().toString());
                    window.dispatchEvent(new CustomEvent("authTokenChange", { detail: { token: data.token } }));
                } else {
                    await fetchSession();
                    window.dispatchEvent(new CustomEvent("authTokenChange"));
                }

                // 웹뷰 통신 (기존 유지)
                try {
                    if ((window as any).ReactNativeWebView) {
                        (window as any).ReactNativeWebView.postMessage(
                            JSON.stringify({
                                type: "loginSuccess",
                                userId: data?.user?.id ?? null,
                                token: data?.token ?? null,
                            })
                        );
                    }
                } catch {}

                // ✅ [수정된 부분]
                // URL에 표시하지 않고, sessionStorage에 '로그인 성공' 흔적을 남깁니다.
                sessionStorage.setItem("login_success_trigger", "true");

                // 깔끔하게 메인으로 이동! (?login_success=true 없음)
                router.push("/");
            } else {
                setError(data.error || "로그인에 실패했습니다.");
            }
        } catch (error) {
            console.error("로그인 오류:", error);
            setError("로그인 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };
    const authReceived = useRef(false);

    // ... (기존 import 및 상단 로직 동일)

    const handleSocialLogin = async (provider: string) => {
        if (loading) return;
        setLoading(true);
        setError("");
        setMessage("");
        authReceived.current = false;

        if (provider === "kakao") {
            // 1. 웹뷰 환경 체크
            const isMobileApp = !!(window as any).ReactNativeWebView || /ReactNative|Expo/i.test(navigator.userAgent);
            if (isMobileApp) {
                window.location.href = "/api/auth/kakao";
                return;
            }

            const kakaoClientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
            const redirectUri = `${window.location.origin}/api/auth/kakao/callback`; // 현재 도메인 기반으로 동적 설정

            if (!kakaoClientId) {
                setError("카카오 클라이언트 ID가 설정되지 않았습니다.");
                setLoading(false);
                return;
            }

            // 2. 메시지 핸들러 정의 (팝업을 열기 전에 미리 정의)
            const messageHandler = async (event: MessageEvent) => {
                // 보안 체크: 현재 도메인과 보낸 도메인이 같은지 확인 (가장 안전한 방법)
                if (event.origin !== window.location.origin && !event.origin.includes("kakao.com")) {
                    console.warn("차단된 오리진으로부터의 메시지:", event.origin);
                    return;
                }

                const { type, code, error: authError } = event.data;

                if (type === "KAKAO_AUTH_CODE" && code) {
                    authReceived.current = true; // ✅ 수신 확인
                    console.log("✅ 인증 코드 수신 성공:", code);

                    try {
                        const response = await fetch("/api/auth/kakao", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ code }),
                        });
                        const data = await response.json();

                        if (!response.ok) throw new Error(data.error || "로그인 처리 실패");

                        localStorage.setItem("authToken", data.token);
                        localStorage.setItem("user", JSON.stringify(data.user));
                        localStorage.setItem("loginTime", Date.now().toString());
                        sessionStorage.setItem("login_success_trigger", "true");

                        // ✅ Header와 다른 컴포넌트에 로그인 상태 변경 알림
                        window.dispatchEvent(new CustomEvent("authTokenChange", { detail: { token: data.token } }));

                        cleanup();
                        router.push("/");
                    } catch (err: any) {
                        setError(err.message);
                        cleanup();
                    }
                } else if (type === "KAKAO_AUTH_ERROR") {
                    setError(`인증 실패: ${authError}`);
                    cleanup();
                }
            };

            // 3. 리스너 등록 및 팝업 감시 함수
            let intervalId: any = null;
            const cleanup = () => {
                if (intervalId) clearInterval(intervalId);
                window.removeEventListener("message", messageHandler);
                setLoading(false);
            };

            window.addEventListener("message", messageHandler);

            // 4. 카카오 인증 URL 생성 및 팝업 열기
            const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?${new URLSearchParams({
                client_id: kakaoClientId,
                redirect_uri: redirectUri,
                response_type: "code",
                scope: "profile_nickname, profile_image",
            }).toString()}`;

            const popup = window.open(
                kakaoAuthUrl,
                "kakao-login",
                `width=500,height=700,left=${window.screen.width / 2 - 250},top=${window.screen.height / 2 - 350}`
            );

            if (!popup) {
                setError("팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.");
                cleanup();
                return;
            }

            // 5. 팝업 닫힘 감시 로직 (수정됨)
            intervalId = setInterval(() => {
                if (popup.closed) {
                    clearInterval(intervalId);
                    // 팝업이 닫히고 나서 1초만 더 기다려보고, 그 때도 수신이 안 됐으면 에러 처리
                    setTimeout(() => {
                        if (!authReceived.current) {
                            setError("카카오 로그인이 취소되었거나 인증에 실패했습니다.");
                            cleanup();
                        }
                    }, 1000);
                }
            }, 500);

            return;
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-[var(--brand-cream)] to-white">
            <main className="max-w-sm mx-auto px-4 py-8 pb-28 overflow-y-auto">
                <div className="w-full bg-white rounded-xl border border-gray-100 p-6 flex flex-col">
                    <div className="text-center mb-6">
                        <div className="mx-auto mb-2 w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <span className="text-2xl">🌿</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-1 font-brand tracking-tight">로그인</h1>
                        <p className="text-gray-600 text-sm">DoNa에 오신 것을 환영합니다</p>
                    </div>
                    <div ref={scrollAreaRef}>
                        {message && (
                            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-green-600 text-sm">{message}</p>
                            </div>
                        )}

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-red-600 text-sm">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6 text-gray-600">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-800 mb-2">
                                    이메일
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="이메일을 입력하세요"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-800 mb-2">
                                    비밀번호
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-lg bg-white focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        placeholder="비밀번호를 입력하세요"
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none transition-colors"
                                        disabled={loading}
                                        aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                                    >
                                        {showPassword ? (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858 5.858a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 tracking-tight"
                            >
                                {loading ? "로그인 중..." : "로그인"}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-gray-600">
                                계정이 없으신가요?{" "}
                                <Link href="/signup" className="text-emerald-600 hover:text-emerald-700 font-medium">
                                    회원가입
                                </Link>
                            </p>
                        </div>

                        <div className="mt-2">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-green-100" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white text-gray-500">또는</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 space-y-3 text-black">
                            <button
                                type="button"
                                onClick={() => handleSocialLogin("kakao")}
                                disabled={loading}
                                className="w-full flex items-center justify-center px-4 py-3 bg-yellow-400 text-black rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-semibold shadow"
                            >
                                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 3c5.799 0 10.5 3.402 10.5 7.5 0 4.098-4.701 7.5-10.5 7.5-.955 0-1.886-.1-2.777-.282L3.234 21l1.781-3.13C3.69 16.56 1.5 14.165 1.5 10.5 1.5 6.402 6.201 3 12 3z" />
                                </svg>
                                {loading ? "카카오톡 인증 중..." : "카카오톡으로 로그인"}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Login;
