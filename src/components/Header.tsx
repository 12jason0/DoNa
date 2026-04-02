// src/components/Header.tsx

"use client";

import React, { useState, useEffect, memo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Settings, X } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useLocale } from "@/context/LocaleContext";
import ComingSoonModal from "@/components/ComingSoonModal";
import LogoutModal from "@/components/LogoutModal";
import SuggestNotificationModal from "@/components/SuggestNotificationModal";
import LoginModal from "@/components/LoginModal";
import TapFeedback from "@/components/TapFeedback";
import { useAppLayout, ANDROID_MODAL_BOTTOM } from "@/context/AppLayoutContext";
import { useNativeModalNotify } from "@/hooks/useNativeModalNotify";

// 🟢 [로그아웃 오버레이] - 스플래시 없이 메시지만 표시 (t는 부모에서 주입)
const LogoutOverlay = ({ message }: { message: string }) => (
    <div className="fixed inset-0 z-9999 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white dark:bg-[#1a241b] rounded-xl border border-gray-200 dark:border-gray-800 px-6 py-4 shadow-xl">
            <p className="text-gray-700 dark:text-gray-300 font-medium tracking-tight">{message}</p>
        </div>
    </div>
);

// 🟢 React.memo를 사용하여 Header의 자체 상태 변경이 부모 레이아웃 전체에 영향을 주지 않도록 격리
const Header = memo(() => {
    const { containInPhone, isAndroidApp, iosIgnoreSafeAreaBottom } = useAppLayout();
    const posClass = containInPhone ? "absolute" : "fixed";
    const { resolvedTheme, setTheme } = useTheme();
    const { locale, setLocaleSafe, isLocaleLoading, t } = useLocale();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false); // 🟢 새로 추가
    const [showComingSoon, setShowComingSoon] = useState<null | string>(null);
    const [showSuggestModal, setShowSuggestModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);

    const pathname = usePathname();
    const router = useRouter();

    useNativeModalNotify(
        showSettingsModal ||
            showLogoutConfirm ||
            !!showComingSoon ||
            showLoginModal ||
            showSuggestModal,
    );

    useEffect(() => {
        const onAuthLogout = () => setIsLoggingOut(false);
        window.addEventListener("authLogout", onAuthLogout);
        return () => window.removeEventListener("authLogout", onAuthLogout);
    }, []);

    // 🟢 메인 페이지 prefetch (성능 최적화)
    useEffect(() => {
        if (pathname !== "/") {
            router.prefetch("/");
        }
    }, [router, pathname]);

    // --- 🟢 로그아웃 로직 (중복 실행 방지) ---
    const handleLogout = async () => {
        if (isLoggingOut) return;

        // 🟢 1. 즉시 오버레이 표시 상태로 변경
        setIsLoggingOut(true);
        setShowLogoutConfirm(false);

        try {
            const { logout } = await import("@/lib/authClient");

            // 🟢 2. 서버 로그아웃 수행 (리다이렉트 없이 데이터만 처리)
            await logout({ skipRedirect: true });

            // 🟢 3. [핵심] 오버레이를 보여주기 위한 인위적 대기 (1초)
            // 이 대기 시간 동안 사용자는 "안전하게 로그아웃 중" 메시지를 보게 됩니다.
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // 🟢 4. 대기 후 페이지 이동
            window.location.replace("/");
        } catch (error) {
            console.error("로그아웃 오류:", error);
            // 에러 발생 시에도 메인으로 이동
            window.location.replace("/");
        }
    };

    return (
        <>
            {isLoggingOut && <LogoutOverlay message={t("header.loggingOut")} />}

            <header
                className="relative z-50 bg-white dark:bg-[#1a241b]"
                style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-12">
                        <div className="flex items-center h-full">
                            <TapFeedback>
                                <Link href="/" prefetch={true} className="flex items-center h-full">
                                    <span className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                                        DoNa
                                    </span>
                                </Link>
                            </TapFeedback>
                        </div>

                        <div className="flex items-center gap-0.5 h-full">
                            {/* 검색 버튼 */}
                            <TapFeedback>
                                <button
                                    onClick={() => window.dispatchEvent(new Event("openSearchModal"))}
                                    className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    aria-label={t("header.search")}
                                >
                                    <Search className="w-5 h-5" />
                                </button>
                            </TapFeedback>

                            {/* 장소 제보 (종 아이콘 + 알림 뱃지) */}
                            <TapFeedback>
                                <button
                                    type="button"
                                    onClick={() => setShowSuggestModal(true)}
                                    className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
                                    aria-label={t("header.suggestPlace")}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth={1.5}
                                        stroke="currentColor"
                                        className="w-5 h-5"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                                        />
                                    </svg>
                                    <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5" aria-hidden>
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                                    </span>
                                </button>
                            </TapFeedback>

                            {/* 설정 버튼 (모달 열기) */}
                            <TapFeedback>
                                <button
                                    type="button"
                                    onClick={() => setShowSettingsModal(true)}
                                    className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    aria-label={t("common.settings")}
                                    title={t("common.settings")}
                                >
                                    <Settings className="w-5 h-5" />
                                </button>
                            </TapFeedback>
                        </div>
                    </div>
                </div>
            </header>

            {/* 모든 모달들 */}
            {showLogoutConfirm && <LogoutModal onClose={() => setShowLogoutConfirm(false)} onConfirm={handleLogout} />}
            {showComingSoon && <ComingSoonModal onClose={() => setShowComingSoon(null)} />}
            {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} next={pathname} />}
            {showSuggestModal && (
                <SuggestNotificationModal onClose={() => setShowSuggestModal(false)} />
            )}

            {/* 설정 모달 (다크/라이트 모드) - 아래에서 올라오는 바텀시트. Android는 네비 바로 위 */}
            {showSettingsModal && (
                <div
                    className={`${posClass} inset-0 z-2000 flex items-end justify-center bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200`}
                    onClick={() => setShowSettingsModal(false)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Escape" && setShowSettingsModal(false)}
                    aria-label={t("header.closeSettingsModal")}
                >
                    <div
                        className={`${posClass} left-0 right-0 z-2001 overflow-y-auto scrollbar-hide rounded-t-2xl bg-white dark:bg-[#1a241b] shadow-2xl border-t border-gray-100 dark:border-gray-800 ${!iosIgnoreSafeAreaBottom && !isAndroidApp ? "bottom-3" : ""} ${containInPhone ? "max-h-[85%]" : "max-h-[calc(100vh-3rem)]"}`}
                        style={{
                            animation: "slideUp 0.3s ease-out forwards",
                            ...(iosIgnoreSafeAreaBottom ? { bottom: 0 } : isAndroidApp ? { bottom: ANDROID_MODAL_BOTTOM } : {}),
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t("common.settings")}</h3>
                            <button
                                type="button"
                                onClick={() => setShowSettingsModal(false)}
                                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                aria-label={t("common.close")}
                            >
                                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            </button>
                        </div>
                        <div className="p-4 pb-8">
                            {/* 언어 선택: language.* (日本語·中文 자국어 표기, 웹은 폰트 스택 폴백) */}
                            <p className="text-sm font-normal text-gray-600 dark:text-gray-400 mb-3">
                                {t("language.label")}
                            </p>
                            <div className="flex gap-2 mb-6">
                                {(["ko", "en", "ja", "zh"] as const).map((loc) => (
                                    <button
                                        key={loc}
                                        type="button"
                                        disabled={isLocaleLoading}
                                        onClick={() => {
                                            setLocaleSafe(loc);
                                            setShowSettingsModal(false);
                                        }}
                                        className={`flex-1 min-w-0 flex items-center justify-center py-2.5 rounded-xl border-2 transition-colors text-sm font-normal disabled:opacity-60 disabled:pointer-events-none ${
                                            locale === loc
                                                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                                                : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                                        }`}
                                    >
                                        {t(`language.${loc}`)}
                                    </button>
                                ))}
                            </div>
                            <p className="text-sm font-normal text-gray-600 dark:text-gray-400 mb-3">
                                {t("theme.label")}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTheme("light");
                                        setShowSettingsModal(false);
                                    }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-colors ${
                                        resolvedTheme === "light"
                                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                                    }`}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="22"
                                        height="22"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="w-6 h-6 shrink-0"
                                    >
                                        <circle cx="12" cy="12" r="4" />
                                        <path d="M12 2v2" />
                                        <path d="M12 20v2" />
                                        <path d="m4.93 4.93 1.41 1.41" />
                                        <path d="m17.66 17.66 1.41 1.41" />
                                        <path d="M2 12h2" />
                                        <path d="M20 12h2" />
                                        <path d="m6.34 17.66-1.41 1.41" />
                                        <path d="m19.07 4.93-1.41 1.41" />
                                    </svg>
                                    <span className="font-medium text-sm">{t("theme.light")}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTheme("dark");
                                        setShowSettingsModal(false);
                                    }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-colors ${
                                        resolvedTheme === "dark"
                                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                                    }`}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="22"
                                        height="22"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="w-6 h-6 shrink-0"
                                    >
                                        <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
                                    </svg>
                                    <span className="font-medium text-sm">{t("theme.dark")}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
});

Header.displayName = "Header"; // memo 사용 시 디버깅을 위한 이름 설정

export default Header;
