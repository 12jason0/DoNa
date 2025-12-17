// src/components/Header.tsx

"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import NotificationModal from "@/components/NotificationModal";
import ComingSoonModal from "@/components/ComingSoonModal";
import KakaoChannelModal from "@/components/KakaoChannelModal";
import LogoutModal from "@/components/LogoutModal";

const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [panelRight, setPanelRight] = useState(0);
    const [panelWidth, setPanelWidth] = useState(0);
    const [drawerWidth, setDrawerWidth] = useState(0);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [hasFavorites, setHasFavorites] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showComingSoon, setShowComingSoon] = useState<null | string>(null);
    const pathname = usePathname();
    const router = useRouter();
    const menuButtonRef = useRef<HTMLButtonElement | null>(null);
    const drawerRef = useRef<HTMLDivElement | null>(null);
    const [showNotiModal, setShowNotiModal] = useState(false);
    const [showKakaoChannelModal, setShowKakaoChannelModal] = useState(false);

    // ... (기존 useEffect 로직들은 건드리지 않았습니다) ...
    useEffect(() => {
        const checkLoginStatus = async () => {
            const token = localStorage.getItem("authToken");
            if (!token) {
                setIsLoggedIn(false);
                setHasFavorites(false);
                return;
            }

            try {
                const payload = JSON.parse(atob(token.split(".")[1]));
                const exp = payload.exp * 1000;
                const now = Date.now();

                if (exp < now) {
                    localStorage.removeItem("authToken");
                    localStorage.removeItem("user");
                    setIsLoggedIn(false);
                    setHasFavorites(false);
                    return;
                }
            } catch (e) {
                console.warn("토큰 파싱 오류 (서버 검증 시도):", e);
            }

            try {
                const response = await fetch("/api/auth/verify", {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    setIsLoggedIn(true);
                    const idle = (cb: () => void) =>
                        "requestIdleCallback" in window
                            ? (window as any).requestIdleCallback(cb, { timeout: 2000 })
                            : setTimeout(cb, 500);
                    idle(() => {
                        fetchFavoritesSummary();
                    });
                } else {
                    const data = await response.json().catch(() => ({}));
                    if (
                        response.status === 401 &&
                        (data.error?.includes("유효하지 않은") || data.error?.includes("만료"))
                    ) {
                        try {
                            const payload = JSON.parse(atob(token.split(".")[1]));
                            const exp = payload.exp * 1000;
                            const now = Date.now();

                            if (exp < now) {
                                localStorage.removeItem("authToken");
                                localStorage.removeItem("user");
                                setIsLoggedIn(false);
                                setHasFavorites(false);
                            } else {
                                setIsLoggedIn(true);
                            }
                        } catch {
                            localStorage.removeItem("authToken");
                            localStorage.removeItem("user");
                            setIsLoggedIn(false);
                            setHasFavorites(false);
                        }
                    } else {
                        setIsLoggedIn(true);
                    }
                }
            } catch (error) {
                console.warn("토큰 검증 네트워크 오류 (토큰 유지):", error);
                setIsLoggedIn(true);
            }
        };

        const token = localStorage.getItem("authToken");
        setIsLoggedIn(!!token);
        if (token) {
            const idle = (cb: () => void) =>
                "requestIdleCallback" in window
                    ? (window as any).requestIdleCallback(cb, { timeout: 2000 })
                    : setTimeout(cb, 500);
            idle(() => {
                checkLoginStatus();
                fetchFavoritesSummary();
            });
        }

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "authToken") {
                setIsLoggedIn(!!e.newValue);
            }
        };

        const handleCustomStorageChange = (event: Event) => {
            const customEvent = event as CustomEvent;
            const token = customEvent.detail?.token || localStorage.getItem("authToken");
            setIsLoggedIn(!!token);
            if (token) {
                fetchFavoritesSummary();
            } else {
                setHasFavorites(false);
            }
        };

        const handleFavoritesChanged = () => {
            fetchFavoritesSummary();
        };

        window.addEventListener("storage", handleStorageChange);
        window.addEventListener("authTokenChange", handleCustomStorageChange as EventListener);
        window.addEventListener("favoritesChanged", handleFavoritesChanged);

        return () => {
            window.removeEventListener("storage", handleStorageChange);
            window.removeEventListener("authTokenChange", handleCustomStorageChange as EventListener);
            window.removeEventListener("favoritesChanged", handleFavoritesChanged);
        };
    }, []);

    const recomputeAnchor = () => {
        try {
            const mainEl = document.querySelector("main");
            if (!mainEl) return;
            const rect = (mainEl as HTMLElement).getBoundingClientRect();
            const rightOffset = Math.max(0, window.innerWidth - rect.right);
            setPanelRight(rightOffset);
            setPanelWidth(rect.width);
            const isMobile = window.innerWidth < 768;
            const mobileWidth = Math.round(rect.width * 0.5);
            const desktopWidth = Math.min(333, rect.width);
            setDrawerWidth(isMobile ? mobileWidth : desktopWidth);
        } catch {}
    };

    useEffect(() => {
        recomputeAnchor();
        window.addEventListener("resize", recomputeAnchor);
        return () => window.removeEventListener("resize", recomputeAnchor);
    }, [pathname]);

    const fetchFavoritesSummary = async () => {
        try {
            const token = localStorage.getItem("authToken");
            if (!token) {
                setHasFavorites(false);
                return;
            }
            const res = await fetch("/api/users/favorites", {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            });
            if (res.ok) {
                const favorites = await res.json();
                setHasFavorites(Array.isArray(favorites) && favorites.length > 0);
            } else {
                setHasFavorites(false);
            }
        } catch (e) {
            console.error("Failed to fetch favorites summary", e);
            setHasFavorites(false);
        }
    };

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
    const closeMenu = () => setIsMenuOpen(false);

    useEffect(() => {
        const mainEl = document.querySelector("main") as HTMLElement | null;
        if (!mainEl) return;
        if (isMenuOpen) {
            const prevOverflow = document.body.style.overflow;
            const prevMainOverflow = mainEl.style.overflow;
            document.body.style.overflow = "hidden";
            mainEl.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = prevOverflow;
                mainEl.style.overflow = prevMainOverflow;
            };
        } else {
            document.body.style.overflow = "";
            mainEl.style.overflow = "";
        }
    }, [isMenuOpen]);

    useEffect(() => {
        const drawerEl = drawerRef.current;
        if (!drawerEl) return;

        if (isMenuOpen) {
            try {
                drawerEl.removeAttribute("inert");
            } catch {}
            setTimeout(() => {
                try {
                    const firstFocusable = drawerEl.querySelector(
                        'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
                    ) as HTMLElement | null;
                    firstFocusable?.focus();
                } catch {}
            }, 0);
        } else {
            try {
                const active = document.activeElement as HTMLElement | null;
                if (active && drawerEl.contains(active)) {
                    active.blur();
                }
            } catch {}
            try {
                drawerEl.setAttribute("inert", "");
            } catch {}
            setTimeout(() => {
                try {
                    menuButtonRef.current?.focus();
                } catch {}
            }, 0);
        }
    }, [isMenuOpen]);

    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            localStorage.removeItem("authToken");
            localStorage.removeItem("user");
            localStorage.removeItem("loginTime");
        } catch (error) {
            console.error("로그아웃 처리 중 오류 발생:", error);
        }
        setIsLoggedIn(false);
        setHasFavorites(false);
        window.dispatchEvent(new CustomEvent("authTokenChange"));
        closeMenu();
        setShowLogoutConfirm(false);
        router.push("/");
    };

    const openLogoutConfirm = () => {
        try {
            setIsMenuOpen(false);
        } catch {}
        setShowLogoutConfirm(true);
    };

    return (
        <header className="relative z-50 bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <Link href="/" className="flex items-center space-x-2" onClick={closeMenu}>
                        <span className="text-xl font-bold text-gray-900">DoNa</span>
                    </Link>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                window.dispatchEvent(new Event("openSearchModal"));
                            }}
                            className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
                            aria-label="검색"
                        >
                            <Search className="w-6 h-6" />
                        </button>

                        <button
                            onClick={() => {
                                if (isLoggedIn) {
                                    setShowKakaoChannelModal(true);
                                } else {
                                    setShowNotiModal(true);
                                }
                            }}
                            className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors relative"
                            aria-label="알림"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="w-6 h-6"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                                />
                            </svg>
                            {!isLoggedIn && (
                                <span className="absolute top-2 right-2.5 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                            )}
                            {isLoggedIn && (
                                <span className="absolute top-2 right-2.5 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                            )}
                        </button>

                        <button
                            onClick={toggleMenu}
                            className="p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 transition-colors cursor-pointer"
                            aria-label="메뉴"
                            ref={menuButtonRef}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <div>
                {isMenuOpen && (
                    <div
                        className="fixed top-16 bottom-0 z-100 bg-black/30"
                        style={{ right: panelRight, width: panelWidth }}
                        onClick={closeMenu}
                    />
                )}
                {/* ✅ Drawer 컨테이너 */}
                <div
                    className={`fixed top-16 bottom-0 z-[1500] bg-white border-l border-gray-200 transform transition-all ease-in-out duration-300 flex flex-col ${
                        isMenuOpen
                            ? "translate-x-0 opacity-100 pointer-events-auto"
                            : "translate-x-full opacity-0 pointer-events-none"
                    }`}
                    ref={drawerRef}
                    onClick={(e) => e.stopPropagation()}
                    style={{ right: panelRight, width: drawerWidth }}
                >
                    {/* ✅ [수정됨] 상단/하단 영역을 하나의 스크롤 컨테이너로 통합 */}
                    <div className="h-full overflow-y-auto overscroll-contain scrollbar-hide flex flex-col">
                        {/* --- 상단 메뉴 영역 --- */}
                        <div className="pl-6 pt-2 pr-6  space-y-2">
                            <Link
                                href="/"
                                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                                onClick={closeMenu}
                            >
                                홈
                            </Link>
                            <Link
                                href="/courses"
                                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                                onClick={closeMenu}
                            >
                                완벽한 하루
                            </Link>
                            <Link
                                href="/nearby"
                                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                                onClick={closeMenu}
                            >
                                오늘 뭐하지?
                            </Link>
                            <Link
                                href="/personalized-home"
                                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                                onClick={closeMenu}
                            >
                                🎯 AI 추천
                            </Link>
                            <Link
                                href="/map"
                                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                                onClick={closeMenu}
                            >
                                지도
                            </Link>

                            <button
                                onClick={() => {
                                    closeMenu();
                                    setShowComingSoon("escape");
                                }}
                                className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:bg-gray-50 flex items-center gap-2"
                            >
                                <span>🔒커플 미션 게임</span>
                            </button>

                            <div className="pt-4  border-t border-gray-200">
                                {isLoggedIn ? (
                                    <Link
                                        href="/mypage"
                                        className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                                        onClick={closeMenu}
                                    >
                                        마이페이지
                                    </Link>
                                ) : (
                                    <>
                                        <Link
                                            href="/login"
                                            className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                                            onClick={closeMenu}
                                        >
                                            로그인
                                        </Link>
                                        <Link
                                            href="/signup"
                                            className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                                            onClick={closeMenu}
                                        >
                                            회원가입
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* --- 하단 정보 영역 (이제 스크롤 흐름에 포함됨) --- */}
                        <div className="px-6 border-t border-gray-100 bg-white">
                            {isLoggedIn && (
                                <button
                                    onClick={openLogoutConfirm}
                                    className="w-full flex items-center gap-2 px-3 py-2 mt-4 mb-4 rounded-lg text-base font-medium text-red-700 hover:bg-gray-50 transition-colors tracking-tight"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth={2}
                                        stroke="currentColor"
                                        className="w-5 h-5"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                                        />
                                    </svg>
                                    <span>로그아웃</span>
                                </button>
                            )}

                            {!isLoggedIn && <div className="h-6"></div>}

                            <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                                <Link
                                    href="/about"
                                    onClick={closeMenu}
                                    className="flex items-center justify-center gap-1.5 py-1 text-gray-400 hover:text-emerald-600 transition-colors"
                                >
                                    <span className="text-xs font-medium">서비스 소개</span>
                                </Link>
                                <Link
                                    href="/help"
                                    onClick={closeMenu}
                                    className="flex items-center justify-center gap-1.5 py-1 text-gray-400 hover:text-emerald-600 transition-colors"
                                >
                                    <span className="text-xs font-medium">이용 안내</span>
                                </Link>
                                <Link
                                    href="/privacy"
                                    onClick={closeMenu}
                                    className="flex items-center justify-center gap-1.5 py-1 text-gray-400 hover:text-emerald-600 transition-colors"
                                >
                                    <span className="text-xs font-medium">개인정보처리방침</span>
                                </Link>
                                <Link
                                    href="/terms"
                                    onClick={closeMenu}
                                    className="flex items-center justify-center gap-1.5 py-1 text-gray-400 hover:text-emerald-600 transition-colors"
                                >
                                    <span className="text-xs font-medium">이용약관</span>
                                </Link>
                            </div>

                            <div className="pt-4 border-t border-gray-50 text-center">
                                <p className="text-[10px] text-gray-300 font-medium">버전 1.0.0</p>
                                <p className="text-[10px] text-gray-300 font-medium mt-1">
                                    © 2026 DoNa Team. All rights reserved.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showLogoutConfirm && <LogoutModal onClose={() => setShowLogoutConfirm(false)} onConfirm={handleLogout} />}

            {showComingSoon && <ComingSoonModal onClose={() => setShowComingSoon(null)} />}
            {!isLoggedIn && showNotiModal && <NotificationModal onClose={() => setShowNotiModal(false)} />}
            {isLoggedIn && showKakaoChannelModal && (
                <KakaoChannelModal onClose={() => setShowKakaoChannelModal(false)} />
            )}
        </header>
    );
};

export default Header;
