"use client";

import { useState, useRef, useEffect, useMemo, memo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

// Updated type definition to include the new icon field
export type SliderItem = {
    id: string;
    imageUrl?: string;
    location?: string;
    concept?: string;
    conceptIcon?: string; // New: Icon for the concept badge
    tags?: string[];
    title?: string;
};

type HeroSliderProps = {
    items: SliderItem[];
};

// 🟢 단순화: memo 비교 함수 제거 (기본 비교가 더 빠를 수 있음)
const SliderItemComponent = memo(
    ({ item, idx, realLength, items }: { item: SliderItem; idx: number; realLength: number; items: SliderItem[] }) => {
        // 🟢 이미지 로딩: 현재 보이는 슬라이드와 인접 슬라이드만 로드
        const isVisible = idx === realLength || idx === realLength - 1 || idx === realLength + 1;
        const shouldLoad = items.length === 1 || isVisible;
        // 첫 번째 보이는 이미지만 priority
        const isFirstVisible = idx === realLength || (items.length === 1 && idx === 0);

        return (
            <Link
                href={`/courses/${item.id}`}
                draggable={false}
                className="relative min-w-[100%] md:min-w-[400px] aspect-[4/5] rounded-xl overflow-hidden snap-center border border-gray-100 active:scale-[0.98] transition-transform duration-200 block select-none"
            >
                {/* Background Image */}
                <div className="relative w-full h-full pointer-events-none">
                    {item.imageUrl ? (
                        <Image
                            src={item.imageUrl}
                            alt={item.location || "Course Image"}
                            fill
                            className="object-cover"
                            priority={isFirstVisible} // 🟢 첫 번째 이미지만 priority
                            loading={shouldLoad ? "eager" : "lazy"} // 🟢 보이는 것만 eager, 나머지는 lazy
                            quality={70} // 🟢 성능 최적화: 75 -> 70 (더 빠른 로딩)
                            sizes="(max-width: 768px) 100vw, 400px"
                            fetchPriority={isFirstVisible ? "high" : "auto"} // 🟢 첫 이미지만 high
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                            No Image
                        </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/80" />
                </div>

                {/* Content Overlay */}
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
                                        loading="lazy" // 🟢 아이콘은 lazy loading
                                        quality={50} // 🟢 작은 아이콘이므로 quality 낮춤
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
                            .join(" ")}{" "}
                        {/* 🟢 최대 3개만 표시 */}
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

    // --- Mouse Drag State ---
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    // 3배수 렌더링 (무한 스크롤용) - useMemo로 최적화
    const renderItems = useMemo(() => (items.length > 1 ? [...items, ...items, ...items] : items), [items]);
    const realLength = items.length;

    // 초기 위치 설정 (중앙 세트의 첫 번째)
    useEffect(() => {
        if (scrollRef.current && realLength > 1) {
            const width = scrollRef.current.offsetWidth;
            scrollRef.current.scrollTo({
                left: width * realLength,
                behavior: "auto",
            });
            setCurrentIndex(realLength);
        }
    }, [realLength]);

    // 🟢 단순화: throttle만 사용 (requestAnimationFrame 제거)
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleScroll = () => {
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
            if (scrollRef.current && realLength > 1) {
                const scrollLeftVal = scrollRef.current.scrollLeft;
                const width = scrollRef.current.offsetWidth;
                const index = Math.round(scrollLeftVal / width);

                setCurrentIndex(index);

                // 오른쪽 끝(3번째 세트 진입) -> 중앙 세트로 점프
                if (scrollLeftVal >= width * (realLength * 2)) {
                    const relativeOffset = scrollLeftVal - width * (realLength * 2);
                    scrollRef.current.scrollTo({
                        left: width * realLength + relativeOffset,
                        behavior: "auto",
                    });
                }
                // 왼쪽 끝(1번째 세트 진입) -> 중앙 세트로 점프
                else if (scrollLeftVal <= width * 0.5) {
                    const relativeOffset = width * realLength;
                    scrollRef.current.scrollTo({
                        left: scrollLeftVal + relativeOffset,
                        behavior: "auto",
                    });
                }
            }
        }, 50); // 🟢 throttle 간격 증가 (더 가벼움)
    };

    // cleanup
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

    // 🟢 단순화: useCallback 제거 (인라인 함수가 더 빠를 수 있음)
    const onMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        if (scrollRef.current) {
            setStartX(e.pageX - scrollRef.current.offsetLeft);
            setScrollLeft(scrollRef.current.scrollLeft);
        }
    };

    const onMouseLeave = () => {
        setIsDragging(false);
    };

    const onMouseUp = () => {
        setIsDragging(false);
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        if (scrollRef.current) {
            const x = e.pageX - scrollRef.current.offsetLeft;
            const walk = (x - startX) * 2;
            scrollRef.current.scrollLeft = scrollLeft - walk;
        }
    };

    // 🟢 단순화: 자동 스크롤 지연 제거 (즉시 시작)
    useEffect(() => {
        if (realLength <= 1 || isDragging) return;

        const interval = setInterval(() => {
            if (scrollRef.current && !isDragging) {
                const width = scrollRef.current.offsetWidth;
                const nextIndex = currentIndex + 1;

                scrollRef.current.scrollTo({
                    left: width * nextIndex,
                    behavior: "smooth",
                });
            }
        }, 4000);

        return () => clearInterval(interval);
    }, [currentIndex, realLength, isDragging]);

    if (!items || items.length === 0) return null;

    return (
        <section className="relative w-full pb-6 pt-2">
            {/* Slider Container */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                onMouseDown={onMouseDown}
                onMouseLeave={onMouseLeave}
                onMouseUp={onMouseUp}
                onMouseMove={onMouseMove}
                className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 gap-3 cursor-grab active:cursor-grabbing"
                style={{ scrollBehavior: isDragging ? "auto" : "smooth" }}
            >
                {renderItems.map((item, idx) => (
                    <SliderItemComponent
                        key={`${item.id}-${idx}`}
                        item={item}
                        idx={idx}
                        realLength={realLength}
                        items={items}
                    />
                ))}
            </div>
        </section>
    );
}
