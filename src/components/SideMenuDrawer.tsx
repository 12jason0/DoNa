// src/components/SideMenuDrawer.tsx
// Footer 위 + 버튼으로 열리는 사이드 메뉴 (Header에서 분리)

"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/context/LocaleContext";
import { useAppLayout } from "@/context/AppLayoutContext";
import ComingSoonModal from "@/components/ComingSoonModal";
import LoginModal from "@/components/LoginModal";
import ShopModal from "@/components/ShopModal";

interface SideMenuDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    /** 뷰포트 하단으로부터의 거리(px). 드로어 하단을 이 위치에 맞춰 + 버튼 위에서 올라오게 함 */
    anchorBottom?: number;
    /** 웹에서 폰 목업 내부에만 모달이 표시되도록 함 (absolute 포지셔닝, 포탈 미사용) */
    containInPhone?: boolean;
}

export default function SideMenuDrawer({
    isOpen,
    onClose,
    anchorBottom = 0,
    containInPhone = false,
}: SideMenuDrawerProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { t } = useLocale();
    const { modalContainerRef } = useAppLayout();
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
                    createPortal(
                        <LoginModal onClose={() => setShowLoginModal(false)} next={pathname} />,
                        document.body,
                    )}
            </>
        );
    }

    const posClass = containInPhone ? "absolute" : "fixed";
    const overlayAndPanel = (
        <>
            {/* 클릭 시 뒤 배경 흐림. 클릭하면 닫힘 - Footer 포함 모든 콘텐츠 클릭 방지 */}
            <div
                className={`${posClass} inset-0 z-99999 bg-white/65 backdrop-blur-xl backdrop-saturate-150 transition-opacity duration-200 cursor-pointer`}
                style={{
                    width: "100vw",
                    height: "100dvh",
                    minWidth: "100vw",
                    minHeight: "100dvh",
                    WebkitBackdropFilter: "blur(24px) saturate(150%)",
                    backdropFilter: "blur(24px) saturate(150%)",
                    pointerEvents: "auto",
                    touchAction: "none",
                }}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose();
                }}
                onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.button === 0) onClose();
                }}
                onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose();
                }}
                aria-hidden="true"
            />
            {/* 패널: 연한 베이지/화이트 톤, 아이콘별 뮤트 컬러 */}
            <div
                className={`${posClass} right-0 z-100000 w-[min(300px,80vw)] max-h-[80vh] flex flex-col bg-transparent pointer-events-none`}
                style={{ bottom: anchorBottom }}
                role="dialog"
                aria-label="사이드 메뉴"
            >
                <div className="flex-1 min-h-0 overflow-y-auto flex flex-col-reverse py-3 pointer-events-auto">
                    <nav className="px-3 space-y-0.5 flex flex-col-reverse items-end" aria-label="사이드 메뉴">
                        <Link
                            href="/nearby"
                            prefetch={true}
                            className="flex flex-row-reverse items-center justify-end gap-2.5 px-3 w-fit ml-auto py-2.5 rounded-lg text-sm font-medium text-lime-700 hover:bg-lime-50/80 transition-colors dark:text-lime-400 dark:hover:bg-lime-900/20"
                            onClick={onClose}
                        >
                            <span
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-100 text-lime-700 transition-all duration-200 ease-out dark:bg-lime-900/40 dark:text-lime-400 ${
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
                                {t("nav.whatToDoToday")}
                            </span>
                        </Link>
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                setShowComingSoon("escape");
                            }}
                            className="flex flex-row-reverse items-center justify-end gap-2.5 px-3 w-fit ml-auto py-2.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50/80 transition-colors dark:text-blue-400 dark:hover:bg-blue-900/20"
                        >
                            <span
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 transition-all duration-200 ease-out dark:bg-blue-900/40 dark:text-blue-400 ${
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
                                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                                    <line x1="4" x2="4" y1="22" y2="15" />
                                </svg>
                            </span>
                            <span
                                className={`transition-all duration-200 ease-out ${
                                    animateUp ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                                }`}
                                style={{ transitionDelay: "60ms" }}
                            >
                                {t("nav.coupleMissionGame")}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                setShowShopModal(true);
                            }}
                            className="flex flex-row-reverse items-center justify-end gap-2.5 w-fit ml-auto px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-600 hover:bg-emerald-50/80 transition-colors dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                        >
                            <span
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 transition-all duration-200 ease-out dark:bg-emerald-900/40 dark:text-emerald-400 ${
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
                                {t("nav.donaShop")}
                            </span>
                        </button>
                        <div className="pt-2 mt-1">
                            {isAuthenticated ? (
                                <Link
                                    href="/mypage"
                                    prefetch={true}
                                    onMouseEnter={() => router.prefetch("/mypage")}
                                    onFocus={() => router.prefetch("/mypage")}
                                    className="flex flex-row-reverse items-center justify-end gap-2.5 px-3 w-fit ml-auto py-2.5 rounded-lg text-sm font-medium text-gray-800 hover:bg-slate-100/80 transition-colors dark:text-gray-200 dark:hover:bg-slate-800/30"
                                    onClick={onClose}
                                >
                                    <span
                                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 text-white transition-all duration-200 ease-out dark:bg-slate-600 ${
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
                                        {t("nav.myPage")}
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
                                        className="flex flex-row-reverse items-center justify-end gap-2.5 w-fit ml-auto px-3 py-2.5 rounded-lg text-sm font-medium text-gray-800 hover:bg-slate-100/80 transition-colors dark:text-gray-200 dark:hover:bg-slate-800/30"
                                    >
                                        <span
                                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 text-white transition-all duration-200 ease-out dark:bg-slate-600 ${
                                                animateUp ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                                            }`}
                                            style={{ transitionDelay: "120ms" }}
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
                                            {t("nav.login")}
                                        </span>
                                    </button>
                                    <Link
                                        href="/signup"
                                        prefetch={true}
                                        className="flex flex-row-reverse items-center justify-end gap-2.5 px-3 w-fit ml-auto py-2.5 rounded-lg text-sm font-medium text-sky-600 hover:bg-sky-50/80 transition-colors mt-0.5 dark:text-sky-400 dark:hover:bg-sky-900/20"
                                        onClick={onClose}
                                    >
                                        <span
                                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600 transition-all duration-200 ease-out dark:bg-sky-900/40 dark:text-sky-400 ${
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
                                            {t("nav.signup")}
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

    if (containInPhone) {
        return overlayAndPanel;
    }
    if (typeof document !== "undefined") {
        // 🟢 항상 body에 포탈 → Footer 등 다른 fixed 요소(z-40)보다 위에 오버레이 표시
        return createPortal(overlayAndPanel, document.body);
    }
    return overlayAndPanel;
}
