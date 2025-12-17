"use client";

import { useState, useRef, useEffect } from "react";
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

export default function HeroSlider({ items }: HeroSliderProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // --- Mouse Drag State ---
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    // 3배수 렌더링 (무한 스크롤용)
    const renderItems = items.length > 1 ? [...items, ...items, ...items] : items;
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

    // 무한 스크롤 보정 로직 (onScroll에서 처리)
    const handleScroll = () => {
        if (scrollRef.current && realLength > 1) {
            const scrollLeftVal = scrollRef.current.scrollLeft;
            const width = scrollRef.current.offsetWidth;
            const maxScroll = scrollRef.current.scrollWidth - width;
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
            else if (scrollLeftVal <= width * (realLength - 1)) {
                // 약간의 여유를 두고 점프 (정확히 realLength - 1일 때 점프하면 드래그 시 튈 수 있음)
                // 여기서는 0에 가까워지면 점프하도록 설정
                if (scrollLeftVal <= width * 0.5) {
                    const relativeOffset = width * realLength;
                    scrollRef.current.scrollTo({
                        left: scrollLeftVal + relativeOffset,
                        behavior: "auto",
                    });
                }
            }
        }
    };

    // --- Mouse Drag Handlers (복원됨) ---
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
            const walk = (x - startX) * 2; // scroll-fast
            scrollRef.current.scrollLeft = scrollLeft - walk;
        }
    };

    // 자동 스크롤
    useEffect(() => {
        if (realLength <= 1) return;

        const interval = setInterval(() => {
            if (scrollRef.current) {
                const width = scrollRef.current.offsetWidth;
                const nextIndex = currentIndex + 1;

                scrollRef.current.scrollTo({
                    left: width * nextIndex,
                    behavior: "smooth",
                });
                // setCurrentIndex는 onScroll에서 업데이트됨
            }
        }, 4000);

        return () => clearInterval(interval);
    }, [currentIndex, realLength]);

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
                    <Link
                        key={`${item.id}-${idx}`} // 고유 키 생성
                        href={`/courses/${item.id}`}
                        draggable={false} // Prevent native drag
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
                                    priority={items.length > 1 ? idx === realLength : idx === 0} // Prioritize loading the first image
                                    sizes="(max-width: 768px) 100vw, 400px"
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                                    No Image
                                </div>
                            )}

                            {/* Gradient Overlay: Transparent to Dark */}
                            <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/80" />
                        </div>

                        {/* Content Overlay */}
                        <div className="absolute bottom-0 left-0 w-full p-6 text-white z-10">
                            {/* Badge Area with Glassmorphism */}
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                {/* Location Badge */}
                                {item.location && (
                                    <span className="bg-white/20 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-xs font-semibold text-white tracking-wide">
                                        📍 {item.location}
                                    </span>
                                )}

                                {/* Concept Badge with Icon */}
                                {item.concept && (
                                    <span className="bg-emerald-500/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1 tracking-tight">
                                        {item.conceptIcon && (
                                            <Image
                                                src={item.conceptIcon}
                                                width={14}
                                                height={14}
                                                alt="icon"
                                                className="invert brightness-0" // Invert color for white icon
                                            />
                                        )}
                                        {item.concept}
                                    </span>
                                )}
                            </div>

                            {/* Main Title / Catchphrase */}
                            <h4 className="text-xl font-extrabold leading-tight drop-shadow-sm mb-1 line-clamp-2 tracking-tight">
                                {/* Fallback to location or tags for title if needed */}
                                {item.title ||
                                    (item.tags?.[0]
                                        ? `#${item.tags[0]} 핫플레이스`
                                        : `${item.location || "이곳"}의 매력`)}
                            </h4>

                            {/* Subtitle / Hash Tags */}
                            <p className="text-sm text-gray-200 font-medium opacity-90 line-clamp-1">
                                {item.tags?.map((t) => `#${t}`).join(" ")}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
