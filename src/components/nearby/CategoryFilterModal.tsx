// 🟢 [Performance]: 카테고리 필터 모달을 별도 컴포넌트로 분리
"use client";

import React, { useMemo } from "react";
import { useNativeModalNotify } from "@/hooks/useNativeModalNotify";

// 컨셉(11) / 분위기(8) / 상황(7) / 조건(4)
const TAG_CATEGORIES: Record<string, { label: string; tags: string[] }> = {
    CONCEPT: {
        label: "컨셉",
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
        label: "분위기",
        tags: ["로맨틱", "힙한", "활기찬", "레트로", "고급스러운", "감성", "조용한", "이국적인"],
    },
    TARGET: {
        label: "상황",
        tags: ["연인", "썸", "친구", "가족", "혼자", "기념일", "소개팅"],
    },
    CONDITION: {
        label: "조건",
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
    useNativeModalNotify(isOpen);

    // allTags를 이름 → id 맵으로 변환
    const tagNameToId = useMemo(() => {
        const map = new Map<string, number>();
        allTags.forEach((t) => map.set(t.name, t.id));
        return map;
    }, [allTags]);

    // allTags에서 각 카테고리에 속하는 태그 + 하드코딩 태그 통합
    const categorizedTags = useMemo(() => {
        const result: Record<string, Array<{ name: string; id: number; inDb: boolean }>> = {};

        Object.entries(TAG_CATEGORIES).forEach(([key, category]) => {
            // 1. 하드코딩된 카테고리 태그 (DB에 있으면 실제 ID, 없으면 0)
            const hardcodedWithId = category.tags.map((name) => ({
                name,
                id: tagNameToId.get(name) ?? 0,
                inDb: tagNameToId.has(name),
            }));

            // 2. DB에만 있는 태그 (하드코딩에 없는 것) — 이 카테고리에 추가
            // 현재 DB 태그에 카테고리 정보가 없으므로 하드코딩 목록에 없는 태그는
            // allTags 전체에서 어느 카테고리에도 속하지 않는 것들을 CONCEPT에만 추가
            if (key === "CONCEPT") {
                const allCategoryTagNames = new Set(
                    Object.values(TAG_CATEGORIES).flatMap((c) => c.tags)
                );
                const uncategorized = allTags
                    .filter((t) => !allCategoryTagNames.has(t.name))
                    .map((t) => ({ name: t.name, id: t.id, inDb: true }));
                result[key] = [...hardcodedWithId, ...uncategorized];
            } else {
                result[key] = hardcodedWithId;
            }
        });

        return result;
    }, [allTags, tagNameToId]);

    const selectedCount = modalSelectedLabels.length;

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] bg-black/60 flex items-end justify-center p-0 animate-in fade-in duration-200"
            onClick={onClose}
            role="presentation"
        >
            <div className="w-full flex items-end">
                <div
                    className="bg-white dark:bg-[#1a241b] w-full max-w-[480px] mx-auto rounded-t-2xl border border-gray-100 dark:border-gray-800 relative flex flex-col max-h-[80vh] animate-slide-up"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* 핸들 + 타이틀 */}
                    <div className="pt-3 pb-4 px-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
                        <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4" />
                        <div className="flex items-center justify-between">
                            <h3 className="text-[18px] font-bold text-gray-900 dark:text-white">
                                태그로 필터
                            </h3>
                            {selectedCount > 0 && (
                                <span className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    {selectedCount}개 선택됨
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 카테고리별 태그 목록 */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-2">
                        {Object.entries(TAG_CATEGORIES).map(([key, category]) => {
                            const tags = categorizedTags[key] ?? [];

                            return (
                                <div key={key}>
                                    <div className="text-[13px] font-bold mb-2.5 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                        {category.label}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map((tag) => {
                                            const isSelected = modalSelectedLabels.includes(tag.name);
                                            return (
                                                <button
                                                    key={tag.name}
                                                    onClick={() => onCategoryClick(tag.name)}
                                                    className={`px-3.5 py-2 rounded-lg text-[13.5px] border transition-all ${
                                                        isSelected
                                                            ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                                            : tag.inDb
                                                            ? "bg-white dark:bg-[#0f1710] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                                            : "bg-gray-50 dark:bg-[#0f1710] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                                    }`}
                                                >
                                                    {tag.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 하단 버튼 */}
                    <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a241b] pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
                        <div className="flex gap-3">
                            <button
                                onClick={onReset}
                                className="flex-1 py-3.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold text-[15px]"
                            >
                                초기화
                            </button>
                            <button
                                onClick={onApply}
                                className="flex-[2.5] py-3.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-[15px]"
                            >
                                {selectedCount > 0 ? `${selectedCount}개 적용` : "적용"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
