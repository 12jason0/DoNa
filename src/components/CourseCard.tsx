"use client";

import Link from "next/link";
import Image from "@/components/ImageFallback";
import React, { useState } from "react";
import { CONCEPTS } from "@/constants/onboardingData";
import CourseLockOverlay from "./CourseLockOverlay";
import TicketPlans from "@/components/TicketPlans";
import LoginModal from "@/components/LoginModal";
import { useRouter } from "next/navigation";

interface PlaceClosedDay {
    day_of_week: number | null;
    specific_date: Date | string | null;
    note?: string | null;
}

interface Place {
    id: number;
    name: string;
    imageUrl?: string;
    latitude?: number;
    longitude?: number;
    opening_hours?: string | null;
    closed_days?: PlaceClosedDay[];
    // 캐치테이블 예약 URL 필드
    reservationUrl?: string | null;
}

interface CoursePlace {
    order_index: number;
    place: Place | null;
}

export interface CourseCardProps {
    course: {
        id: string;
        title: string;
        description?: string;
        imageUrl?: string;
        concept?: string;
        region?: string;
        location?: string;
        duration?: string;
        viewCount?: number;
        reviewCount?: number;
        rating?: number;
        grade?: "FREE" | "BASIC" | "PREMIUM";
        isLocked?: boolean;
        coursePlaces?: CoursePlace[];
    };
    isPriority?: boolean; // LCP 최적화를 위해 상단 이미지는 priority=true
    onToggleFavorite: (e: React.MouseEvent, courseId: string | number) => void;
    isFavorite: boolean;
    hasClosedPlace?: (course: any) => boolean;
    getClosedPlaceCount?: (course: any) => number;
    showNewBadge?: boolean;
}

const PlaceholderImage = () => (
    <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center text-gray-300">
        <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round" // 중복 제거됨
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
        </svg>
        <span className="text-xs font-medium opacity-70">DoNa</span>
    </div>
);

