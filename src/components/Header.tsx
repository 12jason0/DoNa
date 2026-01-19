// src/components/Header.tsx

"use client";

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import NotificationModal from "@/components/NotificationModal";
import ComingSoonModal from "@/components/ComingSoonModal";
import KakaoChannelModal from "@/components/KakaoChannelModal";
import LogoutModal from "@/components/LogoutModal";
import LoginModal from "@/components/LoginModal";

// 🟢 [로그아웃 스플래시 UI] - 무결성 유지
const LogoutSplash = () => (
    <div className="fixed inset-0 z-9999 bg-white dark:bg-[#0f1710] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center animate-pulse">
            <span className="text-3xl font-bold text-gray-900 dark:text-white mb-4 tracking-tighter italic">DoNa</span>
            <div className="flex gap-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
            </div>
            <p className="mt-6 text-gray-500 dark:text-gray-400 font-medium tracking-tight">
                안전하게 로그아웃 중입니다...
            </p>
        </div>
    </div>
);

// 🟢 React.memo를 사용하여 Header의 자체 상태 변경이 부모 레이아웃 전체에 영향을 주지 않도록 격리
const Header = memo(() => {
    // --- 기존 모든 상태(State) 유지 ---
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [panelRight, setPanelRight] = useState(0);
    const [panelWidth, setPanelWidth] = useState(0);
    const [drawerWidth, setDrawerWidth] = useState(0);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [hasFavorites, setHasFavorites] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false); // 🟢 새로 추가
    const [showComingSoon, setShowComingSoon] = useState<null | string>(null);
    const [showNotiModal, setShowNotiModal] = useState(false);
    const [showKakaoChannelModal, setShowKakaoChannelModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);

    const pathname = usePathname();
    const router = useRouter();
    const menuButtonRef = useRef<HTMLButtonElement | null>(null);
    const drawerRef = useRef<HTMLDivElement | null>(null);

    // 🟢 [찜 목록 요약 가져오기] - 불필요한 상태 업데이트 방지 로직 추가
    const fetchFavoritesSummary = useCallback(async () => {
        try {
            const { authenticatedFetch } = await import("@/lib/authClient");
            // shouldRedirect를 false로 설정하여 배경 요청 실패가 무한 새로고침을 유발하지 않게 함
            const favorites = await authenticatedFetch<any[]>("/api/users/favorites", { cache: "no-store" }, false);
            if (favorites) {
                const newHasFav = Array.isArray(favorites) && favorites.length > 0;
                // 이전 값과 같으면 업데이트를 건너뛰어 리렌더링 차단
                setHasFavorites((prev) => (prev !== newHasFav ? newHasFav : prev));
            }
        } catch (e) {
            console.error("Failed to fetch favorites summary", e);
        }
    }, []);

    // --- 🟢 기능 1: 로그인 세션 체크 (메모이제이션 적용) ---
    const checkLoginStatus = useCallback(async () => {
        const { fetchSession } = await import("@/lib/authClient");
        const session = await fetchSession();
        const isAuth = !!session.authenticated;

        setIsLoggedIn(isAuth);
        if (isAuth) {
            fetchFavoritesSummary();
        } else {
            setHasFavorites(false);
        }
    }, [fetchFavoritesSummary]);

    // --- 🟢 기능 3: 이벤트 리스너 등록 (Auth, Favorites) ---
    useEffect(() => {
        checkLoginStatus();
        const handleAuthChange = () => checkLoginStatus();
        const handleFavoritesChanged = () => fetchFavoritesSummary();

        window.addEventListener("authLoginSuccess", handleAuthChange);
        window.addEventListener("authLogout", handleAuthChange);
        window.addEventListener("favoritesChanged", handleFavoritesChanged);

        return () => {
            window.removeEventListener("authLoginSuccess", handleAuthChange);
            window.removeEventListener("authLogout", handleAuthChange);
            window.removeEventListener("favoritesChanged", handleFavoritesChanged);
        };
    }, [checkLoginStatus, fetchFavoritesSummary]);

    // 🟢 메인 페이지 prefetch (성능 최적화)
    useEffect(() => {
        if (pathname !== "/") {
            router.prefetch("/");
        }
    }, [router, pathname]);

    // --- 🟢 기능 4: 드로어 위치 및 너비 계산 (recomputeAnchor) ---
    const recomputeAnchor = useCallback(() => {
        try {
            const mainEl = document.querySelector("main");
            if (!mainEl) return;
            const rect = mainEl.getBoundingClientRect();
            const rightOffset = Math.max(0, window.innerWidth - rect.right);
            setPanelRight(rightOffset);
            setPanelWidth(rect.width);
            const isMobile = window.innerWidth < 768;
            setDrawerWidth(isMobile ? Math.round(rect.width * 0.5) : Math.min(333, rect.width));
        } catch {}
    }, []);

    useEffect(() => {
        recomputeAnchor();
        window.addEventListener("resize", recomputeAnchor);
        return () => window.removeEventListener("resize", recomputeAnchor);
    }, [pathname, recomputeAnchor]);

    // --- 🟢 기능 5: 메뉴 토글 및 바디 스크롤 제어 ---
    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
    const closeMenu = () => setIsMenuOpen(false);

    useEffect(() => {
        const mainEl = document.querySelector("main") as HTMLElement | null;
        if (!mainEl) return;
        if (isMenuOpen) {
            document.body.style.overflow = "hidden";
            mainEl.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
            mainEl.style.overflow = "";
        }
    }, [isMenuOpen]);

    // --- 🟢 기능 6: 로그아웃 로직 (중복 실행 방지) ---
    const handleLogout = async () => {
        // 🟢 [Fix]: 이미 로그아웃 중이면 중복 실행 방지
        if (isLoggingOut) {
            return;
        }

        setShowLogoutConfirm(false);
        closeMenu();
        setIsLoggingOut(true); // 스플래시 시작

        try {
            await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5초 대기
            const { logout } = await import("@/lib/authClient");
            await logout(); // 내부에서 window.location.replace("/") 실행됨
        } catch (error) {
            console.error("로그아웃 오류:", error);
            setIsLoggingOut(false);
            window.location.replace("/");
        }
    };

    const openLogoutConfirm = () => {
        setIsMenuOpen(false);
        setShowLogoutConfirm(true);
    };

    return (
        <>
            {isLoggingOut && <LogoutSplash />}

            <header className="relative z-50 bg-white dark:bg-[#1a241b] shadow-sm dark:shadow-gray-900/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <Link href="/" prefetch={true} className="flex items-center space-x-2 h-full" onClick={closeMenu}>
                            <span className="text-xl font-bold text-gray-900 dark:text-white leading-none">DoNa</span>
                        </Link>

                        <div className="flex items-center gap-2 h-full">
                            {/* 검색 버튼 */}
                            <button
                                onClick={() => window.dispatchEvent(new Event("openSearchModal"))}
                                className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <Search className="w-6 h-6" />
                            </button>

                            {/* 알림 버튼 (레드도트 포함) */}
                            <button
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    isLoggedIn ? setShowKakaoChannelModal(true) : setShowNotiModal(true);
                                }}
                                className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
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
                                {hasFavorites && (
                                    // 찜 목록이 있을 때만 뱃지 표시
                                    <span className="absolute top-2 right-2.5 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                )}
                            </button>

                            {/* 햄버거 메뉴 버튼 */}
                            <button
                                onClick={toggleMenu}
                                className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
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

                {/* --- 드로어(Drawer) 메뉴 영역 --- */}
                {isMenuOpen && (
                    <>
                        <div
                            className="fixed top-16 bottom-0 z-100 bg-black/30"
                            style={{ right: panelRight, width: panelWidth }}
                            onClick={closeMenu}
                        />
                        <div
                            className="fixed top-16 bottom-0 z-1500 bg-white dark:bg-[#1a241b] border-l border-gray-200 dark:border-gray-800 transform transition-all ease-in-out duration-300 flex flex-col translate-x-0 opacity-100"
                            ref={drawerRef}
                            style={{ right: panelRight, width: drawerWidth }}
                        >
                            <div className="h-full overflow-y-auto flex flex-col">
                                <div className="pl-5 pt-2 pr-5 space-y-2">
                                    <Link
                                        href="/"
                                        prefetch={true}
                                        className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-emerald-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                        onClick={closeMenu}
                                    >
                                        홈
                                    </Link>
                                    <Link
                                        href="/courses"
                                        prefetch={true}
                                        className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-emerald-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                        onClick={closeMenu}
                                    >
                                        완벽한 하루
                                    </Link>
                                    <Link
                                        href="/nearby"
                                        prefetch={true}
                                        className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-emerald-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                        onClick={closeMenu}
                                    >
                                        오늘 뭐하지?
                                    </Link>
                                    <Link
                                        href="/personalized-home"
                                        prefetch={true}
                                        className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-emerald-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                        onClick={closeMenu}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                            <path d="M12 6V2H8"/>
                                            <path d="M15 11v2"/>
                                            <path d="M2 12h2"/>
                                            <path d="M20 12h2"/>
                                            <path d="M20 16a2 2 0 0 1-2 2H8.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 4 20.286V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>
                                            <path d="M9 11v2"/>
                                        </svg>
                                        AI 추천
                                    </Link>
                                    <Link
                                        href="/map"
                                        prefetch={true}
                                        className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-emerald-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                        onClick={closeMenu}
                                    >
                                        지도
                                    </Link>
                                    <button
                                        onClick={() => {
                                            closeMenu();
                                            // 🟢 [SHOP LOCKED]: 두나샵 준비 중 - 토스트 메시지 표시
                                            alert("더 완벽한 키트를 위해 준비 중이에요! 조금만 기다려주세요 🎁");
                                        }}
                                        className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-emerald-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    >
                                        🛍️ 두나샵
                                    </button>
                                    <button
                                        onClick={() => {
                                            closeMenu();
                                            if (isLoggedIn) {
                                                setShowComingSoon("escape");
                                            } else {
                                                setShowLoginModal(true);
                                            }
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                        </svg>
                                        커플 미션 게임
                                    </button>

                                    <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                                        {isLoggedIn ? (
                                            <Link
                                                href="/mypage"
                                                prefetch={true}
                                                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-emerald-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                                onClick={closeMenu}
                                            >
                                                마이페이지
                                            </Link>
                                        ) : (
                                            <>
                                                <Link
                                                    href="/login?next=/"
                                                    prefetch={true}
                                                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-emerald-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                                    onClick={closeMenu}
                                                >
                                                    로그인
                                                </Link>
                                                <Link
                                                    href="/signup"
                                                    prefetch={true}
                                                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-emerald-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                                    onClick={closeMenu}
                                                >
                                                    회원가입
                                                </Link>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* 드로어 하단 링크 */}
                                <div className="mt-auto px-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a241b]">
                                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 pb-6 pt-4">
                                        <Link
                                            href="/about"
                                            prefetch={true}
                                            onClick={closeMenu}
                                            className="text-center py-1 text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                        >
                                            <span className="text-xs font-medium">서비스 소개</span>
                                        </Link>
                                        <Link
                                            href="/help"
                                            prefetch={true}
                                            onClick={closeMenu}
                                            className="text-center py-1 text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                        >
                                            <span className="text-xs font-medium">이용 안내</span>
                                        </Link>
                                        <Link
                                            href="/privacy"
                                            prefetch={true}
                                            onClick={closeMenu}
                                            className="text-center py-1 text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                        >
                                            <span className="text-xs font-medium">개인정보처리방침</span>
                                        </Link>
                                        <Link
                                            href="/terms"
                                            prefetch={true}
                                            onClick={closeMenu}
                                            className="text-center py-1 text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                        >
                                            <span className="text-xs font-medium">이용약관</span>
                                        </Link>
                                    </div>
                                    <div className="pb-6 text-center">
                                        <p className="text-[10px] text-gray-300 font-medium">
                                            버전 1.1.0 | © 2026 DoNa Team
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </header>

            {/* 모든 모달들 */}
            {showLogoutConfirm && <LogoutModal onClose={() => setShowLogoutConfirm(false)} onConfirm={handleLogout} />}
            {showComingSoon && <ComingSoonModal onClose={() => setShowComingSoon(null)} />}
            {!isLoggedIn && showNotiModal && <NotificationModal onClose={() => setShowNotiModal(false)} />}
            {isLoggedIn && showKakaoChannelModal && (
                <KakaoChannelModal onClose={() => setShowKakaoChannelModal(false)} />
            )}
            {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} next={pathname} />}
        </>
    );
});

Header.displayName = "Header"; // memo 사용 시 디버깅을 위한 이름 설정

export default Header;
