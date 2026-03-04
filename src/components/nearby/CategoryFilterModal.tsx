// 🟢 [Performance]: 카테고리 필터 모달을 별도 컴포넌트로 분리
"use client";

import React from "react";
import { useLocale } from "@/context/LocaleContext";
import { translateCourseConcept } from "@/lib/courseTranslate";
import { isAndroid, isMobileApp } from "@/lib/platform";

const LABEL_KEYS: Record<
    string,
    "categoryFilterModal.activity" | "categoryFilterModal.vibe" | "categoryFilterModal.context" | "categoryFilterModal.condition"
> = {
    MANDATORY: "categoryFilterModal.activity",
    VIBE: "categoryFilterModal.vibe",
    CONTEXT: "categoryFilterModal.context",
    CONDITION: "categoryFilterModal.condition",
};

// tags: DB/course_tags와 매칭용 한국어 키. 표시는 translateCourseConcept으로 번역됨
const TAG_CATEGORIES: Record<string, { tags: string[] }> = {
    MANDATORY: { tags: ["맛집탐방", "카페투어", "주점", "액티비티", "전시관람"] },
    VIBE: { tags: ["힙스터", "감성", "로맨틱", "인생샷", "핫플", "신상"] },
    CONTEXT: { tags: ["데이트", "기념일", "가성비", "친구", "혼자"] },
    CONDITION: { tags: ["실내", "야외", "야경", "비오는날"] },
};

interface CategoryFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    allTags: Array<{ id: number; name: string }>;
    modalSelectedLabels: string[];
    onCategoryClick: (label: string) => void;
    onApply: () => void;
    onReset: () => void;
}

export default function CategoryFilterModal({
    isOpen,
    onClose,
    allTags,
    modalSelectedLabels,
    onCategoryClick,
    onApply,
    onReset,
}: CategoryFilterModalProps) {
    const { t, isLocaleReady } = useLocale();
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-9999 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-5 animate-in fade-in duration-200"
            style={
                typeof window !== "undefined" && isMobileApp() && isAndroid()
                    ? { paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }
                    : undefined
            }
            onClick={onClose}
            role="presentation"
        >
            <div
                className="bg-white dark:bg-[#1a241b] w-full sm:max-w-[480px] rounded-t-xl sm:rounded-xl border border-gray-100 dark:border-gray-800 relative flex flex-col max-h-[85vh] animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {!isLocaleReady ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
                    </div>
                ) : (
                <>
                <div className="pt-3 pb-4 px-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4" />
                    <h3 className="text-[19px] font-bold text-gray-900 dark:text-white">{t("categoryFilterModal.title")}</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* course_tags 테이블의 태그를 카테고리별로 표시 */}
                    {Object.entries(TAG_CATEGORIES).map(([key, category]) => {
                        // allTags에서 해당 카테고리에 속하는 태그만 필터링
                        const categoryTags = allTags.filter((tag) => category.tags.includes(tag.name));

                        // allTags에 없는 경우 하드코딩된 태그 사용 (fallback)
                        const displayTags =
                            categoryTags.length > 0 ? categoryTags : category.tags.map((name) => ({ id: 0, name }));

                        return (
                            <div key={key}>
                                <div className="text-[15px] font-bold mb-3 text-gray-900 dark:text-white">
                                    {t(LABEL_KEYS[key] ?? "categoryFilterModal.activity")}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {displayTags.map((tag) => {
                                        const tagName = typeof tag === "string" ? tag : tag.name;
                                        const isSelected = modalSelectedLabels.includes(tagName);

                                        return (
                                            <button
                                                key={tagName}
                                                onClick={() => onCategoryClick(tagName)}
                                                className={`px-3.5 py-2.5 rounded-lg text-[14px] border transition-colors ${
                                                    isSelected
                                                        ? "bg-emerald-600 text-white border-emerald-600"
                                                        : "bg-white dark:bg-[#0f1710] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                                                }`}
                                            >
                                                {translateCourseConcept(tagName, t as (k: string) => string)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div
                    className={`p-5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a241b] ${
                        typeof window !== "undefined" && isMobileApp() && isAndroid()
                            ? "pb-[calc(1.25rem+64px+env(safe-area-inset-bottom))]"
                            : ""
                    }`}
                >
                    <div className="flex gap-3">
                        <button
                            onClick={onReset}
                            className="flex-1 py-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold"
                        >
                            {t("categoryFilterModal.reset")}
                        </button>
                        <button
                            onClick={onApply}
                            className="flex-[2.5] py-4 rounded-lg bg-slate-900 dark:bg-slate-800 text-white font-bold"
                        >
                            {t("categoryFilterModal.apply")}
                        </button>
                    </div>
                </div>
                </>
                )}
            </div>
        </div>
    );
}