export default function CourseCard({
    course,
    isPriority = false,
    onToggleFavorite,
    isFavorite,
    hasClosedPlace,
    getClosedPlaceCount,
    showNewBadge = true,
}: CourseCardProps) {
    const rawConcept = course.concept?.split(",")[0] || "";
    const displayConcept = CONCEPTS[rawConcept as keyof typeof CONCEPTS] || rawConcept;
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const router = useRouter();

    // 코스 내 장소 중 하나라도 예약 링크가 있는지 확인
    const hasReservation = course.coursePlaces?.some((cp) => cp.place?.reservationUrl);

    // 예약 링크가 있는 첫 번째 장소의 예약 URL 가져오기
    const reservationUrl = course.coursePlaces?.find((cp) => cp.place?.reservationUrl)?.place?.reservationUrl;

    // 내부 잠금 클릭 핸들러
    const handleLockedClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // 보안 강화: LocalStorage 대신 서버 세션 기반 인증 확인
        try {
            const { fetchSession } = await import("@/lib/authClient");
            const session = await fetchSession();
            if (!session.authenticated) {
                // 비로그인 상태: LoginModal 표시
                setShowLoginModal(true);
                return;
            }

            // 로그인 상태: 결제 모달 오픈
            setShowSubscriptionModal(true);
        } catch (error) {
            console.error("로그인 상태 확인 실패:", error);
            setShowLoginModal(true);
        }
    };

    // 조회수 포맷팅
    const formatViewCount = (views: number) => {
        if (views >= 10000) return `${(views / 10000).toFixed(views % 10000 ? 1 : 0)}만`;
        if (views >= 1000) return `${(views / 1000).toFixed(views % 1000 ? 1 : 0)}천`;
        return `${views}`;
    };

    return (
        <div className="block group relative cursor-pointer">
            {/* Link or Div based on Lock status */}
            {course.isLocked ? (
                <div onClick={handleLockedClick} className="absolute inset-0 z-[15] cursor-pointer" />
            ) : (
                <Link
                    href={`/courses/${course.id}`}
                    prefetch={true}
                    className="absolute inset-0 z-[25]"
                    onClick={() => {
                        try {
                            // 성능 최적화: 불필요한 헤더 없이 데이터만 전달
                            fetch(`/api/courses/${course.id}/view`, {
                                method: "POST",
                                keepalive: true,
                            }).catch(() => {});
                        } catch {}
                    }}
                />
            )}

            {/* Image Section */}
            <div className="relative w-full aspect-[4/3] rounded-[20px] overflow-hidden bg-gray-100 mb-3 shadow-sm border border-gray-100">
                {course.imageUrl ? (
                    <Image
                        src={course.imageUrl}
                        alt={course.title}
                        fill
                        className={`object-cover transition-transform duration-700 group-hover:scale-105 ${
                            course.isLocked ? "blur-[2px] grayscale-[0.5]" : ""
                        }`}
                        sizes="(max-width: 768px) 100vw, 500px"
                        priority={isPriority}
                        loading={isPriority ? undefined : "lazy"} // 🟢 priority가 없으면 lazy
                        quality={isPriority ? 75 : 60} // 🟢 priority 이미지는 높은 품질, 나머지는 낮은 품질로 빠른 로딩
                        fetchPriority={isPriority ? "high" : "auto"} // 🟢 priority 이미지만 high
                    />
                ) : (
                    <PlaceholderImage />
                )}

                {course.isLocked && <CourseLockOverlay grade={course.grade} />}

                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>

                {hasClosedPlace && getClosedPlaceCount && hasClosedPlace(course) && (
                    <div className="absolute bottom-3 right-3 z-10">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur-sm border border-red-100">
                            <span className="text-[12px] font-bold text-red-600 leading-none">
                                {getClosedPlaceCount(course)}곳 휴무
                            </span>
                        </div>
                    </div>
                )}

                {/* Badges Section - z-index를 30으로 높여 오버레이 위로 올림 */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-[20] pointer-events-auto">
                    {/* 캐치테이블 예약 배지 (상업적 유도) */}
                    {hasReservation && (
                        <span className="bg-[#00b3a3] text-white text-[10px] px-2 py-1 rounded-md font-bold shadow-sm border border-[#00a394] flex items-center gap-1">
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" />
                            </svg>
                            실시간 예약
                        </span>
                    )}

                    {!course.isLocked && course.grade && course.grade !== "FREE" && (
                        <span className="bg-emerald-600 text-white text-[10px] px-2 py-1 rounded-md font-bold shadow-sm border border-emerald-500">
                            {course.grade}
                        </span>
                    )}
                    <span className="bg-black/40 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md font-medium border border-white/10">
                        #{displayConcept}
                    </span>
                    {showNewBadge && course.reviewCount === 0 && (
                        <span className="bg-[#7aa06f] text-white text-[10px] px-2 py-1 rounded-md font-bold">NEW</span>
                    )}
                </div>
            </div>

            {/* Favorite Button */}
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleFavorite(e, course.id);
                }}
                className="absolute top-3 right-3 z-[20] flex items-center justify-center w-11 h-11 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/50 transition-all active:scale-90"
            >
                <svg
                    className={`w-7 h-7 drop-shadow-sm transition-colors ${
                        isFavorite ? "text-red-500 fill-red-500" : "text-white"
                    }`}
                    fill={isFavorite ? "currentColor" : "none"}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                </svg>
            </button>

            {/* Info Section */}
            <div className="px-1 pt-1">
                <div className="flex flex-wrap gap-2 mb-3">
                    {(course.region || course.location) && (
                        <span className="inline-block px-2 py-1 bg-gray-100 rounded-md text-[13px] font-bold text-gray-600">
                            #{course.region || course.location}
                        </span>
                    )}
                    {course.duration ? (
                        <span className="inline-block px-2 py-1 bg-gray-100 rounded-md text-[13px] font-bold text-gray-600">
                            #{course.duration}
                        </span>
                    ) : null}
                </div>
                <h3 className="text-[18px] font-bold text-gray-900 leading-snug mb-2 group-hover:text-gray-700 transition-colors break-keep line-clamp-2 tracking-tight">
                    {course.title}
                </h3>
                <div className="text-xs font-medium">
                    {(() => {
                        const views = Number(course.viewCount || 0);
                        if (views >= 1000) {
                            return (
                                <span className="text-orange-600 font-bold">
                                    👀 {formatViewCount(views)}명이 보는 중
                                </span>
                            );
                        }
                        if (course.reviewCount && course.reviewCount > 0) {
                            return (
                                <span className="text-gray-700">
                                    ★ {course.rating} ({course.reviewCount})
                                </span>
                            );
                        }
                        return null;
                    })()}
                </div>
            </div>
            {/* 결제 및 로그인 모달 */}
            {showSubscriptionModal && <TicketPlans onClose={() => setShowSubscriptionModal(false)} />}
            {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} next={`/courses/${course.id}`} />}
        </div>
    );
}
