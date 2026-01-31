// src/components/Footer.tsx

"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import ComingSoonModal from "@/components/ComingSoonModal";
import LoginModal from "@/components/LoginModal";
import { useAuth } from "@/context/AuthContext";

export default function Footer() {
    const pathname = usePathname();
    const { isAuthenticated } = useAuth();
    const [showEscapeComingSoon, setShowEscapeComingSoon] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
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

    // 공통 SVG 속성
    const svgProps = {
        width: "28",
        height: "28",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
    };

    return (
        <footer
            className="w-full bg-white dark:bg-[#1a241b] border-t-2 border-[rgba(153,192,142,0.5)] dark:border-[rgba(153,192,142,0.2)]"
            style={{
                paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
                backdropFilter: "saturate(180%) blur(8px)",
            }}
        >
            <div className="max-w-7xl mx-auto px-4 py-2">
                <nav className="flex items-center justify-around">
                    {/* 1. 홈 */}
                    <Link
                        href="/"
                        prefetch={true}
                        aria-label="메인"
                        className={`p-2 rounded-md hover:bg-green-50 dark:hover:bg-gray-800 ${
                            isActive("/") ? "bg-green-50 dark:bg-gray-800" : ""
                        }`}
                        style={{ color: isActive("/") ? "#7aa06f" : "#99c08e" }}
                    >
                        <svg {...svgProps}>
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                    </Link>

                    {/* 2. 코스 */}
                    <Link
                        href="/courses"
                        prefetch={true}
                        aria-label="코스"
                        className={`p-2 rounded-md hover:bg-green-50 dark:hover:bg-gray-800 ${
                            isActive("/courses") ? "bg-green-50 dark:bg-gray-800" : ""
                        }`}
                        style={{ color: isActive("/courses") ? "#7aa06f" : "#99c08e" }}
                    >
                        <svg {...svgProps}>
                            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                            <line x1="8" y1="2" x2="8" y2="18" />
                            <line x1="16" y1="6" x2="16" y2="22" />
                        </svg>
                    </Link>

                    {/* 3. 맵 */}
                    <Link
                        href="/map"
                        prefetch={true}
                        aria-label="맵"
                        className={`p-2 rounded-md hover:bg-green-50 dark:hover:bg-gray-800 ${
                            isActive("/map") ? "bg-green-50 dark:bg-gray-800" : ""
                        }`}
                        style={{ color: isActive("/map") ? "#7aa06f" : "#99c08e" }}
                    >
                        <svg {...svgProps}>
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                    </Link>

                    {/* 4. Escape */}
                    <button
                        onClick={() => {
                            if (isAuthenticated) {
                                setShowEscapeComingSoon(true);
                            } else {
                                setShowLoginModal(true);
                            }
                        }}
                        aria-label="Escape"
                        className={`p-2 rounded-md hover:bg-green-50 dark:hover:bg-gray-800 ${
                            isActive("/escape") ? "bg-green-50 dark:bg-gray-800" : ""
                        }`}
                        style={{ color: isActive("/escape") ? "#7aa06f" : "#99c08e" }}
                    >
                        <svg {...svgProps}>
                            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                            <line x1="4" x2="4" y1="22" y2="15" />
                        </svg>
                    </button>

                    {/* 5. 마이페이지 */}
                    {isAuthenticated ? (
                        <Link
                            href="/mypage"
                            prefetch={true}
                            aria-label="마이페이지"
                            className={`p-2 rounded-md hover:bg-green-50 dark:hover:bg-gray-800 relative ${
                                isActive("/mypage") ? "bg-green-50 dark:bg-gray-800" : ""
                            }`}
                            style={{ color: isActive("/mypage") ? "#7aa06f" : "#99c08e" }}
                        >
                        <svg {...svgProps}>
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                            {/* 알림이 꺼져 있을 때만 빨간 점 깜빡임 */}
                            {isAuthenticated && notificationEnabled === false && (
                                <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
                                </span>
                            )}
                        </Link>
                    ) : (
                        <Link
                            href="/login"
                            prefetch={false}
                            aria-label="마이페이지"
                            className={`p-2 rounded-md hover:bg-green-50 dark:hover:bg-gray-800 ${
                                isActive("/mypage") ? "bg-green-50 dark:bg-gray-800" : ""
                            }`}
                            style={{ color: isActive("/mypage") ? "#7aa06f" : "#99c08e" }}
                        >
                            <svg {...svgProps}>
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </Link>
                    )}
                </nav>
            </div>

            {/* ✅ 사건 파일 준비 중 모달 (로그인한 경우) */}
            {showEscapeComingSoon && <ComingSoonModal onClose={() => setShowEscapeComingSoon(false)} />}
            {/* ✅ 로그인 모달 (로그인하지 않은 경우) */}
            {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} next={pathname} />}
        </footer>
    );
}
