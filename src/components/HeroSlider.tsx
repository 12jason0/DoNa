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
 * 🟢 개별 슬라이드 아이템 (기능 유지 + 성능 극대화)
 */
const SliderItemComponent = memo(
    ({ item, idx, realLength, items }: { item: SliderItem; idx: number; realLength: number; items: SliderItem[] }) => {
        // 🟢 LCP 최적화: 중앙 세트의 첫 번째 슬라이드만 최우선 로드
        const isFirstVisible = idx === realLength || (items.length === 1 && idx === 0);

        // 🟢 가시성 기반 로딩: 인접 슬라이드는 eager, 나머지는 lazy 처리
        const isVisible = idx === realLength || idx === realLength - 1 || idx === realLength + 1;
        const shouldLoadEager = items.length === 1 || isVisible;

        return (
            <Link
                href={`/courses/${item.id}`}
                prefetch={true} // 🟢 성능 최적화: prefetch 추가
                draggable={false}
                className="relative min-w-full md:min-w-[400px] aspect-4/5 rounded-xl overflow-hidden snap-center border border-gray-100 active:scale-[0.98] transition-transform duration-200 block select-none"
            >
                <div className="relative w-full h-full pointer-events-none">
                    {item.imageUrl ? (
                        <Image
                            src={item.imageUrl}
                            alt={item.location || "Course Image"}
                            fill
                            className="object-cover"
                            // 🟢 [LCP 해결] 첫 화면 이미지는 priority와 eager를 함께 적용하여 경고를 제거합니다
                            priority={isFirstVisible}
                            loading={isFirstVisible ? "eager" : shouldLoadEager ? "eager" : "lazy"}
                            // 🟢 [500 에러 해결] 서버 연산 시간을 단축하기 위해 품질을 최적화된 범위(60, 50)로 조정합니다
                            // next.config.js의 qualities 설정과 일치해야 합니다.
                            quality={isFirstVisible ? 70 : 55}
                            // 🟢 [성능 최적화] 브라우저가 미리 공간을 계산하여 렉(Layout Shift)을 방지합니다
                            sizes="(max-width: 768px) 100vw, 400px"
                            fetchPriority={isFirstVisible ? "high" : "low"}
                            // 🟢 [모바일 최적화] WebP 형식 자동 변환 및 이미지 최적화 (Next.js Image 자동 처리)
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
                                        loading="lazy"
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

    // 🟢 [Optimization]: 너비를 ref에 저장하여 강제 리플로우 방지
    const containerWidthRef = useRef<number>(0);
    const realLength = items.length;

    // 🟢 [Optimization]: ResizeObserver를 사용하여 너비 캐싱 (브라우저 부하 최소화)
    useEffect(() => {
        if (!scrollRef.current) return;

        let isInitialized = false;
        let rafId: number | null = null;

        const observer = new ResizeObserver((entries) => {
            // 🟢 [Performance]: ResizeObserver 콜백을 requestAnimationFrame으로 감싸서 성능 최적화
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                for (let entry of entries) {
                    containerWidthRef.current = entry.contentRect.width;
                    // 초기 위치 설정 (1번 세트의 시작점) - 한 번만 실행
                    if (!isInitialized && realLength > 1 && scrollRef.current) {
                        isInitialized = true;
                        scrollRef.current.scrollTo({
                            left: containerWidthRef.current * realLength,
                            behavior: "auto",
                        });
                        setCurrentIndex(realLength);
                    }
                }
            });
        });

        observer.observe(scrollRef.current);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            observer.disconnect();
        };
    }, [realLength]);

    const renderItems = useMemo(() => (items.length > 1 ? [...items, ...items, ...items] : items), [items]);

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

                    // 무한 스크롤 루프 로직
                    if (scrollLeftVal >= width * (realLength * 2)) {
                        container.scrollTo({
                            left: width * realLength + (scrollLeftVal - width * (realLength * 2)),
                            behavior: "auto",
                        });
                    } else if (scrollLeftVal <= width * 0.5) {
                        container.scrollTo({
                            left: scrollLeftVal + width * realLength,
                            behavior: "auto",
                        });
                    }
                }
            }, 150); // 🟢 100ms -> 150ms로 증가하여 메인 스레드 부하 감소
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

    if (!items || items.length === 0) return null;

    return (
        <section className="relative w-full pb-6 pt-2 overflow-hidden">
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                onMouseDown={onMouseDown}
                onMouseLeave={() => setIsDragging(false)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={onMouseMove}
                className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 gap-3 cursor-grab active:cursor-grabbing will-change-scroll"
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
