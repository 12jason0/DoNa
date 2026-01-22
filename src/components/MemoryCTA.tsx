"use client";

import Image from "next/image";
import { useRef } from "react";
import { MEMORY_MESSAGES } from "@/constants/memories";

export interface MemoryPreview {
    id?: string | number;
    title?: string;
    courseTitle?: string;
    excerpt?: string;
    imageUrl?: string;
    createdAt?: string;
}

interface MemoryCTAProps {
    hasMemories: boolean;
    isAuthenticated?: boolean;
    latestMemory?: MemoryPreview | null;
    memories?: MemoryPreview[];
    isLoading?: boolean;
    onAction: () => void;
    onMemoryClick?: (memory: MemoryPreview) => void;
}

export default function MemoryCTA({
    hasMemories,
    isAuthenticated = false,
    latestMemory,
    memories = [],
    isLoading = false,
    onAction,
    onMemoryClick,
}: MemoryCTAProps) {
    const content = !isAuthenticated 
        ? MEMORY_MESSAGES.notLoggedIn 
        : hasMemories 
        ? MEMORY_MESSAGES.filled 
        : MEMORY_MESSAGES.empty;

    // 제목을 10글자로 제한하는 함수
    const truncateTitle = (title: string | undefined | null): string => {
        if (!title) return "나만의 추억";
        return title.length > 10 ? title.slice(0, 10) + "..." : title;
    };

    // 날짜 포맷팅 함수
    const formatDate = (dateString?: string): string => {
        if (!dateString) return "";
        try {
            const date = new Date(dateString);
            const month = date.getMonth() + 1;
            const day = date.getDate();
            return `${month}월 ${day}일`;
        } catch {
            return "";
        }
    };

    // 마우스 휠로 가로 스크롤 처리
    const scrollRef = useRef<HTMLDivElement>(null);
    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (scrollRef.current && e.deltaY !== 0) {
            e.preventDefault();
            scrollRef.current.scrollLeft += e.deltaY;
        }
    };

    return (
        <section className="w-full bg-white/80 dark:bg-[#111b15] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-lg p-6 flex flex-col gap-5">
            {/* 헤더 영역: 한 줄 정렬 */}
            <div className="flex justify-between items-center mb-1">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">{content.title}</h3>
                        {hasMemories && (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px] text-gray-600 dark:text-gray-400 flex-shrink-0">
                                <path d="M19 10H20C20.5523 10 21 10.4477 21 11V21C21 21.5523 20.5523 22 20 22H4C3.44772 22 3 21.5523 3 21V11C3 10.4477 3.44772 10 4 10H5V9C5 5.13401 8.13401 2 12 2C15.866 2 19 5.13401 19 9V10ZM5 12V20H19V12H5ZM11 14H13V18H11V14ZM17 10V9C17 6.23858 14.7614 4 12 4C9.23858 4 7 6.23858 7 9V10H17Z"></path>
                            </svg>
                        )}
                    </div>
                    {!hasMemories && content.subtitle && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{content.subtitle}</p>
                    )}
                </div>
                {hasMemories && (
                    <button
                        type="button"
                        onClick={onAction}
                        disabled={isLoading}
                        className="text-emerald-500 dark:text-emerald-400 font-semibold text-sm hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors ml-4 shrink-0"
                    >
                        {isLoading ? "불러오는 중..." : "전체보기 >"}
                    </button>
                )}
            </div>

            {/* 추억 카드 가로 스크롤 영역 */}
            {hasMemories && memories.length > 0 ? (
                <div 
                    ref={scrollRef}
                    onWheel={handleWheel}
                    className="overflow-x-auto no-scrollbar -mx-2 px-2"
                    style={{
                        WebkitOverflowScrolling: 'touch',
                        scrollSnapType: 'x mandatory',
                        touchAction: 'pan-x',
                    }}
                >
                    <div className="flex gap-5 pb-2" style={{ width: 'max-content', minWidth: '100%' }}>
                        {memories.map((memory, index) => (
                            <div
                                key={memory.id || index}
                                onClick={() => {
                                    if (onMemoryClick) {
                                        onMemoryClick(memory);
                                    } else {
                                        onAction();
                                    }
                                }}
                                className="shrink-0 w-[180px] h-[240px] bg-white dark:bg-[#0e1b16] border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden flex flex-col shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-[0.98]"
                                style={{
                                    scrollSnapAlign: 'start',
                                }}
                            >
                                {/* 이미지 영역 (3:4 비율) */}
                                <div className="relative w-full h-[180px] bg-gray-200 dark:bg-gray-800">
                                    {memory.imageUrl ? (
                                        <Image
                                            src={memory.imageUrl}
                                            alt={memory.courseTitle || memory.title || "추억 이미지"}
                                            fill
                                            className="object-cover object-top"
                                            sizes="180px"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-4xl text-gray-400">
                                            📸
                                        </div>
                                    )}
                                </div>
                                {/* 텍스트 영역 */}
                                <div className="flex-1 px-3 py-3 flex flex-col justify-between">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug line-clamp-1">
                                        {truncateTitle(memory.courseTitle || memory.title)}
                                    </p>
                                    {memory.createdAt && (
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                            {formatDate(memory.createdAt)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={onAction}
                    disabled={isLoading}
                    className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold text-white transition-all ${
                        isLoading
                            ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                            : "bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-lg"
                    }`}
                >
                    {isLoading ? "불러오는 중..." : content.button}
                </button>
            )}
        </section>
    );
}
