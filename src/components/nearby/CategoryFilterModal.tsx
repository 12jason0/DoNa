// 🟢 [Performance]: 카테고리 필터 모달을 별도 컴포넌트로 분리
"use client";

import React from "react";

const TAG_CATEGORIES = {
    MANDATORY: {
        label: "활동",
        tags: ["맛집투어", "카페투어", "주점", "액티비티", "전시관람"] as string[],
    },
    VIBE: {
        label: "분위기",
        tags: ["힙스터", "감성", "로맨틱", "인생샷", "핫플", "신상"] as string[],
    },
    CONTEXT: {
        label: "상황",
        tags: ["데이트", "기념일", "가성비", "친구", "혼자"] as string[],
    },
    CONDITION: {
        label: "조건",
        tags: ["실내", "야외", "야경", "비오는날"] as string[],
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
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-5 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white w-full sm:max-w-[480px] rounded-t-xl sm:rounded-xl border border-gray-100 relative flex flex-col max-h-[85vh] animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="pt-3 pb-4 px-6 border-b border-gray-100 flex-shrink-0">
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />
                    <h3 className="text-[19px] font-bold text-gray-900">필터 설정</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* course_tags 테이블의 태그를 카테고리별로 표시 */}
                    {Object.entries(TAG_CATEGORIES).map(([key, category]) => {
                        // allTags에서 해당 카테고리에 속하는 태그만 필터링
                        const categoryTags = allTags.filter((tag) => category.tags.includes(tag.name));

                        // allTags에 없는 경우 하드코딩된 태그 사용 (fallback)
                        const displayTags =
                            categoryTags.length > 0
                                ? categoryTags
                                : category.tags.map((name) => ({ id: 0, name }));

                        return (
                            <div key={key}>
                                <div className="text-[15px] font-bold mb-3 text-gray-900">
                                    {category.label} <span className="text-[12px] font-normal text-gray-500">({key})</span>
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
                                                        : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50"
                                                }`}
                                            >
                                                {tagName}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="p-5 border-t border-gray-100 bg-white">
                    <div className="flex gap-3">
                        <button
                            onClick={onReset}
                            className="flex-1 py-4 rounded-lg bg-gray-100 text-gray-500 font-bold"
                        >
                            초기화
                        </button>
                        <button
                            onClick={onApply}
                            className="flex-[2.5] py-4 rounded-lg bg-slate-900 text-white font-bold"
                        >
                            적용하기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

