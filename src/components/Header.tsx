// src/components/Header.tsx

"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import NotificationModal from "@/components/NotificationModal";
import ComingSoonModal from "@/components/ComingSoonModal";

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

    useEffect(() => {
        const checkLoginStatus = async () => {
            const token = localStorage.getItem("authToken");
            if (!token) {
                setIsLoggedIn(false);
                setHasFavorites(false);
                return;
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
                    localStorage.removeItem("authToken");
                    localStorage.removeItem("user");
                    setIsLoggedIn(false);
                    setHasFavorites(false);
                }
            } catch (error) {
                console.error("토큰 검증 오류:", error);
                localStorage.removeItem("authToken");
                localStorage.removeItem("user");
                setIsLoggedIn(false);
                setHasFavorites(false);
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
        router.push("/");
    };

    const openLogoutConfirm = () => {
        try {
            setIsMenuOpen(false);
        } catch {}
        setShowLogoutConfirm(true);
    };
    const closeLogoutConfirm = () => setShowLogoutConfirm(false);

    return (
        <header className="relative z-50 bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* 로고 */}
                    <Link href="/" className="flex items-center space-x-2" onClick={closeMenu}>
                        <span className="text-xl font-bold text-gray-900">DoNa</span>
                    </Link>

                    <div className="flex items-center gap-2">
                        {/* [추가] 검색 아이콘 버튼 */}
                        <button
                            onClick={() => {
                                window.dispatchEvent(new Event("openSearchModal"));
                            }}
                            className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
                            aria-label="검색"
                        >
                            <Search className="w-6 h-6" />
                        </button>

                        {/* 알림 버튼: 로그인하지 않은 경우에만 표시 */}
                        {!isLoggedIn && (
                            <button
                                onClick={() => setShowNotiModal(true)}
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

                                {/* 빨간 점 (배지) */}
                                <span className="absolute top-2 right-2.5 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                            </button>
                        )}
                        {/* 메뉴(햄버거) 버튼 */}
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

            {/* 앱 스타일 오프캔버스 메뉴 (나머지 로직 동일) */}
            <div>
                {isMenuOpen && (
                    <div
                        className="fixed top-16 bottom-0 z-100 bg-black/30"
                        style={{ right: panelRight, width: panelWidth }}
                        onClick={closeMenu}
                    />
                )}
                <div
                    className={`fixed top-16 bottom-0 z-[1500] bg-white border-l border-gray-200 shadow-2xl transform transition-all ease-in-out duration-300 flex flex-col ${
                        isMenuOpen
                            ? "translate-x-0 opacity-100 pointer-events-auto"
                            : "translate-x-full opacity-0 pointer-events-none"
                    }`}
                    ref={drawerRef}
                    onClick={(e) => e.stopPropagation()}
                    style={{ right: panelRight, width: drawerWidth }}
                >
                    <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-hide p-6 space-y-2">
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

                        {/* 커플 미션 게임 (Coming Soon) */}
                        <button
                            onClick={() => {
                                closeMenu();
                                setShowComingSoon("escape");
                            }}
                            className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:bg-gray-50 flex items-center gap-2"
                        >
                            <span>🔒 커플 미션 게임</span>
                        </button>

                        <div className="pt-4 mt-2 border-t border-gray-200">
                            {isLoggedIn ? (
                                <>
                                    <Link
                                        href="/mypage"
                                        className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                                        onClick={closeMenu}
                                    >
                                        마이페이지
                                    </Link>
                                    <button
                                        onClick={openLogoutConfirm}
                                        className="cursor-pointer block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                        로그아웃
                                    </button>
                                </>
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

                        {/* 하단 고정: 서비스 소개 / 이용안내 */}
                        <div className="pt-4 mt-2 border-t border-gray-200 grid grid-cols-2 gap-3">
                            <Link
                                href="/about"
                                onClick={closeMenu}
                                className="flex flex-col items-center justify-center gap-2 px-3 py-3 rounded-xl bg-gray-50 hover:bg-gray-100"
                            >
                                <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow">
                                    <svg
                                        className="w-5 h-5 text-gray-700"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <path d="M12 20l9-5-9-5-9 5 9 5z" />
                                        <path d="M12 12l9-5-9-5-9 5 9 5z" />
                                    </svg>
                                </span>
                                <span className="text-sm font-semibold text-gray-800">서비스 소개</span>
                            </Link>
                            <Link
                                href="/help"
                                onClick={closeMenu}
                                className="flex flex-col items-center justify-center gap-2 px-3 py-3 rounded-xl bg-gray-50 hover:bg-gray-100"
                            >
                                <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow">
                                    <svg
                                        className="w-5 h-5 text-gray-700"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <path d="M11 10h2v6h-2z" />
                                        <path d="M12 6h.01" />
                                    </svg>
                                </span>
                                <span className="text-sm font-semibold text-gray-800">
                                    이용
                                    <br />
                                    안내
                                </span>
                            </Link>
                            <Link
                                href="/privacy"
                                onClick={closeMenu}
                                className="flex flex-col items-center justify-center gap-2 px-3 py-3 rounded-xl bg-gray-50 hover:bg-gray-100"
                            >
                                <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow">
                                    <svg
                                        className="w-5 h-5 text-gray-700"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <path d="M12 2l6 4v4c0 5-3 9-6 10-3-1-6-5-6-10V6l6-4z" />
                                    </svg>
                                </span>
                                <span className="text-sm font-semibold text-gray-800">
                                    개인
                                    <br />
                                    정보
                                </span>
                            </Link>
                            <Link
                                href="/terms"
                                onClick={closeMenu}
                                className="flex flex-col items-center justify-center gap-2 px-3 py-3 rounded-xl bg-gray-50 hover:bg-gray-100"
                            >
                                <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow">
                                    <svg
                                        className="w-5 h-5 text-gray-700"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <path d="M6 2h9a2 2 0 012 2v16l-4-2-4 2-4-2V4a2 2 0 012-2z" />
                                    </svg>
                                </span>
                                <span className="text-sm font-semibold text-gray-800">
                                    이용
                                    <br />
                                    약관
                                </span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* 로그아웃 모달 */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-80 animate-fade-in">
                        <div className="text-center mb-4">
                            <div className="text-4xl mb-2">🍃</div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">잠깐만요!</h3>
                            <p className="text-gray-600">정말 로그아웃 하시겠어요?</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={closeLogoutConfirm}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 transition-all cursor-pointer"
                            >
                                머물기
                            </button>
                            <button
                                onClick={() => {
                                    closeLogoutConfirm();
                                    handleLogout();
                                }}
                                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                                로그아웃
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* 커밍순 모달 */}
            {showComingSoon && <ComingSoonModal onClose={() => setShowComingSoon(null)} />}
            {/* 알림 모달: 로그인하지 않은 경우에만 표시 */}
            {!isLoggedIn && showNotiModal && <NotificationModal onClose={() => setShowNotiModal(false)} />}
        </header>
    );
};

export default Header;
