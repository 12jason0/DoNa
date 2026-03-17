// 🟢 [Performance]: 카테고리 필터 모달을 별도 컴포넌트로 분리
"use client";

import React from "react";
import { useLocale } from "@/context/LocaleContext";
import { useAppLayout } from "@/context/AppLayoutContext";
import { useNativeModalNotify } from "@/hooks/useNativeModalNotify";
import { translateCourseConcept } from "@/lib/courseTranslate";

const LABEL_KEYS: Record<
    string,
    | "categoryFilterModal.concept"
    | "categoryFilterModal.vibe"
    | "categoryFilterModal.context"
    | "categoryFilterModal.condition"
> = {
    CONCEPT: "categoryFilterModal.concept",
    MOOD: "categoryFilterModal.vibe",
    TARGET: "categoryFilterModal.context",
    CONDITION: "categoryFilterModal.condition",
};

// 컨셉(11) / 분위기(8) / 상황(7) / 조건(4) - Admin과 계산 로직은 건드리지 않음
const TAG_CATEGORIES: Record<string, { tags: string[] }> = {
    CONCEPT: {
        tags: [
            "이색데이트",
            "감성데이트",
            "야경",
            "힐링",
            "가성비",
            "인생샷",
            "맛집탐방",
            "카페투어",
            "술자리",
            "실내데이트",
            "공연·전시",
        ],
    },
    MOOD: {
        tags: ["로맨틱", "힙한", "활기찬", "레트로", "고급스러운", "감성", "조용한", "이국적인"],
    },
    TARGET: {
        tags: ["연인", "썸", "친구", "가족", "혼자", "기념일", "소개팅"],
    },
    CONDITION: {
        tags: ["실내", "야외", "비오는날", "야경"],
    },
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
    const { isAndroidApp } = useAppLayout();
    useNativeModalNotify(isOpen);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-9999 bg-black/60 flex items-end justify-center p-0 animate-in fade-in duration-200"
            onClick={onClose}
            role="presentation"
        >
            <div
                className={`w-full flex items-end ${isAndroidApp ? "mb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]" : ""}`}
            >
                <div
                    className="bg-white dark:bg-[#1a241b] w-full max-w-[480px] mx-auto rounded-t-xl border border-gray-100 dark:border-gray-800 relative flex flex-col max-h-[75vh] animate-slide-up"
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
                            <h3 className="text-[19px] font-bold text-gray-900 dark:text-white">
                                {t("categoryFilterModal.title")}
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            {/* course_tags 테이블의 태그를 카테고리별로 표시 */}
                            {Object.entries(TAG_CATEGORIES).map(([key, category]) => {
                                // 항상 TAG_CATEGORIES 전체 표시 (DB allTags와 무관)
                                const displayTags = category.tags.map((name) => ({ id: 0, name }));

                                return (
                                    <div key={key}>
                                        <div className="text-[15px] font-bold mb-3 text-gray-900 dark:text-white">
                                            {t(LABEL_KEYS[key] ?? "categoryFilterModal.concept")}
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
                        <div className="p-5 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a241b]">
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
        </div>
    );
}
