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
    const [currentIndex, setCurrentIndex] = useState(realLength);
    const scrollRef = useRef<HTMLDivElement>(null);
    const containerWidthRef = useRef<number>(0);
    const isScrollingRef = useRef(false);
    const [isInitialized, setIsInitialized] = useState(false);

    // 드래그/스와이프 관련 Ref
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);

    const renderItems = useMemo(() => (realLength <= 1 ? items : [...items, ...items, ...items]), [items, realLength]);

    useEffect(() => {
        if (!scrollRef.current || realLength <= 1) {
            if (realLength <= 1) setIsInitialized(true);
            return;
        }
        const container = scrollRef.current;
        const width = container.offsetWidth || container.clientWidth || window.innerWidth;
        containerWidthRef.current = width;

        // 🟢 초기 위치를 2번째 세트의 첫 번째로 설정 (순간이동)
        container.style.scrollBehavior = "auto";
        container.scrollLeft = width * realLength;
        setIsInitialized(true);

        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) containerWidthRef.current = entry.contentRect.width;
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, [realLength]);

    // 🟢 [핵심 수정] handleScroll은 인디케이터만 업데이트, 텔레포트는 moveToNext에서만 처리
    const handleScroll = useCallback(() => {
        const container = scrollRef.current;
        const width = containerWidthRef.current;
        if (!container || width <= 0 || realLength <= 1 || isScrollingRef.current) return;

        const scrollLeft = container.scrollLeft;
        // 🟢 Math.floor 사용하여 항상 "지나간 페이지 기준"으로 계산 (round 대신)
        const index = Math.floor(scrollLeft / width);

        // 🟢 현재 인덱스를 실제 아이템 인덱스로 변환 (0~realLength-1)
        const actualIndex = index % realLength;
        setCurrentIndex(actualIndex);
    }, [realLength]);

    // 🟢 페이지 전환 시에만 smooth 적용 + 텔레포트 로직 포함
    const moveToNext = useCallback(
        (nextIdx: number) => {
            if (!scrollRef.current || isScrollingRef.current) return;
            isScrollingRef.current = true;
            const width = containerWidthRef.current;
            const container = scrollRef.current;

            // 🟢 무한 스크롤을 위한 인덱스 조정
            // 2세트(realLength ~ realLength*2-1) 범위 내에서만 작동하도록 조정
            let adjustedIdx = nextIdx;

            // 🟢 경계값 체크: 3세트의 시작점(realLength * 2)을 넘어가면 2세트의 시작점(realLength)으로
            if (adjustedIdx >= realLength * 2) {
                adjustedIdx = realLength;
            }
            // 🟢 경계값 체크: 1세트의 끝점(realLength - 1) 이전으로 가면 2세트의 끝점(realLength * 2 - 1)으로
            else if (adjustedIdx < realLength) {
                adjustedIdx = realLength * 2 - 1;
            }

            container.style.scrollBehavior = "smooth";
            container.scrollTo({ left: adjustedIdx * width });

            // 🟢 스크롤 애니메이션이 끝난 후 텔레포트 체크 및 auto로 복원
            setTimeout(() => {
                const finalScrollLeft = container.scrollLeft;
                const finalIndex = Math.floor(finalScrollLeft / width);

                // 🟢 텔레포트: 경계값 근처에서 여유 범위를 두고 체크
                // 3세트 시작점 근처(realLength * 2 - 0.5 이하)에 도달하면 2세트로 순간 이동
                if (finalIndex >= realLength * 2 - 0.5) {
                    container.style.scrollBehavior = "auto";
                    const offset = finalScrollLeft - width * (realLength * 2);
                    container.scrollLeft = width * realLength + Math.max(0, offset);
                }
                // 1세트 끝점 근처(realLength + 0.5 이상)에 도달하면 2세트 끝으로 순간 이동
                else if (finalIndex <= realLength - 0.5) {
                    container.style.scrollBehavior = "auto";
                    const offset = finalScrollLeft - width * finalIndex;
                    container.scrollLeft = width * (realLength * 2 - 1) + offset;
                }

                isScrollingRef.current = false;
                container.style.scrollBehavior = "auto";
            }, 500);
        },
        [realLength]
    );

    // 🟢 [추가] 모바일 터치 스와이프 핸들러
    const onTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const onTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const onTouchEnd = useCallback(() => {
        if (!scrollRef.current || isScrollingRef.current) return;
        const width = containerWidthRef.current;
        const diff = touchStartX.current - touchEndX.current;
        const threshold = 50; // 50px 이상 밀었을 때만 작동

        if (Math.abs(diff) > threshold) {
            // 🟢 Math.floor 사용하여 일관된 인덱스 계산
            const currentIdx = Math.floor(scrollRef.current.scrollLeft / width);
            const nextIdx = diff > 0 ? currentIdx + 1 : currentIdx - 1;
            moveToNext(nextIdx);
        }
    }, [moveToNext]);

    const handleWheel = useCallback(
        (e: React.WheelEvent) => {
            if (!scrollRef.current || realLength <= 1 || isScrollingRef.current) return;
            e.preventDefault();
            const width = containerWidthRef.current;
            // 🟢 Math.floor 사용하여 일관된 인덱스 계산
            const currentIdx = Math.floor(scrollRef.current.scrollLeft / width);
            const nextIdx = (e.deltaX || e.deltaY) > 0 ? currentIdx + 1 : currentIdx - 1;
            moveToNext(nextIdx);
        },
        [realLength, moveToNext]
    );

    return (
        <section
            className={`relative w-full pb-6 pt-2 overflow-hidden min-h-[400px] transition-opacity duration-500 ${
                isInitialized ? "opacity-100" : "opacity-0"
            }`}
        >
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                onWheel={handleWheel}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 gap-3 will-change-scroll"
                style={{ scrollBehavior: "auto" }} // 기본은 항상 auto
            >
                {renderItems.map((item, idx) => (
                    <SliderItemComponent key={`${item.id}-${idx}`} item={item} idx={idx} />
                ))}
            </div>
            <div className="flex justify-center gap-1.5 mt-4">
                {items.map((_, i) => {
                    const actualIndex = currentIndex % realLength;
                    return (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                actualIndex === i ? "w-6 bg-emerald-500" : "w-1.5 bg-gray-300"
                            }`}
                        />
                    );
                })}
            </div>
        </section>
    );
}
