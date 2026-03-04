"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/context/LocaleContext";
import { fetchSession } from "@/lib/authClient";
import { getSafeRedirectPath } from "@/lib/redirect";
import dynamic from "next/dynamic";

// 모바일 앱 환경에서만 Apple 로그인 컴포넌트 로드
const AppleLoginButton = dynamic(() => import("@/components/AppleLoginButton"), { ssr: false });

const Login = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t, isLocaleReady } = useLocale();
    // next 파라미터가 없으면 메인 페이지(/)로 이동
    const nextParam = searchParams.get("next");
    const next = nextParam ? getSafeRedirectPath(nextParam, "/") : "/";
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
        // 🟢 로그인 페이지 로드 시 메인 페이지 prefetch (빠른 이동을 위해)
        router.prefetch("/");
    }, [router]);

    // URL 파라미터에서 메시지 및 에러 확인
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlMessage = urlParams.get("message");
        const urlError = urlParams.get("error");

        if (urlMessage) {
            setMessage(decodeURIComponent(urlMessage));
        }

        if (urlError) {
            // 🟢 한글 에러 메시지 안전하게 디코딩
            try {
                setError(decodeURIComponent(urlError));
            } catch (e) {
                // 디코딩 실패 시 원본 사용
                setError(urlError);
            }
        }

        // URL에서 메시지 및 에러 파라미터 제거
        if (urlMessage || urlError) {
            const currentNext = urlParams.get("next");
            const cleanUrl = window.location.pathname + (currentNext ? `?next=${encodeURIComponent(currentNext)}` : "");
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
        // 🟢 [Fix]: 중복 클릭 방지 - 이미 로딩 중이면 요청 무시
        if (loading) return;

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
                // 🟢 쿠키 기반 인증: localStorage 제거
                // 쿠키는 서버에서 이미 설정되었으므로 클라이언트에서 별도 작업 불필요

                // 🟢 [Fix]: 세션 캐시 강제 갱신 플래그 및 트리거 저장 (로컬/카카오 로그인 통합)
                if (typeof window !== "undefined") {
                    sessionStorage.setItem("auth:forceRefresh", Date.now().toString());
                    sessionStorage.setItem("login_success_trigger", Date.now().toString());
                }

                // 🟢 로그인 성공 이벤트 발생 (useAuth 훅이 감지)
                window.dispatchEvent(new CustomEvent("authLoginSuccess"));

                // 🟢 기존 코드 호환성을 위한 localStorage 정리 (혹시 남아있을 수 있음)
                localStorage.removeItem("authToken");
                localStorage.removeItem("user");
                localStorage.removeItem("loginTime");

                // 🟢 [Fix]: 웹뷰 통신 - 앱에 userId 전달 (세션 동기화)
                try {
                    if ((window as any).ReactNativeWebView) {
                        (window as any).ReactNativeWebView.postMessage(
                            JSON.stringify({
                                type: "login", // 🟢 WebScreen.tsx에서 기대하는 타입으로 변경
                                userId: data?.user?.id ?? null,
                                // 🟢 token은 쿠키에 있으므로 필요시 세션 API에서 가져옴
                                token: data?.token ?? null,
                            })
                        );
                    }
                } catch {}

                // 🟢 [Fix]: 로그인 성공 시 "로그인 중..." 상태 유지한 채로 바로 메인으로 이동
                // router.replace는 비동기적으로 작동하여 상태 업데이트가 먼저 일어날 수 있으므로
                // window.location.href를 사용하여 즉시 페이지 이동
                const redirectPath = !next || next.startsWith("/login") ? "/" : next;
                window.location.href = redirectPath;
                return; // 🟢 [Fix]: 성공 시 바로 리턴하여 finally 블록의 setLoading(false) 실행 방지
            } else {
                setError(data.error || t("authPage.login.errorLoginFailed"));
                setLoading(false); // 🟢 [Fix]: 실패 시에만 loading 상태 해제
            }
        } catch (error) {
            console.error("로그인 오류:", error);
            setError(t("authPage.login.errorGeneric"));
            setLoading(false); // 🟢 [Fix]: 에러 시에만 loading 상태 해제
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
                // 🟢 [2026-01-23] 모바일 앱: Kakao JS SDK authorize 사용 → 카카오톡 앱 간편 로그인 가능
                const mobileNext = next === "/" ? "mobile" : `mobile?redirect=${encodeURIComponent(next)}`;
                const Kakao = (window as any).Kakao;
                const redirectUri = `${window.location.origin}/api/auth/kakao/callback`;
                if (Kakao?.Auth?.authorize && (Kakao.isInitialized?.() || process.env.NEXT_PUBLIC_KAKAO_JS_KEY)) {
                    if (Kakao && !Kakao.isInitialized?.()) {
                        Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY);
                    }
                    Kakao.Auth.authorize({
                        redirectUri,
                        state: mobileNext,
                        scope: "profile_nickname,profile_image,age_range,gender",
                    });
                    return;
                }
                // SDK 미로드 시 기존 리다이렉트 방식 폴백
                window.location.href = `/api/auth/kakao?next=${encodeURIComponent(mobileNext)}`;
                return;
            }

            const kakaoClientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
            const redirectUri = `${window.location.origin}/api/auth/kakao/callback`; // 현재 도메인 기반으로 동적 설정

            if (!kakaoClientId) {
                setError(t("authPage.login.errorKakaoClientId"));
                setLoading(false);
                return;
            }

            // next 값을 sessionStorage에 저장 (팝업 인증 후 사용)
            sessionStorage.setItem("auth:next", next);

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
                    // 콜백에서 전달받은 next 사용, 없으면 sessionStorage에서 가져오기, 둘 다 없으면 현재 next, 마지막으로 메인 페이지
                    const receivedNext = (event.data as any).next || sessionStorage.getItem("auth:next") || next || "/";

                    try {
                        const response = await fetch("/api/auth/kakao", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ code, next: receivedNext }),
                        });

                        // 리다이렉트 응답인 경우
                        if (response.redirected || response.url) {
                            const redirectPath = response.url || receivedNext || "/";
                            window.location.href = redirectPath;
                            cleanup();
                            return;
                        }

                        const data = await response.json();

                        if (!response.ok) throw new Error(data.error || t("authPage.login.errorLoginProcess"));

                        // 🟢 [Fix]: 세션 캐시 강제 갱신 플래그 및 트리거 저장 (로컬/카카오 로그인 통합)
                        if (typeof window !== "undefined") {
                            sessionStorage.setItem("auth:forceRefresh", Date.now().toString());
                            sessionStorage.setItem("login_success_trigger", Date.now().toString());
                        }

                        // 🟢 쿠키 기반 인증: localStorage 제거
                        // 쿠키는 서버에서 이미 설정되었으므로 클라이언트에서 별도 작업 불필요
                        localStorage.removeItem("authToken");
                        localStorage.removeItem("user");
                        localStorage.removeItem("loginTime");

                        // 🟢 로그인 성공 이벤트 발생 (useAuth 훅이 감지)
                        window.dispatchEvent(new CustomEvent("authLoginSuccess"));

                        // 🟢 [Fix]: 로그인 성공 시 "로그인 중..." 상태 유지한 채로 바로 메인으로 이동
                        // cleanup()에서 setLoading(false)를 호출하지 않고 바로 리다이렉트
                        cleanupWithoutLoading();

                        // 🟢 LoginModal을 통한 로그인: receivedNext가 있으면 그곳으로, 없거나 로그인 페이지면 메인으로
                        // 🟢 [Fix]: router.replace는 비동기적으로 작동하여 상태 업데이트가 먼저 일어날 수 있으므로
                        // window.location.href를 사용하여 즉시 페이지 이동
                        const redirectPath = !receivedNext || receivedNext.startsWith("/login") ? "/" : receivedNext;
                        window.location.href = redirectPath;
                    } catch (err: any) {
                        setError(err.message);
                        cleanup();
                    }
                } else if (type === "KAKAO_AUTH_ERROR") {
                    setError(t("authPage.login.errorAuthFailed", { error: authError ?? "" }));
                    cleanup();
                }
            };

            // 3. 리스너 등록 및 팝업 감시 함수
            let intervalId: any = null;
            // 🟢 [Fix]: 로그인 성공 시 cleanup을 호출하지 않기 위한 별도 함수
            const cleanupWithoutLoading = () => {
                if (intervalId) clearInterval(intervalId);
                window.removeEventListener("message", messageHandler);
            };
            const cleanup = () => {
                cleanupWithoutLoading();
                setLoading(false);
            };

            window.addEventListener("message", messageHandler);

            // 4. 카카오 인증 URL 생성 및 팝업 열기
            const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?${new URLSearchParams({
                client_id: kakaoClientId,
                redirect_uri: redirectUri,
                response_type: "code",
                scope: "profile_nickname, profile_image, age_range, gender",
                state: encodeURIComponent(next || "/"), // next 값을 state로 전달
            }).toString()}`;

            const popup = window.open(
                kakaoAuthUrl,
                "kakao-login",
                `width=500,height=700,left=${window.screen.width / 2 - 250},top=${window.screen.height / 2 - 350}`
            );

            if (!popup) {
                setError(t("authPage.login.errorPopupBlocked"));
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
                            setError(t("authPage.login.errorKakaoCanceled"));
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
        <div className="min-h-screen bg-linear-to-br from-green-50 via-(--brand-cream) to-white dark:from-[#0f1710] dark:via-[#0f1710] dark:to-[#0f1710]">
            <main className="max-w-sm mx-auto px-4 py-8 pb-28 overflow-y-auto">
                <div className="w-full bg-white dark:bg-[#1a241b] rounded-xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col">
                    {!isLocaleReady ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
                        </div>
                    ) : (
                    <>
                    <div className="text-center mb-6">
                        <div className="mx-auto mb-2 w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <span className="text-2xl">🌿</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 font-brand tracking-tight">
                            {t("authPage.login.title")}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">{t("authPage.login.welcome")}</p>
                    </div>
                    <div ref={scrollAreaRef}>
                        {message && (
                            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg">
                                <p className="text-green-600 dark:text-green-400 text-sm">{message}</p>
                            </div>
                        )}

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg">
                                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6 text-gray-600 dark:text-gray-400">
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-sm font-medium text-gray-800 dark:text-gray-300 mb-2"
                                >
                                    {t("authPage.login.email")}
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    autoComplete="username"
                                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0f1710] dark:text-white focus:bg-white dark:focus:bg-[#0f1710] focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 focus:border-emerald-500 dark:focus:border-emerald-600"
                                    placeholder={t("authPage.login.emailPlaceholder")}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-800 dark:text-gray-300 mb-2"
                                >
                                    {t("authPage.login.password")}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        autoComplete="current-password"
                                        className="w-full px-4 py-3 pr-12 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0f1710] dark:text-white focus:bg-white dark:focus:bg-[#0f1710] focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 focus:border-emerald-500 dark:focus:border-emerald-600"
                                        placeholder={t("authPage.login.passwordPlaceholder")}
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none transition-colors"
                                        disabled={loading}
                                        aria-label={showPassword ? t("authPage.login.passwordHide") : t("authPage.login.passwordShow")}
                                    >
                                        {showPassword ? (
                                            <svg
                                                className="w-5 h-5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858 5.858a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                                                />
                                            </svg>
                                        ) : (
                                            <svg
                                                className="w-5 h-5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                />
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 tracking-tight"
                            >
                                {loading ? t("authPage.login.submitting") : t("authPage.login.submit")}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-gray-600 dark:text-gray-400">
                                {t("authPage.login.noAccount")}{" "}
                                <Link
                                    href={`/signup?next=${encodeURIComponent(next)}`}
                                    className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-500 font-medium"
                                >
                                    {t("authPage.login.signup")}
                                </Link>
                            </p>
                        </div>

                        <div className="mt-2">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-green-100 dark:border-gray-700" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white dark:bg-[#1a241b] text-gray-500 dark:text-gray-400">
                                        {t("authPage.login.or")}
                                    </span>
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
                                {loading ? t("authPage.login.kakaoSubmitting") : t("authPage.login.kakaoSubmit")}
                            </button>

                            {/* Apple 로그인 버튼 (웹 및 모바일 앱 모두 지원) */}
                            <AppleLoginButton
                                next={next}
                                onSuccess={async (credential: any) => {
                                    try {
                                        setLoading(true);
                                        setError("");

                                        // Apple 인증 정보를 서버로 전송
                                        const response = await fetch("/api/auth/apple", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                                identityToken: credential.identityToken,
                                                authorizationCode: credential.authorizationCode,
                                                user: credential.user,
                                                fullName: credential.fullName,
                                            }),
                                        });

                                        const data = await response.json();

                                        if (!response.ok) {
                                            throw new Error(data.error || t("authPage.login.errorLoginProcess"));
                                        }

                                        // 🟢 쿠키 기반 인증: localStorage 제거 (쿠키는 서버에서 이미 설정됨)
                                        localStorage.removeItem("authToken");
                                        localStorage.removeItem("user");
                                        localStorage.removeItem("loginTime");

                                        // 🟢 로그인 성공 이벤트 발생
                                        window.dispatchEvent(new CustomEvent("authLoginSuccess"));

                                        // 🟢 [Fix]: 로그인 성공 시간을 타임스탬프로 저장 (쿠키 동기화 시간 계산용)
                                        sessionStorage.setItem("login_success_trigger", Date.now().toString());

                                        // 🟢 [Fix]: 로그인 성공 시 "로그인 중..." 상태 유지한 채로 바로 메인으로 이동
                                        // window.location.href를 사용하여 즉시 페이지 이동
                                        window.location.href = "/";
                                        // 🟢 [Fix]: 성공 시 바로 리턴하여 finally 블록의 setLoading(false) 실행 방지
                                        return;
                                    } catch (err: any) {
                                        setError(err.message || t("authPage.login.errorAppleFailed"));
                                        setLoading(false); // 🟢 [Fix]: 에러 시에만 loading 상태 해제
                                    }
                                }}
                                onError={(error: any) => {
                                    // ERR_REQUEST_CANCELED는 사용자가 취소한 경우이므로 에러 표시 안 함
                                    if (error.code === "ERR_REQUEST_CANCELED") {
                                        return;
                                    }
                                    // AppleLoginButton에서 이미 번역된 메시지 전달 (팝업 차단, 로그인 실패 등)
                                    if (error?.message) {
                                        setError(error.message);
                                    } else {
                                        setError(t("authPage.login.errorAppleFailed"));
                                    }
                                }}
                                disabled={loading}
                            />
                        </div>
                    </div>
                    </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Login;
