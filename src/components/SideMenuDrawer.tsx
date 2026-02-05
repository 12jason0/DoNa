// src/components/SideMenuDrawer.tsx
// Footer 위 + 버튼으로 열리는 사이드 메뉴 (Header에서 분리)

"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ComingSoonModal from "@/components/ComingSoonModal";
import LoginModal from "@/components/LoginModal";
import ShopModal from "@/components/ShopModal";

interface SideMenuDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    /** 뷰포트 하단으로부터의 거리(px). 드로어 하단을 이 위치에 맞춰 + 버튼 위에서 올라오게 함 */
    anchorBottom?: number;
}

export default function SideMenuDrawer({ isOpen, onClose, anchorBottom = 0 }: SideMenuDrawerProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const [showComingSoon, setShowComingSoon] = useState<null | string>(null);
    const [showShopModal, setShowShopModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [animateUp, setAnimateUp] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        document.body.style.overflow = "hidden";
        const mainEl = document.querySelector("main") as HTMLElement | null;
        if (mainEl) mainEl.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
            const el = document.querySelector("main") as HTMLElement | null;
            if (el) el.style.overflow = "";
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setAnimateUp(false);
            const id = requestAnimationFrame(() => {
                requestAnimationFrame(() => setAnimateUp(true));
            });
            return () => cancelAnimationFrame(id);
        } else {
            setAnimateUp(false);
        }
    }, [isOpen]);

    // 🟢 드로어가 닫혀 있어도 모달(두나샵, Escape, 로그인)은 body 포탈로 렌더해 바로 표시
    if (!isOpen) {
        return (
            <>
                {showShopModal &&
                    typeof document !== "undefined" &&
                    createPortal(<ShopModal onClose={() => setShowShopModal(false)} />, document.body)}
                {showComingSoon &&
                    typeof document !== "undefined" &&
                    createPortal(<ComingSoonModal onClose={() => setShowComingSoon(null)} />, document.body)}
                {showLoginModal &&
                    typeof document !== "undefined" &&
                    createPortal(<LoginModal onClose={() => setShowLoginModal(false)} next={pathname} />, document.body)}
            </>
        );
    }

    const overlayAndPanel = (
        <>
            {/* 클릭 시 뒤는 블러 처리 (body 포탈로 헤더 포함 전체 화면 확실히 덮음) */}
            <div
                className="fixed inset-0 z-1999 bg-white/55 dark:bg-black/45 backdrop-blur-lg transition-opacity duration-200"
                style={{ top: 0, left: 0, right: 0, bottom: 0 }}
                onClick={onClose}
                aria-hidden="true"
            />
            {/* 패널은 고정, 글씨만 올라오는 애니메이션 */}
            <div
                className="fixed right-0 z-2001 w-[min(300px,80vw)] max-h-[80vh] flex flex-col bg-transparent pointer-events-none"
                style={{ bottom: anchorBottom }}
                role="dialog"
                aria-label="사이드 메뉴"
            >
                <div className="flex-1 min-h-0 overflow-y-auto flex flex-col-reverse py-3 pointer-events-auto">
                    <nav className="px-3 space-y-0.5 flex flex-col-reverse items-end" aria-label="사이드 메뉴">
                        <Link
                            href="/nearby"
                            prefetch={true}
                            className="flex flex-row-reverse items-center justify-end gap-2.5 px-3 w-fit ml-auto py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
                            onClick={onClose}
                        >
                            <span
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 transition-all duration-200 ease-out ${
                                    animateUp ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                                }`}
                                style={{ transitionDelay: "40ms" }}
                            >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                    />
                                </svg>
                            </span>
                            <span
                                className={`transition-all duration-200 ease-out ${
                                    animateUp ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                                }`}
                                style={{ transitionDelay: "40ms" }}
                            >
                                오늘 뭐하지?
                            </span>
                        </Link>
                        <Link
                            href="/personalized-home"
                            prefetch={true}
                            className="flex flex-row-reverse items-center justify-end gap-2.5 px-3 w-fit ml-auto py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
                            onClick={onClose}
                        >
                            <span
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 transition-all duration-200 ease-out ${
                                    animateUp ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                                }`}
                                style={{ transitionDelay: "60ms" }}
                            >
                                <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M12 6V2H8" />
                                    <path d="M15 11v2" />
                                    <path d="M2 12h2" />
                                    <path d="M20 12h2" />
                                    <path d="M20 16a2 2 0 0 1-2 2H8.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 4 20.286V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
                                    <path d="M9 11v2" />
                                </svg>
                            </span>
                            <span
                                className={`transition-all duration-200 ease-out ${
                                    animateUp ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                                }`}
                                style={{ transitionDelay: "60ms" }}
                            >
                                AI 추천
                            </span>
                        </Link>
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                setShowShopModal(true);
                            }}
                            className="flex flex-row-reverse items-center justify-end gap-2.5 w-fit ml-auto px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
                        >
                            <span
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 transition-all duration-200 ease-out ${
                                    animateUp ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                                }`}
                                style={{ transitionDelay: "200ms" }}
                            >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                                    />
                                </svg>
                            </span>
                            <span
                                className={`transition-all duration-200 ease-out ${
                                    animateUp ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                                }`}
                                style={{ transitionDelay: "200ms" }}
                            >
                                두나샵
                            </span>
                        </button>
                        <div className="pt-4 mt-4 border-t border-gray-200/80 dark:border-gray-700/80">
                            {isAuthenticated ? (
                                <Link
                                    href="/mypage"
                                    prefetch={true}
                                    onMouseEnter={() => router.prefetch("/mypage")}
                                    onFocus={() => router.prefetch("/mypage")}
                                    className="flex flex-row-reverse items-center justify-end gap-2.5 px-3 w-fit ml-auto py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
                                    onClick={onClose}
                                >
                                    <span
                                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 transition-all duration-200 ease-out ${
                                            animateUp ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                                        }`}
                                        style={{ transitionDelay: "120ms" }}
                                    >
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                            />
                                        </svg>
                                    </span>
                                    <span
                                        className={`transition-all duration-200 ease-out ${
                                            animateUp ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                                        }`}
                                        style={{ transitionDelay: "120ms" }}
                                    >
                                        마이페이지
                                    </span>
                                </Link>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            setShowLoginModal(true);
                                        }}
                                        className="flex flex-row-reverse items-center justify-end gap-2.5 w-fit ml-auto px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
                                    >
                                        <span
                                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 transition-all duration-200 ease-out ${
                                                animateUp ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                                            }`}
                                            style={{ transitionDelay: "120ms" }}
                                        >
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3v-1"
                                                />
                                            </svg>
                                        </span>
                                        <span
                                            className={`transition-all duration-200 ease-out ${
                                                animateUp ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                                            }`}
                                            style={{ transitionDelay: "120ms" }}
                                        >
                                            로그인
                                        </span>
                                    </button>
                                    <Link
                                        href="/signup"
                                        prefetch={true}
                                        className="flex flex-row-reverse items-center justify-end gap-2.5 px-3 w-fit ml-auto py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors mt-0.5"
                                        onClick={onClose}
                                    >
                                        <span
                                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 transition-all duration-200 ease-out ${
                                                animateUp ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                                            }`}
                                            style={{ transitionDelay: "160ms" }}
                                        >
                                            <svg
                                                className="h-5 w-5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                                                />
                                            </svg>
                                        </span>
                                        <span
                                            className={`transition-all duration-200 ease-out ${
                                                animateUp ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                                            }`}
                                            style={{ transitionDelay: "160ms" }}
                                        >
                                            회원가입
                                        </span>
                                    </Link>
                                </>
                            )}
                        </div>
                    </nav>
                </div>
            </div>

            {showComingSoon && <ComingSoonModal onClose={() => setShowComingSoon(null)} />}
            {showShopModal && <ShopModal onClose={() => setShowShopModal(false)} />}
            {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} next={pathname} />}
        </>
    );

    if (typeof document !== "undefined") {
        return createPortal(overlayAndPanel, document.body);
    }
    return overlayAndPanel;
}
