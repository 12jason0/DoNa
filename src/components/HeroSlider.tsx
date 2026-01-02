"use client";

import { useState, useRef, useEffect, useMemo, memo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

export type SliderItem = {
    id: string;
    imageUrl?: string;
    location?: string;
    concept?: string;
    conceptIcon?: string;
    tags?: string[];
    title?: string;
};

type HeroSliderProps = {
    items: SliderItem[];
};

/**
 * 🟢 개별 슬라이드 아이템 (LCP 최적화: 첫 이미지 즉시 표시)
 */
const SliderItemComponent = memo(
    ({
        item,
        idx,
        realLength,
        isInitialRender,
    }: {
        item: SliderItem;
        idx: number;
        realLength: number;
        isInitialRender: boolean;
    }) => {
        // 🟢 [LCP 최적화] 초기 렌더링 시 첫 번째 이미지(idx === 0)에만 priority 부여
        // 초기 렌더링이 아닐 때는 중앙 세트의 첫 번째(idx === realLength)에 priority
        const isFirstVisible = isInitialRender ? idx === 0 : idx === realLength;
        const hasPriority = isFirstVisible || (realLength === 1 && idx === 0);

        return (
            <Link
                href={`/courses/${item.id}`}
                prefetch={true} // 🟢 성능 최적화: prefetch 추가
                draggable={false}
                className="relative min-w-full md:min-w-[400px] aspect-4/5 rounded-xl overflow-hidden snap-center border border-gray-100 dark:border-transparent active:scale-[0.98] transition-transform duration-200 block select-none"
            >
                <div className="relative w-full h-full pointer-events-none">
                    {item.imageUrl ? (
                        <Image
                            src={item.imageUrl}
                            alt={item.location || "Course Image"}
                            fill
                            className="object-cover"
                            // 🟢 [LCP 최적화] 첫 번째 이미지만 priority로 즉시 로드
                            priority={hasPriority}
                            quality={hasPriority ? 75 : 60}
                            sizes="(max-width: 768px) 100vw, 400px"
                            fetchPriority={hasPriority ? "high" : "auto"}
                            unoptimized={false}
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                            No Image
                        </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-b from-black/5 via-transparent to-black/80" />
                </div>

                <div className="absolute bottom-0 left-0 w-full p-6 text-white z-10">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        {item.location && (
                            <span className="bg-white/20 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-xs font-semibold text-white tracking-wide">
                                📍 {item.location}
                            </span>
                        )}
                        {item.concept && (
                            <span className="bg-emerald-500/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1 tracking-tight">
                                {item.conceptIcon && (
                                    <Image
                                        src={item.conceptIcon}
                                        width={14}
                                        height={14}
                                        alt="icon"
                                        className="invert brightness-0"
                                        quality={50}
                                    />
                                )}
                                {item.concept}
                            </span>
                        )}
                    </div>
                    <h4 className="text-xl font-extrabold leading-tight drop-shadow-sm mb-1 line-clamp-2 tracking-tight">
                        {item.title ||
                            (item.tags?.[0] ? `#${item.tags[0]} 핫플레이스` : `${item.location || "이곳"}의 매력`)}
                    </h4>
                    <p className="text-sm text-gray-200 font-medium opacity-90 line-clamp-1">
                        {item.tags
                            ?.slice(0, 3)
                            .map((t) => `#${t}`)
                            .join(" ")}
                    </p>
                </div>
            </Link>
        );
    }
);
SliderItemComponent.displayName = "SliderItem";

export default function HeroSlider({ items }: HeroSliderProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);
    const [isInitialized, setIsInitialized] = useState(false); // 🟢 초기 렌더링 플래그

    // 🟢 [Optimization]: 너비를 ref에 저장하여 강제 리플로우 방지
    const containerWidthRef = useRef<number>(0);
    const realLength = items.length;

    // 🟢 [LCP 최적화] 초기 렌더링: 원본 데이터만 표시, 마운트 후 복제본 추가
    const renderItems = useMemo(() => {
        // 초기 렌더링이 아닐 때만 복제 (무한 스크롤 활성화)
        if (isInitialized && items.length > 1) {
            return [...items, ...items, ...items];
        }
        // 초기 렌더링: 원본 데이터만 반환하여 첫 이미지 즉시 표시
        return items;
    }, [items, isInitialized]);

    // 🟢 [LCP 최적화] 마운트 후 무한 스크롤 활성화 및 스크롤 위치 조정
    useEffect(() => {
        if (!scrollRef.current || isInitialized || items.length <= 1) {
            if (items.length <= 1) setIsInitialized(true); // 단일 아이템은 즉시 초기화
            return;
        }

        const container = scrollRef.current;
        const initialWidth = container.offsetWidth || container.clientWidth || window.innerWidth;

        if (initialWidth > 0) {
            containerWidthRef.current = initialWidth;

            // 🟢 복제본을 추가한 후 중앙 세트로 스크롤
            setIsInitialized(true);

            // 🟢 다음 프레임에서 스크롤 위치 조정 (DOM 업데이트 후)
            requestAnimationFrame(() => {
                if (container) {
                    container.scrollLeft = initialWidth * realLength;
                    setCurrentIndex(realLength);
                }
            });
        }

        let rafId: number | null = null;

        // 🟢 ResizeObserver는 이후 크기 변경 감지용으로만 사용
        const observer = new ResizeObserver((entries) => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                for (let entry of entries) {
                    containerWidthRef.current = entry.contentRect.width;
                }
            });
        });

        observer.observe(container);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            observer.disconnect();
        };
    }, [realLength, isInitialized, items.length]);

    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollRafRef = useRef<number | null>(null);

    // 🟢 [Optimization]: offsetWidth 호출 제거 및 멱등성 보장 + requestAnimationFrame 사용
    const handleScroll = useCallback(() => {
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);

        // 🟢 [Performance]: 스크롤 이벤트를 requestAnimationFrame으로 디바운싱
        scrollRafRef.current = requestAnimationFrame(() => {
            scrollTimeoutRef.current = setTimeout(() => {
                const container = scrollRef.current;
                const width = containerWidthRef.current; // 캐싱된 너비 사용

                if (container && width > 0 && realLength > 1) {
                    const scrollLeftVal = container.scrollLeft;
                    const index = Math.round(scrollLeftVal / width);
                    setCurrentIndex(index);

                    // 🟢 무한 스크롤 루프 로직 (반응성 향상: 0.5 -> 0.1로 조정하여 부드러운 전환)
                    if (scrollLeftVal >= width * (realLength * 2)) {
                        container.scrollTo({
                            left: width * realLength + (scrollLeftVal - width * (realLength * 2)),
                            behavior: "auto",
                        });
                    } else if (scrollLeftVal <= width * 0.1) {
                        container.scrollTo({
                            left: scrollLeftVal + width * realLength,
                            behavior: "auto",
                        });
                    }
                }
            }, 100); // 🟢 [Snappiness] 150ms -> 100ms로 단축하여 2030 타겟에 맞는 속도감 확보
        });
    }, [realLength]);

    // 마우스 드래그 핸들러 (Ref 활용으로 리렌더링 제거)
    const onMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        if (scrollRef.current) {
            startX.current = e.pageX - scrollRef.current.offsetLeft;
            scrollLeft.current = scrollRef.current.scrollLeft;
        }
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX.current) * 2;
        scrollRef.current.scrollLeft = scrollLeft.current - walk;
    };

    // 🟢 [Optimization]: 자동 스크롤 로직 최적화 (페이지 가시성 확인)
    useEffect(() => {
        if (realLength <= 1 || isDragging) return;

        let intervalId: ReturnType<typeof setInterval> | null = null;
        let isPageVisible = true;

        // 🟢 [Performance]: 페이지가 보이지 않을 때는 자동 스크롤 중지
        const handleVisibilityChange = () => {
            isPageVisible = !document.hidden;
            if (!isPageVisible && intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            } else if (isPageVisible && !intervalId) {
                intervalId = setInterval(() => {
                    const container = scrollRef.current;
                    const width = containerWidthRef.current;

                    if (container && width > 0 && !isDragging && isPageVisible) {
                        container.scrollTo({
                            left: width * (currentIndex + 1),
                            behavior: "smooth",
                        });
                    }
                }, 5000); // 🟢 4500ms -> 5000ms로 증가하여 부하 감소
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        intervalId = setInterval(() => {
            const container = scrollRef.current;
            const width = containerWidthRef.current;

            if (container && width > 0 && !isDragging && isPageVisible) {
                container.scrollTo({
                    left: width * (currentIndex + 1),
                    behavior: "smooth",
                });
            }
        }, 5000); // 🟢 4500ms -> 5000ms로 증가하여 부하 감소

        return () => {
            if (intervalId) clearInterval(intervalId);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [currentIndex, realLength, isDragging]);

    // 🟢 [Performance] 빈 배열이어도 구조는 유지하여 레이아웃 시프트 방지 및 즉시 표시
    // if (!items || items.length === 0) return null; // 제거: 항상 렌더링하여 즉시 표시

    return (
        // 🟢 [UX/CLS] 명시적 최소 높이 부여하여 레이아웃 시프트 방지
        <section className="relative w-full pb-6 pt-2 overflow-hidden min-h-[400px]">
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                onMouseDown={onMouseDown}
                onMouseLeave={() => setIsDragging(false)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={onMouseMove}
                className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 gap-3 cursor-grab active:cursor-grabbing will-change-scroll"
                style={{
                    scrollBehavior: isDragging ? "auto" : "smooth",
                }}
            >
                {/* 🟢 [LCP 최적화] 빈 배열이어도 구조 유지, 데이터가 있으면 즉시 표시 */}
                {renderItems.length > 0 ? (
                    renderItems.map((item, idx) => (
                        <SliderItemComponent
                            key={`${item.id}-${idx}`}
                            item={item}
                            idx={idx}
                            realLength={realLength}
                            isInitialRender={!isInitialized}
                        />
                    ))
                ) : (
                    <div className="min-h-[400px] flex items-center justify-center w-full">
                        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                    </div>
                )}
            </div>
        </section>
    );
}
