"use client";

import Image from "next/image";
import { useRef, useEffect } from "react";
import { Lock, ChevronRight } from "lucide-react";
import { MEMORY_MESSAGES } from "@/constants/memories";

export interface MemoryPreview {
    id?: string | number;
    title?: string;
    courseTitle?: string;
    excerpt?: string;
    tags?: string[];
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

    // 마우스 휠로 가로 스크롤 처리 (passive: false로 등록해야 preventDefault 동작)
    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const handleWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        };
        el.addEventListener("wheel", handleWheel, { passive: false });
        return () => el.removeEventListener("wheel", handleWheel);
    }, [hasMemories, memories.length]);

    // 비로그인: 슬림 알림바 (좌: 2줄 텍스트 / 우: 작은 pill 버튼)
    if (!isAuthenticated) {
        return (
            <section className="w-full bg-white dark:bg-[#111b15] rounded-xl border border-transparent dark:border-transparent shadow-sm py-3 px-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug truncate">
                        {content.title}
                    </p>
                    {content.subtitle && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug truncate">
                            {content.subtitle}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onAction}
                    disabled={isLoading}
                    className="shrink-0 px-4 py-2 rounded-full text-sm font-semibold text-white bg-[#7aa06f] hover:bg-[#6b8f62] dark:bg-[#7aa06f] dark:hover:bg-[#6b8f62] transition-colors disabled:opacity-50"
                >
                    {isLoading ? (
                        <span className="inline-block w-16 h-5 bg-white/30 rounded animate-pulse" />
                    ) : (
                        content.button
                    )}
                </button>
            </section>
        );
    }

    return (
        <section className="w-full bg-white/80 dark:bg-[#111b15] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-lg p-6 flex flex-col gap-5">
            {/* 헤더 영역: 한 줄 정렬 */}
            <div className="flex justify-between items-center mb-1">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        {hasMemories && (
                            <Lock
                                className="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0"
                                strokeWidth={1.5}
                                aria-hidden
                            />
                        )}
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
                            {content.title}
                        </h3>
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
                        aria-label="전체보기"
                        className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-2 shrink-0"
                    >
                        {isLoading ? (
                            <span className="inline-block w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                        ) : (
                            <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
                        )}
                    </button>
                )}
            </div>

            {/* 추억 카드 가로 스크롤 영역 */}
            {hasMemories && memories.length > 0 ? (
                <div
                    ref={scrollRef}
                    className="overflow-x-auto no-scrollbar -mx-2 px-2"
                    style={{
                        WebkitOverflowScrolling: "touch",
                        scrollSnapType: "x mandatory",
                        touchAction: "pan-x",
                    }}
                >
                    <div className="flex gap-5 pb-2" style={{ width: "max-content", minWidth: "100%" }}>
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
                                className="shrink-0 w-[180px] bg-white dark:bg-[#0e1b16] border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                                style={{
                                    scrollSnapAlign: "start",
                                }}
                            >
                                {/* 이미지 영역 (3:2 비율: 풍경/데이트 코스에 안정적) */}
                                <div className="relative w-full aspect-3/4 bg-gray-200 dark:bg-gray-800">
                                    {memory.imageUrl ? (
                                        <Image
                                            src={memory.imageUrl}
                                            alt={memory.courseTitle || memory.title || "추억 이미지"}
                                            fill
                                            className="object-cover object-center"
                                            sizes="180px"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-4xl text-gray-400">
                                            📸
                                        </div>
                                    )}
                                </div>
                                {/* 텍스트 영역: gray만 사용해 콘텐츠(사진)에 시선 집중 */}
                                <div className="flex-1 px-3 py-3 flex flex-col justify-between min-h-[72px]">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug line-clamp-1">
                                        {truncateTitle(memory.courseTitle || memory.title)}
                                    </p>
                                    {memory.tags && memory.tags.length > 0 && (() => {
                                        const doNa = memory.tags.find((t) => t === "DoNa");
                                        const others = memory.tags.filter((t) => t !== "DoNa");
                                        const displayTags = [...(doNa ? [doNa] : []), ...others.slice(0, 1)];
                                        return displayTags.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                {displayTags.map((t) => (
                                                    <span
                                                        key={t}
                                                        className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                                                    >
                                                        #{t}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : null;
                                    })()}
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
            ) : isLoading ? (
                <div className="w-full h-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
            ) : (
                <button
                    type="button"
                    onClick={onAction}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold text-white bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-lg transition-all"
                >
                    {content.button}
                </button>
            )}
        </section>
    );
}
