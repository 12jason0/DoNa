"use client";

import React, { useState } from "react";
import Image from "@/components/ImageFallback";
import { useRouter } from "next/navigation"; // 1. 라우터 임포트

export type SliderItem = {
    id: string;
    imageUrl?: string;
    location?: string;
    concept?: string;
    tags?: string[];
};

type HeroSliderProps = {
    items: SliderItem[];
};

export default function HeroSlider({ items }: HeroSliderProps) {
    const router = useRouter(); // 2. 라우터 사용
    const [currentSlide, setCurrentSlide] = useState(0);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchDeltaX, setTouchDeltaX] = useState(0);
    const [isTouching, setIsTouching] = useState(false);

    // 4초 자동 슬라이드 (터치 시 멈춤)
    React.useEffect(() => {
        const total = items.length > 0 ? Math.min(5, items.length) : 0;
        if (total <= 1 || isTouching) return;

        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % total);
        }, 3000);

        return () => clearInterval(timer);
    }, [isTouching, items.length]);

    // ✅ 상세 페이지 이동 함수
    const navigateToDetail = () => {
        if (items[currentSlide]?.id) {
            // [중요] 이동할 경로 설정 (예: /course/코스ID)
            router.push(`/courses/${items[currentSlide].id}`);
        }
    };

    return (
        <section className="relative px-4 pb-6">
            <div
                // cursor-grab -> cursor-pointer로 변경 (클릭 가능하다는 느낌)
                className="relative w-full h-[320px] overflow-hidden rounded-xl bg-gray-200 cursor-pointer select-none shadow-sm"
                style={{
                    transform: `translateX(${touchDeltaX * 0.15}px)`,
                    transition: isTouching ? "none" : "transform 300ms ease",
                }}
                // --- 터치 이벤트 핸들링 ---
                onTouchStart={(e) => {
                    if (e.touches && e.touches.length > 0) {
                        setTouchStartX(e.touches[0].clientX);
                        setTouchDeltaX(0);
                        setIsTouching(true);
                    }
                }}
                onTouchMove={(e) => {
                    if (touchStartX !== null && e.touches && e.touches.length > 0) {
                        setTouchDeltaX(e.touches[0].clientX - touchStartX);
                    }
                }}
                onTouchEnd={() => {
                    const threshold = 40;
                    const total = items.length > 0 ? Math.min(5, items.length) : 0;

                    if (total === 0) return;

                    if (touchDeltaX > threshold) {
                        // 오른쪽으로 스와이프 (이전 슬라이드)
                        setCurrentSlide((prev) => (prev - 1 + total) % total);
                    } else if (touchDeltaX < -threshold) {
                        // 왼쪽으로 스와이프 (다음 슬라이드)
                        setCurrentSlide((prev) => (prev + 1) % total);
                    } else if (Math.abs(touchDeltaX) < 5) {
                        // ✅ [NEW] 움직임이 거의 없으면(5px 미만) 클릭으로 간주 -> 이동
                        navigateToDetail();
                    }

                    setTouchStartX(null);
                    setTouchDeltaX(0);
                    setIsTouching(false);
                }}
                // --- 마우스 이벤트 핸들링 ---
                onMouseDown={(e) => {
                    e.preventDefault(); // 이미지 드래그 방지
                    setTouchStartX(e.clientX);
                    setTouchDeltaX(0);
                    setIsTouching(true);
                }}
                onMouseMove={(e) => {
                    if (isTouching && touchStartX !== null) {
                        setTouchDeltaX(e.clientX - touchStartX);
                    }
                }}
                onMouseLeave={() => {
                    if (!isTouching) return;
                    // 마우스가 영역을 벗어나면 스와이프 처리만 하고 클릭은 무시
                    const threshold = 40;
                    const total = items.length > 0 ? Math.min(5, items.length) : 0;
                    if (total !== 0) {
                        if (touchDeltaX > threshold) {
                            setCurrentSlide((prev) => (prev - 1 + total) % total);
                        } else if (touchDeltaX < -threshold) {
                            setCurrentSlide((prev) => (prev + 1) % total);
                        }
                    }
                    setTouchStartX(null);
                    setTouchDeltaX(0);
                    setIsTouching(false);
                }}
                onMouseUp={() => {
                    if (!isTouching) return;
                    const threshold = 40;
                    const total = items.length > 0 ? Math.min(5, items.length) : 0;

                    if (total !== 0) {
                        if (touchDeltaX > threshold) {
                            setCurrentSlide((prev) => (prev - 1 + total) % total);
                        } else if (touchDeltaX < -threshold) {
                            setCurrentSlide((prev) => (prev + 1) % total);
                        } else if (Math.abs(touchDeltaX) < 5) {
                            // ✅ [NEW] 마우스 클릭(드래그 없이) 시 이동
                            navigateToDetail();
                        }
                    }
                    setTouchStartX(null);
                    setTouchDeltaX(0);
                    setIsTouching(false);
                }}
            >
                <div className="absolute inset-0">
                    {items.map((item, index) => (
                        <div
                            key={item.id}
                            className={`absolute inset-0 transition-all duration-500 ease-in-out ${
                                index === currentSlide ? "opacity-100 z-20" : "opacity-0 z-10"
                            }`}
                        >
                            {/* 이미지 */}
                            <div className="absolute inset-0">
                                <Image
                                    src={item.imageUrl || ""}
                                    alt={item.location || "slide"}
                                    fill
                                    priority={index === 0}
                                    sizes="(max-width: 768px) 100vw, 800px"
                                    className="object-cover"
                                />
                                {/* 그라데이션 오버레이 */}
                                <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                            </div>

                            {/* 텍스트 내용 (왼쪽 정렬) */}
                            <div className="absolute bottom-5 left-5 text-left z-30 pr-4">
                                <span className="bg-black/40 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full mb-2 inline-block font-medium">
                                    {index + 1} / {items.length || 1}
                                </span>
                                <h2 className="text-white text-2xl font-bold drop-shadow-sm leading-tight">
                                    {item.location}
                                </h2>
                                <div className="text-gray-200 text-sm mt-1 font-medium flex gap-2">
                                    <span>#{item.concept}</span>
                                    {Array.isArray(item.tags) && item.tags.length > 0 && (
                                        <span className="opacity-90">#{item.tags[0]}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
