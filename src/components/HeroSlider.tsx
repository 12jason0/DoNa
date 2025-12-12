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

    // Update current index based on scroll position
    const handleScroll = () => {
        if (scrollRef.current) {
            const scrollLeftVal = scrollRef.current.scrollLeft;
            const width = scrollRef.current.offsetWidth;
            const index = Math.round(scrollLeftVal / width);
            setCurrentIndex(index);
        }
    };

    // --- Mouse Drag Handlers ---
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

    // Auto-scroll functionality (pauses on user interaction implicitly via scroll position check)
    useEffect(() => {
        const interval = setInterval(() => {
            if (scrollRef.current) {
                // Calculate next index, looping back to 0 at the end
                const isEnd = currentIndex === items.length - 1;
                const nextIndex = isEnd ? 0 : currentIndex + 1;
                const width = scrollRef.current.offsetWidth;

                scrollRef.current.scrollTo({
                    left: width * nextIndex,
                    behavior: "smooth",
                });
            }
        }, 4000); // 4-second interval

        return () => clearInterval(interval);
    }, [currentIndex, items.length]);

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
                {items.map((item, idx) => (
                    <Link
                        key={item.id}
                        href={`/courses/${item.id}`}
                        draggable={false} // Prevent native drag
                        className="relative min-w-[100%] md:min-w-[400px] aspect-[4/5] rounded-[2rem] overflow-hidden snap-center shadow-lg active:scale-[0.98] transition-transform duration-200 block select-none"
                    >
                        {/* Background Image */}
                        <div className="relative w-full h-full pointer-events-none">
                            {item.imageUrl ? (
                                <Image
                                    src={item.imageUrl}
                                    alt={item.location || "Course Image"}
                                    fill
                                    className="object-cover"
                                    priority={idx === 0} // Prioritize loading the first image
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
                                    <span className="bg-emerald-500/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1 shadow-sm">
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
                            <h3 className="text-2xl font-extrabold leading-tight drop-shadow-sm mb-1 line-clamp-2">
                                {/* Fallback to location or tags for title if needed */}
                                {item.tags?.[0] ? `#${item.tags[0]} 핫플레이스` : `${item.location || "이곳"}의 매력`}
                            </h3>

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
