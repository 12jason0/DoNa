// src/components/Footer.tsx

"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import TapFeedback from "@/components/TapFeedback";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/context/LocaleContext";

export type PlusButtonProps = {
    plusButtonRef: React.RefObject<HTMLButtonElement>;
    sideMenuOpen: boolean;
    setSideMenuOpen: (v: boolean) => void;
    riseDone: boolean;
    setRiseDone: (v: boolean) => void;
    riseDoneTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    setDrawerAnchorBottom: (v: number) => void;
    mounted: boolean;
    shouldShowAppBanner: boolean;
    shouldShowWebAd: boolean;
};

type FooterProps = {
    isApp?: boolean;
    plusButton?: PlusButtonProps | null;
};

export default function Footer({ isApp = false, plusButton }: FooterProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { t } = useLocale();
    const [notificationEnabled, setNotificationEnabled] = useState<boolean | null>(null);

    // 🟢 AuthContext 기준: 로그인 시에만 알림 상태 조회 (쿠키로 사용자 식별)
    useEffect(() => {
        if (typeof window === "undefined" || !isAuthenticated) {
            setNotificationEnabled(null);
            return;
        }
        const checkNotificationStatus = async () => {
            try {
                const { apiFetch } = await import("@/lib/authClient");
                const { data: statusData, response: statusResponse } = await apiFetch(`/api/push`);
                if (statusResponse.ok && statusData) {
                    setNotificationEnabled((statusData as any).subscribed ?? false);
                }
            } catch (error) {
                console.error("알림 상태 조회 오류:", error);
            }
        };
        checkNotificationStatus();
        const interval = setInterval(checkNotificationStatus, 30000);
        return () => clearInterval(interval);
    }, [pathname, isAuthenticated]);

    // 🟢 로그아웃 시 알림 상태만 초기화 (로그인 상태는 AuthContext가 담당)
    useEffect(() => {
        const handleAuthLogout = () => setNotificationEnabled(null);
        window.addEventListener("authLogout", handleAuthLogout as EventListener);
        return () => window.removeEventListener("authLogout", handleAuthLogout as EventListener);
    }, []);

    // 🟢 알림 업데이트 이벤트 리스너 (ProfileTab에서 변경 발생 시 즉시 반응)
    useEffect(() => {
        const handleNotificationUpdate = (event: CustomEvent) => {
            if (event.detail && typeof event.detail.subscribed === "boolean") {
                setNotificationEnabled(event.detail.subscribed);
            }
        };
        window.addEventListener("notificationUpdated", handleNotificationUpdate as EventListener);
        return () => window.removeEventListener("notificationUpdated", handleNotificationUpdate as EventListener);
    }, []);

    if (pathname === "/map" || pathname?.startsWith("/map/")) {
        return null;
    }

    const isActive = (href: string) => pathname === href || pathname?.startsWith(href + "/");

    // 공통 SVG 속성 (라인 얇게: strokeWidth 1.25~1.5)
    const svgProps = {
        width: "22",
        height: "22",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.5",
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
    };

    const renderPlusButton = () => {
        if (!plusButton) return null;
        const {
            plusButtonRef,
            sideMenuOpen,
            setSideMenuOpen,
            riseDone,
            setRiseDone,
            riseDoneTimeoutRef,
            setDrawerAnchorBottom,
            mounted,
            shouldShowAppBanner,
            shouldShowWebAd,
        } = plusButton;
        const isWeb = !isApp;
        const btnPosClass = isWeb ? "lg:absolute lg:right-4 lg:top-auto" : `lg:fixed lg:right-6 lg:top-auto`;
        return (
            <>
                {!sideMenuOpen && (
                    <div
                        className={`absolute right-4 z-10 pointer-events-none flex items-center ${btnPosClass}`}
                        style={{ bottom: "4rem" }}
                    >
                        <button
                            ref={plusButtonRef}
                            type="button"
                            onClick={() => {
                                if (plusButtonRef.current) {
                                    const rect = plusButtonRef.current.getBoundingClientRect();
                                    setDrawerAnchorBottom(
                                        typeof window !== "undefined" ? window.innerHeight - rect.top : 0,
                                    );
                                }
                                setRiseDone(false);
                                setSideMenuOpen(true);
                                if (riseDoneTimeoutRef.current) clearTimeout(riseDoneTimeoutRef.current);
                                riseDoneTimeoutRef.current = setTimeout(() => {
                                    setRiseDone(true);
                                    riseDoneTimeoutRef.current = null;
                                }, 400);
                            }}
                            aria-label={t("nav.openMenu")}
                            className="w-12 h-12 rounded-full text-white shadow-[0_8px_30px_rgb(0,0,0,0.2)] border-2 border-white/50 dark:border-[#1a241b]/50 flex items-center justify-center transition-all duration-200 ease-out pointer-events-auto hover:scale-110 active:scale-95 bg-[#7FCC9F] hover:bg-[#6bb88a] text-3xl font-light"
                        >
                            +
                        </button>
                    </div>
                )}
                {sideMenuOpen &&
                    (isWeb ? (
                        <div
                            className="absolute right-4 z-2010 pointer-events-none flex items-center gap-2.5"
                            style={{ bottom: "7rem" }}
                        >
                            {riseDone && (
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap drop-shadow-md bg-white/90 dark:bg-black/50 px-2 py-1 rounded-md">
                                    {isAuthenticated ? t("nav.myPage") : t("nav.login")}
                                </span>
                            )}
                            <button
                                type="button"
                                onPointerDown={() => {
                                    if (isAuthenticated) router.prefetch("/mypage");
                                }}
                                onClick={() => {
                                    if (riseDoneTimeoutRef.current) {
                                        clearTimeout(riseDoneTimeoutRef.current);
                                        riseDoneTimeoutRef.current = null;
                                    }
                                    setSideMenuOpen(false);
                                    setRiseDone(false);
                                    router.push(isAuthenticated ? "/mypage" : "/login");
                                }}
                                aria-label={isAuthenticated ? t("nav.goToMyPage") : t("nav.login")}
                                className="w-12 h-12 rounded-full text-white shadow-[0_8px_30px_rgb(0,0,0,0.25)] border-2 border-white flex items-center justify-center transition-all duration-200 ease-out pointer-events-auto hover:scale-110 active:scale-95 bg-[#1a3a2e] hover:bg-[#234a3a]"
                            >
                                {isAuthenticated ? (
                                    <svg
                                        className="h-6 w-6 text-[#99c08e]"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                        />
                                    </svg>
                                ) : (
                                    <svg
                                        className="h-6 w-6 text-[#99c08e]"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                                        />
                                    </svg>
                                )}
                            </button>
                        </div>
                    ) : (
                        typeof document !== "undefined" &&
                        createPortal(
                            <div
                                className={`fixed ${
                                    !mounted
                                        ? "bottom-22"
                                        : isApp
                                          ? shouldShowAppBanner
                                              ? ""
                                              : "bottom-16"
                                          : shouldShowWebAd
                                            ? "bottom-48"
                                            : "bottom-24"
                                } right-6 z-2010 pointer-events-none flex items-center gap-2.5 transition-[bottom] duration-300 ease-in-out`}
                                style={
                                    mounted && isApp && shouldShowAppBanner
                                        ? { bottom: "calc(180px + env(safe-area-inset-bottom, 0px))" }
                                        : undefined
                                }
                            >
                                {riseDone && (
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap drop-shadow-md bg-white/90 dark:bg-black/50 px-2 py-1 rounded-md">
                                        {isAuthenticated ? t("nav.myPage") : t("nav.login")}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onPointerDown={() => {
                                        if (isAuthenticated) router.prefetch("/mypage");
                                    }}
                                    onClick={() => {
                                        if (riseDoneTimeoutRef.current) {
                                            clearTimeout(riseDoneTimeoutRef.current);
                                            riseDoneTimeoutRef.current = null;
                                        }
                                        setSideMenuOpen(false);
                                        setRiseDone(false);
                                        router.push(isAuthenticated ? "/mypage" : "/login");
                                    }}
                                    aria-label={isAuthenticated ? t("nav.goToMyPage") : t("nav.login")}
                                    className="w-12 h-12 rounded-full text-white shadow-[0_8px_30px_rgb(0,0,0,0.25)] border-2 border-white flex items-center justify-center transition-all duration-200 ease-out pointer-events-auto hover:scale-110 active:scale-95 bg-[#1a3a2e] hover:bg-[#234a3a]"
                                >
                                    {isAuthenticated ? (
                                        <svg
                                            className="h-6 w-6 text-[#99c08e]"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                            />
                                        </svg>
                                    ) : (
                                        <svg
                                            className="h-6 w-6 text-[#99c08e]"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                                            />
                                        </svg>
                                    )}
                                </button>
                            </div>,
                            document.body,
                        )
                    ))}
            </>
        );
    };

    return (
        <footer
            className="w-full flex justify-center px-4 pb-1.5 pt-1 relative"
            style={{
                paddingBottom: isApp ? "0px" : "calc(6px + env(safe-area-inset-bottom))",
            }}
        >
            {renderPlusButton()}
            <nav
                className={`flex items-center justify-around rounded-full shadow-lg border border-gray-100 dark:border-gray-800 w-full max-w-md py-1.5 px-1.5 ${
                    isApp ? "bg-white dark:bg-[#1a241b]" : "bg-white/50 dark:bg-[#1a241b]/60"
                }`}
                style={{
                    backdropFilter: "saturate(180%) blur(12px)",
                }}
            >
                {/* 1. 홈 */}
                <TapFeedback>
                    <Link
                        href="/"
                        prefetch={true}
                        aria-label={t("nav.main")}
                        className={`p-1.5 rounded-full transition-colors block ${
                            isActive("/")
                                ? "bg-emerald-500/15 dark:bg-emerald-500/20"
                                : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                        style={{ color: isActive("/") ? "#059669" : "#6b7280" }}
                    >
                        <svg {...svgProps}>
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                    </Link>
                </TapFeedback>

                {/* 2. 코스 */}
                <TapFeedback>
                    <Link
                        href="/courses"
                        prefetch={true}
                        aria-label={t("nav.courses")}
                        className={`p-1.5 rounded-full transition-colors block ${
                            isActive("/courses")
                                ? "bg-emerald-500/15 dark:bg-emerald-500/20"
                                : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                        style={{ color: isActive("/courses") ? "#059669" : "#6b7280" }}
                    >
                        <svg {...svgProps}>
                            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                            <line x1="8" y1="2" x2="8" y2="18" />
                            <line x1="16" y1="6" x2="16" y2="22" />
                        </svg>
                    </Link>
                </TapFeedback>

                {/* 3. 맵 */}
                <TapFeedback>
                    <Link
                        href="/map"
                        prefetch={true}
                        aria-label={t("nav.map")}
                        className={`p-1.5 rounded-full transition-colors block ${
                            isActive("/map")
                                ? "bg-emerald-500/15 dark:bg-emerald-500/20"
                                : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                        style={{ color: isActive("/map") ? "#059669" : "#6b7280" }}
                    >
                        <svg {...svgProps}>
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                    </Link>
                </TapFeedback>

                {/* 4. 오늘의 데이트 추천 */}
                <TapFeedback>
                    <Link
                        href="/personalized-home"
                        prefetch={true}
                        aria-label={t("nav.todayRecommend")}
                        className={`p-1.5 rounded-full transition-colors block ${
                            isActive("/personalized-home")
                                ? "bg-emerald-500/15 dark:bg-emerald-500/20"
                                : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                        style={{ color: isActive("/personalized-home") ? "#059669" : "#6b7280" }}
                    >
                        <svg {...svgProps}>
                            <path d="M12 6V2H8" />
                            <path d="M15 11v2" />
                            <path d="M2 12h2" />
                            <path d="M20 12h2" />
                            <path d="M20 16a2 2 0 0 1-2 2H8.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 4 20.286V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
                            <path d="M9 11v2" />
                        </svg>
                    </Link>
                </TapFeedback>

                {/* 5. 마이페이지 */}
                {isAuthenticated ? (
                    <TapFeedback>
                        <Link
                            href="/mypage"
                            prefetch={true}
                            onMouseEnter={() => router.prefetch("/mypage")}
                            onFocus={() => router.prefetch("/mypage")}
                            aria-label={t("nav.myPage")}
                            className={`p-1.5 rounded-full transition-colors relative block ${
                                isActive("/mypage")
                                    ? "bg-emerald-500/15 dark:bg-emerald-500/20"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                            }`}
                            style={{ color: isActive("/mypage") ? "#059669" : "#6b7280" }}
                        >
                            <svg {...svgProps}>
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            {isAuthenticated && notificationEnabled === false && (
                                <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
                                </span>
                            )}
                        </Link>
                    </TapFeedback>
                ) : (
                    <TapFeedback>
                        <Link
                            href="/login"
                            prefetch={false}
                            aria-label={t("nav.myPage")}
                            className="p-1.5 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 block"
                            style={{ color: "#6b7280" }}
                        >
                            <svg {...svgProps}>
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </Link>
                    </TapFeedback>
                )}
            </nav>
        </footer>
    );
}
