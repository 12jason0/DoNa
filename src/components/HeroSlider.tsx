"use client";

import { useState, useRef, useEffect, useMemo, memo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

const CARD_GAP = 12;
const PEEK_RATIO = 0.88; // 88% 카드 너비 → 12% 다음 카드 노출
const HERO_HEIGHT_VH = 65;
const CARD_RADIUS = "28px";

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

/** 카드 이미지 상단 오버레이: 세그먼트 인디케이터 (반투명 화이트/블랙) */
const SegmentOverlay = memo(({ totalSlots, currentSlotIndex }: { totalSlots: number; currentSlotIndex: number }) => (
    <div className="absolute top-0 left-0 right-0 z-10 px-3 pt-3 pointer-events-none">
        <div className="flex gap-0.5 rounded-full">
            {Array.from({ length: totalSlots }).map((_, i) => (
                <div
                    key={i}
                    className={`h-[2px] flex-1 rounded-full transition-all duration-200 ease-out ${
                        currentSlotIndex === i ? "bg-white/90 dark:bg-white/80" : "bg-white/40 dark:bg-black/40"
                    }`}
                    aria-hidden
                />
            ))}
        </div>
    </div>
));
SegmentOverlay.displayName = "SegmentOverlay";

const SliderItemComponent = memo(
    ({
        item,
        idx,
        style,
        totalSlots,
        currentSlotIndex,
    }: {
        item: SliderItem;
        idx: number;
        style?: React.CSSProperties;
        totalSlots: number;
        currentSlotIndex: number;
    }) => {
        const hasPriority = idx === 0;
        return (
            <Link
                href={`/courses/${item.id}`}
                prefetch={true}
                draggable={false}
                className="relative rounded-[28px] overflow-hidden snap-center border border-gray-100 dark:border-transparent active:scale-[0.98] transition-transform duration-200 block select-none"
                style={style}
            >
                {totalSlots > 1 && <SegmentOverlay totalSlots={totalSlots} currentSlotIndex={currentSlotIndex} />}
                <div className="absolute inset-0 pointer-events-none">
                    {item.imageUrl ? (
                        <Image
                            src={item.imageUrl}
                            alt={item.location || "Course Image"}
                            fill
                            className="object-cover"
                            priority={hasPriority}
                            quality={75}
                            sizes="(max-width: 768px) 100vw, 400px"
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
                            <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold">
                                📍 {item.location}
                            </span>
                        )}
                        {item.concept && (
                            <span className="bg-white/30 dark:bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                {item.conceptIcon && (
                                    <Image
                                        src={item.conceptIcon}
                                        width={14}
                                        height={14}
                                        alt="icon"
                                        className="invert brightness-0"
                                    />
                                )}
                                {item.concept}
                            </span>
                        )}
                    </div>
                    <h4
                        className="text-xl font-extrabold mb-1 line-clamp-2"
                        style={{ letterSpacing: "-0.02em", lineHeight: 1.5 }}
                    >
                        {item.title || `${item.location || "이곳"}의 매력`}
                    </h4>
                </div>
            </Link>
        );
    },
);
SliderItemComponent.displayName = "SliderItem";

const HERO_SLIDER_MAX = 5; // 최대 5개 코스만 사용
const REPEAT_COUNT = 15; // 5개 코스가 끊김 없이 계속 반복되도록 여러 번 복제

