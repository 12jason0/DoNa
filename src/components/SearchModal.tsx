"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, X, TrendingUp, History } from "lucide-react";
import { useAppLayout, ANDROID_MODAL_BOTTOM } from "@/context/AppLayoutContext";
import { useLocale } from "@/context/LocaleContext";
import { useNativeModalNotify } from "@/hooks/useNativeModalNotify";
import { CATEGORY_ICONS, CONCEPTS } from "@/constants/onboardingData";

type SearchHistoryItem = { id: string; keyword: string; createdAt: string };

// [추천 태그 - label은 t()로 번역]
const RECOMMEND_TAGS = [
    { id: "COST_EFFECTIVE", labelKey: "search.tagCostEffective" },
    { id: "EMOTIONAL", labelKey: "search.tagEmotional" },
    { id: "PHOTO", labelKey: "search.tagPhoto" },
    { id: "HEALING", labelKey: "search.tagHealing" },
] as const;

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
    const { containInPhone, modalContainerRef, isAndroidApp } = useAppLayout();
    const { t, isLocaleReady } = useLocale();
    const [query, setQuery] = useState("");
    const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
    const [isSearchHistoryEnabled, setIsSearchHistoryEnabled] = useState(true);
    const [showDisableConfirm, setShowDisableConfirm] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const fetchSearchHistory = useCallback(async () => {
        try {
            const res = await fetch("/api/search-history", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setSearchHistory(data);
                    setIsSearchHistoryEnabled(true);
                } else if (data && typeof data.list !== "undefined") {
                    setSearchHistory(Array.isArray(data.list) ? data.list : []);
                    setIsSearchHistoryEnabled(data.isSearchHistoryEnabled !== false);
                } else {
                    setSearchHistory([]);
                }
            }
        } catch {
            setSearchHistory([]);
        }
    }, []);

    // 모달이 열릴 때 input 포커스, 스크롤 방지, 검색 기록 로드
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            fetchSearchHistory();
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen, fetchSearchHistory]);

    const handleSearch = async (keyword: string) => {
        const trimmed = keyword.trim();
        if (!trimmed) return;
        inputRef.current?.blur();
        const sp = new URLSearchParams();
        sp.set("q", trimmed);
        router.prefetch(`/nearby?${sp.toString()}`);
        router.push(`/nearby?${sp.toString()}`);
        setQuery("");
        onClose();
        // 검색 기록 저장 (비동기, 실패해도 무시)
        try {
            await fetch("/api/search-history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ keyword: trimmed }),
                credentials: "include",
            });
        } catch {}
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSearch(query);
        }
    };

    const handleDeleteHistoryItem = useCallback(async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        e.preventDefault();
        try {
            const res = await fetch(`/api/search-history?id=${encodeURIComponent(id)}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (res.ok) {
                setSearchHistory((prev) => prev.filter((h) => h.id !== id));
            }
        } catch {}
    }, []);

    const handleDisableSearchHistory = useCallback(() => {
        setShowDisableConfirm(true);
    }, []);

    const handleConfirmDisableSearchHistory = useCallback(async () => {
        try {
            await fetch("/api/search-history", { method: "DELETE", credentials: "include" });
            const res = await fetch("/api/search-history", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isSearchHistoryEnabled: false }),
                credentials: "include",
            });
            if (res.ok) {
                setSearchHistory([]);
                setIsSearchHistoryEnabled(false);
                setShowDisableConfirm(false);
            }
        } catch {
            setShowDisableConfirm(false);
        }
    }, []);

    const handleEnableSearchHistory = useCallback(async () => {
        try {
            const res = await fetch("/api/search-history", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isSearchHistoryEnabled: true }),
                credentials: "include",
            });
            if (res.ok) setIsSearchHistoryEnabled(true);
        } catch {}
    }, []);

    useNativeModalNotify(isOpen);

    if (!isOpen) return null;

    const posClass = containInPhone ? "absolute" : "fixed";
    const modalContent = (
        <div
            className={`${posClass} inset-0 z-9999 bg-black/50 dark:bg-black/60 flex items-start justify-center`}
            style={containInPhone ? { width: "100%", height: "100%" } : undefined}
            onClick={onClose}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            aria-label={t("header.closeSearchModal")}
        >
            <div
                className={`${posClass} left-0 right-0 z-10000 flex flex-col rounded-t-2xl bg-white dark:bg-[#0f1710] shadow-xl overflow-hidden pb-10 ${!isAndroidApp ? "bottom-3" : ""}`}
                style={{
                    top: containInPhone ? "4.5rem" : "calc(env(safe-area-inset-top, 0px) + 4.5rem)",
                    ...(containInPhone ? { width: "100%", height: "calc(100% - 4.5rem)" } : {}),
                    ...(isAndroidApp ? { bottom: ANDROID_MODAL_BOTTOM } : {}),
                    animation: "slideUp 0.3s ease-out forwards",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {!isLocaleReady ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
                    </div>
                ) : (
                    <>
                        {/* 1. 헤더: 검색 + 닫기(X) */}
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-lg font-semibold text-gray-900 dark:text-white">
                                {t("header.search")}
                            </span>
                            <button
                                onClick={onClose}
                                className="p-2 -mr-2 text-gray-600 dark:text-gray-400"
                                aria-label={t("common.close")}
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* 2. 검색창 (아래로 내림) */}
                        <div className="px-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-full flex items-center px-4 py-2.5">
                                <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
                                <input
                                    ref={inputRef}
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={t("search.placeholder")}
                                    className="flex-1 bg-transparent text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
                                />
                                {query && (
                                    <button onClick={() => setQuery("")} className="ml-2">
                                        <X className="w-4 h-4 text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 rounded-full p-0.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 3. 검색 컨텐츠 영역 - 웹/앱 공통 하단 여백(pb-8), Android는 safe-area 추가 */}
                        <div
                            className="flex-1 overflow-hidden px-5 pt-6 pb-8"
                            style={
                                isAndroidApp
                                    ? { paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }
                                    : undefined
                            }
                        >
                            {/* 검색 기록: 최근 검색어(왼쪽) / 검색 기록 안 남기기 or 다시 남기기(오른쪽) */}
                            {(searchHistory.length > 0 || !isSearchHistoryEnabled) && (
                                <section className="mb-8">
                                    <div className="flex items-center justify-between gap-2 mb-4">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                            <History className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                            {t("search.recentSearches")}
                                        </h3>
                                        {isSearchHistoryEnabled ? (
                                            <button
                                                type="button"
                                                onClick={handleDisableSearchHistory}
                                                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline shrink-0"
                                            >
                                                {t("search.disableHistory")}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleEnableSearchHistory}
                                                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                                            >
                                                {t("search.enableHistory")}
                                            </button>
                                        )}
                                    </div>
                                    {searchHistory.length > 0 && (
                                        <div className="flex gap-1 overflow-x-auto overflow-y-hidden pb-1 -mx-5 px-5 scrollbar-hide shrink-0">
                                            {searchHistory.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="inline-flex items-center gap-0 pr-0.5 py-0.5 pl-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full group hover:border-emerald-500 dark:hover:border-emerald-500 shrink-0"
                                                >
                                                    <button
                                                        type="button"
                                                        onMouseEnter={() => {
                                                            const sp = new URLSearchParams();
                                                            sp.set("q", item.keyword);
                                                            router.prefetch(`/nearby?${sp.toString()}`);
                                                        }}
                                                        onClick={() => handleSearch(item.keyword)}
                                                        className="text-xs text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap pr-0.5"
                                                    >
                                                        {item.keyword}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                                                        className="p-0.5 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                                        aria-label={t("search.deleteItem")}
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* 검색 기록 안 남기기 확인 모달 (하단 고정, 아래→위 슬라이드) */}
                            {showDisableConfirm && (
                                <div
                                    className={`${posClass} inset-0 z-10001 flex items-end justify-center bg-black/50`}
                                    style={containInPhone ? { width: "100%", height: "100%" } : undefined}
                                    onClick={() => setShowDisableConfirm(false)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === "Escape" && setShowDisableConfirm(false)}
                                    aria-label={t("common.close")}
                                >
                                    <div
                                        className="bg-white dark:bg-[#1a241b] rounded-t-2xl shadow-xl w-full max-w-md p-6 pb-8"
                                        style={{ animation: "slideUp 0.3s ease-out forwards" }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <p className="text-center text-gray-900 dark:text-white font-medium mb-2">
                                            {t("search.disableConfirmTitle")}
                                        </p>
                                        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6">
                                            {t("search.disableConfirmDesc")}
                                        </p>
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setShowDisableConfirm(false)}
                                                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium"
                                            >
                                                {t("search.keep")}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleConfirmDisableSearchHistory}
                                                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-medium"
                                            >
                                                {t("search.confirmDisable")}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* A. 인기 검색어 */}
                            <section className="mb-8">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-1.5">
                                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                                    {t("search.popularTitle")}
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {([0, 1, 2, 3, 4] as const).map((index) => {
                                        const keyword = t(`search.popularKeyword${index}` as "search.popularKeyword0");
                                        return (
                                            <button
                                                key={index}
                                                onMouseEnter={() => {
                                                    const sp = new URLSearchParams();
                                                    sp.set("q", keyword);
                                                    router.prefetch(`/nearby?${sp.toString()}`);
                                                }}
                                                onClick={() => handleSearch(keyword)}
                                                className="px-4 py-2 bg-white dark:bg-[#1a241b] border border-gray-200 dark:border-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300 hover:border-emerald-500 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shadow-sm"
                                            >
                                                {keyword}
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* B. 추천 테마 (아이콘 포함) */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
                                    {t("search.suggestedThemes")}
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {RECOMMEND_TAGS.map((tag) => {
                                        const label = t(tag.labelKey);
                                        return (
                                            <button
                                                key={tag.id}
                                                onMouseEnter={() => {
                                                    const sp = new URLSearchParams();
                                                    sp.set("q", label);
                                                    router.prefetch(`/nearby?${sp.toString()}`);
                                                }}
                                                onClick={() => handleSearch(label)}
                                                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-white dark:bg-[#1a241b] flex items-center justify-center text-xl shadow-sm">
                                                    <img
                                                        src={
                                                            CATEGORY_ICONS[
                                                                CONCEPTS[tag.id as keyof typeof CONCEPTS] || label
                                                            ] || CATEGORY_ICONS[CONCEPTS.UNIQUE]
                                                        }
                                                        alt={label}
                                                        className="w-8 h-8 object-contain"
                                                    />
                                                </div>
                                                <span className="text-sm font-medium text-gray-800 dark:text-white">
                                                    {label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    const portalTarget = (containInPhone && modalContainerRef?.current) || document.body;
    return createPortal(modalContent, portalTarget);
}
