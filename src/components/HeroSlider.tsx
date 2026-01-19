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

const SliderItemComponent = memo(({ item, idx }: { item: SliderItem; idx: number }) => {
    const hasPriority = idx === 0;
    return (
        <Link
            href={`/courses/${item.id}`}
            prefetch={true}
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
                        <span className="bg-emerald-500/90 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
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
                <h4 className="text-xl font-extrabold leading-tight mb-1 line-clamp-2">
                    {item.title || `${item.location || "이곳"}의 매력`}
                </h4>
            </div>
        </Link>
    );
});
SliderItemComponent.displayName = "SliderItem";

export default function HeroSlider({ items }: HeroSliderProps) {
    const realLength = items.length;
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const containerWidthRef = useRef<number>(0);
    const isScrollingRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null); // 자동 슬라이드 타이머
    const [isInitialized, setIsInitialized] = useState(false);

    const touchStartX = useRef(0);
    const touchEndX = useRef(0);

    const renderItems = useMemo(() => (realLength <= 1 ? items : [...items, ...items, ...items]), [items, realLength]);

    // 🟢 타이머 정지 함수
    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // 🟢 슬라이드 이동 함수
    const moveToNext = useCallback(
        (nextIdx: number) => {
            if (!scrollRef.current || isScrollingRef.current) return;
            isScrollingRef.current = true;
            const width = containerWidthRef.current;
            const container = scrollRef.current;

            let adjustedIdx = nextIdx;
            if (adjustedIdx >= realLength * 2) adjustedIdx = realLength;
            else if (adjustedIdx < realLength) adjustedIdx = realLength * 2 - 1;

            container.style.scrollBehavior = "smooth";
            container.scrollTo({ left: adjustedIdx * width });

            setTimeout(() => {
                if (!container) return;
                const finalScrollLeft = container.scrollLeft;
                const finalIndex = Math.round(finalScrollLeft / width);

                if (finalIndex >= realLength * 2) {
                    container.style.scrollBehavior = "auto";
                    container.scrollLeft = width * realLength;
                } else if (finalIndex < realLength) {
                    container.style.scrollBehavior = "auto";
                    container.scrollLeft = width * (realLength * 2 - 1);
                }

                isScrollingRef.current = false;
                container.style.scrollBehavior = "auto";
            }, 500);
        },
        [realLength]
    );

    // 🟢 타이머 시작 함수 (3초)
    const startTimer = useCallback(() => {
        stopTimer();
        if (realLength <= 1) return;
        timerRef.current = setInterval(() => {
            const container = scrollRef.current;
            if (container && !isScrollingRef.current) {
                const width = containerWidthRef.current;
                const currentIdx = Math.round(container.scrollLeft / width);
                moveToNext(currentIdx + 1);
            }
        }, 3000);
    }, [moveToNext, realLength, stopTimer]);

    // 초기화 및 리사이즈 감지
    useEffect(() => {
        if (!scrollRef.current || realLength <= 1) {
            if (realLength <= 1) setIsInitialized(true);
            return;
        }
        const container = scrollRef.current;
        const width = container.offsetWidth || container.clientWidth || window.innerWidth;
        containerWidthRef.current = width;

        container.style.scrollBehavior = "auto";
        container.scrollLeft = width * realLength;
        setIsInitialized(true);

        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) containerWidthRef.current = entry.contentRect.width;
        });
        observer.observe(container);

        startTimer(); // 타이머 시작
        return () => {
            observer.disconnect();
            stopTimer();
        };
    }, [realLength, startTimer, stopTimer]);

    // 🟢 Passive Event Listener 오류 해결을 위한 네이티브 리스너 등록
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || realLength <= 1) return;

        const handleNativeWheel = (e: WheelEvent) => {
            // 가로 스크롤 의도가 강할 때만 가로채기
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                e.preventDefault(); // 이제 에러 없이 작동합니다.
                stopTimer(); // 사용자 개입 시 타이머 정지
                const width = containerWidthRef.current;
                const currentIdx = Math.round(el.scrollLeft / width);
                const nextIdx = e.deltaX > 0 ? currentIdx + 1 : currentIdx - 1;
                moveToNext(nextIdx);
                startTimer(); // 조작 완료 후 다시 타이머 시작
            }
        };

        el.addEventListener("wheel", handleNativeWheel, { passive: false });
        return () => el.removeEventListener("wheel", handleNativeWheel);
    }, [realLength, moveToNext, startTimer, stopTimer]);

    const handleScroll = useCallback(() => {
        const container = scrollRef.current;
        const width = containerWidthRef.current;
        if (!container || width <= 0 || realLength <= 1) return;

        const scrollLeft = container.scrollLeft;
        const index = Math.round(scrollLeft / width);
        const actualIndex = index % realLength;
        setCurrentIndex(actualIndex);
    }, [realLength]);

    const onTouchStart = (e: React.TouchEvent) => {
        stopTimer(); // 터치 시작 시 타이머 중지
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const onTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const onTouchEnd = useCallback(() => {
        const diff = touchStartX.current - touchEndX.current;
        const threshold = 50;

        if (Math.abs(diff) > threshold) {
            const width = containerWidthRef.current;
            const currentIdx = Math.round(scrollRef.current!.scrollLeft / width);
            const nextIdx = diff > 0 ? currentIdx + 1 : currentIdx - 1;
            moveToNext(nextIdx);
        }
        startTimer(); // 터치 종료 후 타이머 다시 시작
    }, [moveToNext, startTimer]);

    return (
        <section
            className={`relative w-full pb-6 pt-2 overflow-hidden min-h-[400px] transition-opacity duration-500 ${
                isInitialized ? "opacity-100" : "opacity-0"
            }`}
        >
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 gap-3 will-change-scroll"
                style={{ scrollBehavior: "auto" }}
            >
                {renderItems.map((item, idx) => (
                    <SliderItemComponent key={`${item.id}-${idx}`} item={item} idx={idx} />
                ))}
            </div>
            <div className="flex justify-center gap-1.5 mt-4">
                {items.map((_, i) => (
                    <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                            currentIndex === i ? "w-6 bg-emerald-500" : "w-1.5 bg-gray-300"
                        }`}
                    />
                ))}
            </div>
        </section>
    );
}