export default function HeroSlider({ items }: HeroSliderProps) {
    const limitedItems = useMemo(() => items.slice(0, HERO_SLIDER_MAX), [items]);
    const realLength = limitedItems.length;
    const totalSlots = realLength;

    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentSlotIndex, setCurrentSlotIndex] = useState(0); // 세그먼트 인디케이터용 (0 ~ totalSlots-1)
    const [slideWidthPx, setSlideWidthPx] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const containerWidthRef = useRef<number>(0);
    const slideStepRef = useRef<number>(0); // Peek용 실제 스텝(슬라이드 너비 + gap) - moveToNext/보정에서 사용
    const isScrollingRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    const touchStartX = useRef(0);
    const touchEndX = useRef(0);
    const slideStepPx = slideWidthPx + CARD_GAP;

    const renderItems = useMemo(
        () => (totalSlots <= 1 ? limitedItems : Array.from({ length: REPEAT_COUNT }, () => limitedItems).flat()),
        [limitedItems, totalSlots],
    );

    // 🟢 타이머 정지 함수
    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // 🟢 슬라이드 이동 함수 (Peek용 step = slideWidth + gap 기준으로 통일, 왔다갔다 방지)
    const middleSetStart = totalSlots * Math.floor(REPEAT_COUNT / 2);
    const middleSetEnd = totalSlots * (Math.floor(REPEAT_COUNT / 2) + 1) - 1;
    const upperBound = totalSlots * (REPEAT_COUNT - 1);
    const moveToNext = useCallback(
        (nextIdx: number) => {
            if (!scrollRef.current || isScrollingRef.current) return;
            const step = slideStepRef.current;
            if (step <= 0) return;
            isScrollingRef.current = true;
            const container = scrollRef.current;

            let adjustedIdx = nextIdx;
            if (adjustedIdx >= upperBound) adjustedIdx = middleSetStart;
            else if (adjustedIdx < totalSlots) adjustedIdx = middleSetEnd;

            const targetLeft = adjustedIdx * step;
            container.style.scrollBehavior = "smooth";
            container.scrollTo({ left: targetLeft });

            setTimeout(() => {
                if (!container) return;
                const finalScrollLeft = container.scrollLeft;
                const finalIndex = Math.round(finalScrollLeft / step);

                if (finalIndex >= upperBound) {
                    container.style.scrollBehavior = "auto";
                    container.scrollLeft = step * middleSetStart;
                } else if (finalIndex < totalSlots) {
                    container.style.scrollBehavior = "auto";
                    container.scrollLeft = step * middleSetEnd;
                }

                isScrollingRef.current = false;
                container.style.scrollBehavior = "auto";
            }, 500);
        },
        [totalSlots],
    );

    // 🟢 타이머 시작 함수 (3초) - step은 ref로 읽어서 항상 최신값 사용
    const startTimer = useCallback(() => {
        stopTimer();
        if (totalSlots <= 1) return;
        timerRef.current = setInterval(() => {
            const container = scrollRef.current;
            const step = slideStepRef.current;
            if (container && !isScrollingRef.current && step > 0) {
                const currentIdx = Math.round(container.scrollLeft / step);
                moveToNext(currentIdx + 1);
            }
        }, 3800);
    }, [moveToNext, totalSlots, stopTimer]);

    // 초기화 및 리사이즈 감지 (Peek: 카드 너비 = 88%)
    useEffect(() => {
        if (!scrollRef.current || totalSlots <= 1) {
            if (totalSlots <= 1) setIsInitialized(true);
            return;
        }
        const container = scrollRef.current;
        const width = container.offsetWidth || container.clientWidth || window.innerWidth;
        containerWidthRef.current = width;
        const slideW = Math.round(width * PEEK_RATIO);
        const step = slideW + CARD_GAP;
        slideStepRef.current = step;
        setSlideWidthPx(slideW);

        container.style.scrollBehavior = "auto";
        const midStart = totalSlots * Math.floor(REPEAT_COUNT / 2);
        container.scrollLeft = step * midStart;
        setIsInitialized(true);

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const w = entry.contentRect.width;
                containerWidthRef.current = w;
                const sw = Math.round(w * PEEK_RATIO);
                slideStepRef.current = sw + CARD_GAP;
                setSlideWidthPx(sw);
            }
        });
        observer.observe(container);

        startTimer();
        return () => {
            observer.disconnect();
            stopTimer();
        };
    }, [totalSlots, startTimer, stopTimer]);

    // 🟢 Passive Event Listener 오류 해결을 위한 네이티브 리스너 등록
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || totalSlots <= 1) return;

        const handleNativeWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                e.preventDefault();
                stopTimer();
                const step = containerWidthRef.current * PEEK_RATIO + CARD_GAP;
                if (step <= 0) return;
                const currentIdx = Math.round(el.scrollLeft / step);
                const nextIdx = e.deltaX > 0 ? currentIdx + 1 : currentIdx - 1;
                moveToNext(nextIdx);
                startTimer();
            }
        };

        el.addEventListener("wheel", handleNativeWheel, { passive: false });
        return () => el.removeEventListener("wheel", handleNativeWheel);
    }, [totalSlots, moveToNext, startTimer, stopTimer]);

    const scrollRafRef = useRef<number | null>(null);
    const handleScroll = useCallback(() => {
        if (scrollRafRef.current != null) return;
        scrollRafRef.current = requestAnimationFrame(() => {
            scrollRafRef.current = null;
            const container = scrollRef.current;
            const step = slideStepRef.current;
            if (!container || step <= 0 || totalSlots <= 1) return;

            const scrollLeft = container.scrollLeft;
            const progressIndex = scrollLeft / step;
            const index = Math.round(progressIndex);
            const slotIndex = index % totalSlots;
            setCurrentSlotIndex(slotIndex);
            const actualIndex = ((slotIndex % realLength) + realLength) % realLength;
            setCurrentIndex(actualIndex);
        });
    }, [totalSlots, realLength]);

    const onTouchStart = (e: React.TouchEvent) => {
        stopTimer(); // 터치 시작 시 타이머 중지
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const onTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const onTouchEnd = useCallback(() => {
        // 터치 후 moveToNext 호출 제거 → 손 뗀 후 덜컹거림(jank) 방지. 네이티브 스크롤만 사용.
        startTimer();
    }, [startTimer]);

    const slideStyle =
        slideWidthPx > 0
            ? {
                  width: slideWidthPx,
                  minWidth: slideWidthPx,
                  height: "100%",
                  minHeight: "100%",
              }
            : undefined;

    return (
        <section
            className={`relative w-full overflow-hidden transition-opacity duration-500 ${
                isInitialized ? "opacity-100" : "opacity-0"
            }`}
            style={{ minHeight: `${HERO_HEIGHT_VH}vh` }}
        >
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 will-change-scroll"
                style={{
                    scrollBehavior: "auto",
                    gap: CARD_GAP,
                    height: `${HERO_HEIGHT_VH}vh`,
                    WebkitOverflowScrolling: "touch",
                }}
            >
                {renderItems.map((slot, idx) => (
                    <SliderItemComponent
                        key={`${(slot as SliderItem).id}-${idx}`}
                        item={slot as SliderItem}
                        idx={idx}
                        style={slideStyle}
                        totalSlots={totalSlots}
                        currentSlotIndex={currentSlotIndex}
                    />
                ))}
            </div>
        </section>
    );
}
