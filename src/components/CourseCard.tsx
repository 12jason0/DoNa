"use client";

import Link from "next/link";
import Image from "@/components/ImageFallback";
import React, { useState, memo, useMemo, useEffect } from "react"; // memo, useMemo 추가
import { useLocale } from "@/context/LocaleContext";
import { translateCourseConcept } from "@/lib/courseTranslate";
import { useTranslatedTitle } from "@/hooks/useTranslatedTitle";
import { pickCourseDescription, pickCourseTitle } from "@/lib/courseLocalized";
import CourseLockOverlay from "./CourseLockOverlay";
import TicketPlans from "@/components/TicketPlans";
import LoginModal from "@/components/LoginModal";
import { useRouter } from "next/navigation";
import { isIOS } from "@/lib/platform";
import { useAuth } from "@/context/AuthContext";
import { localeToBcp47 } from "@/lib/localeBcp47";

// --- Interfaces (기존과 동일) ---
interface PlaceClosedDay {
    day_of_week: number | null;
    specific_date: Date | string | null;
    note?: string | null;
}

interface Place {
    id?: number;
    name?: string;
    imageUrl?: string;
    latitude?: number;
    longitude?: number;
    opening_hours?: string | null;
    closed_days?: PlaceClosedDay[];
    reservationUrl?: string | null;
    address?: string;
    category?: string;
}

interface CoursePlace {
    order_index: number;
    place: Place | null;
}

export interface CourseCardProps {
    course: {
        id: string;
        title: string;
        title_en?: string | null;
        title_ja?: string | null;
        title_zh?: string | null;
        sub_title?: string;
        description?: string;
        description_en?: string | null;
        description_ja?: string | null;
        description_zh?: string | null;
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
        placesCount?: number; // 🟢 [Fix]: API에서 전달받은 장소 개수
    };
    isPriority?: boolean;
    onToggleFavorite: (e: React.MouseEvent, courseId: string | number) => void;
    isFavorite: boolean;
    hasClosedPlace?: (course: any) => boolean;
    getClosedPlaceCount?: (course: any) => number;
    showNewBadge?: boolean;
}

function formatCompactViews(views: number, locale: string): string {
    return new Intl.NumberFormat(localeToBcp47(locale), {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(views);
}

// --- Helper Functions (컴포넌트 외부로 분리하여 메모리 최적화) ---
const PlaceholderImage = memo(() => (
    <div className="w-full h-full bg-gray-50 dark:bg-gray-800 flex flex-col items-center justify-center text-gray-300 dark:text-gray-500">
        <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
        </svg>
        <span className="text-xs font-medium opacity-70">DoNa</span>
    </div>
));
PlaceholderImage.displayName = "PlaceholderImage";

// --- Main Component (memo 적용) ---
const CourseCard = memo(
    ({
        course,
        isPriority = false,
        onToggleFavorite,
        isFavorite,
        hasClosedPlace,
        getClosedPlaceCount,
        showNewBadge = true,
    }: CourseCardProps) => {
        const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
        const [showLoginModal, setShowLoginModal] = useState(false);
        const [platform, setPlatform] = useState<"ios" | "android" | "web">("web");
        const router = useRouter();
        const { isAuthenticated } = useAuth();
        const { t, locale } = useLocale();
        const hasDbTranslation = locale === "ko"
            || (locale === "en" && !!course.title_en?.trim())
            || (locale === "ja" && !!course.title_ja?.trim())
            || (locale === "zh" && !!course.title_zh?.trim());
        const translatedTitleByApi = useTranslatedTitle(hasDbTranslation ? null : course.title, locale);
        const translatedTitle = hasDbTranslation
            ? pickCourseTitle(course, locale)
            : (translatedTitleByApi || course.title);
        const translatedSubTitle = useTranslatedTitle(course.sub_title || "", locale);
        const translatedDescription = pickCourseDescription(course, locale) || course.description || "";
        const displayConcept = translateCourseConcept(course.concept, t as (k: string) => string);

        // 🟢 iOS 플랫폼 감지
        useEffect(() => {
            setPlatform(isIOS() ? "ios" : "web");
        }, []);

        // [Optimization] 장소 데이터(예약 가능 여부) 순회 로직 메모이제이션 (개선: 빈 문자열 체크 추가)
        const reservationInfo = useMemo(() => {
            // 🟢 가독성과 정확성을 위해 필터링 후 첫 번째 유효한 URL을 찾음
            const validPlace = course.coursePlaces?.find(
                (cp) => cp.place?.reservationUrl && cp.place.reservationUrl.trim() !== "",
            );

            return {
                hasReservation: !!validPlace,
                reservationUrl: validPlace?.place?.reservationUrl || null,
            };
        }, [course.coursePlaces]);

        // [Optimization] 조회수 포맷팅 및 하단 정보 텍스트 연산 메모이제이션
        const infoDisplay = useMemo(() => {
            const views = Number(course.viewCount || 0);
            if (views >= 1000) {
                const compact = formatCompactViews(views, locale);
                return { type: "views" as const, content: t("courses.viewsWatching", { compact }) };
            }
            if (course.reviewCount && course.reviewCount > 0) {
                return { type: "rating" as const, content: `★ ${course.rating} (${course.reviewCount})` };
            }
            return null;
        }, [course.viewCount, course.reviewCount, course.rating, t, locale]);

        // [Optimization] 실제 유효한 장소 개수 연산 메모이제이션
        const validPlacesCount = useMemo(() => {
            // 🟢 [Fix]: API에서 전달받은 placesCount가 있으면 우선 사용
            if (course.placesCount !== undefined && course.placesCount > 0) {
                return course.placesCount;
            }

            // coursePlaces가 없거나 빈 배열인 경우 처리
            if (!course.coursePlaces || !Array.isArray(course.coursePlaces)) return 0;

            // place 객체가 실제로 존재하는 항목만 필터링
            return course.coursePlaces.filter((cp) => cp && cp.place && cp.place.id !== undefined).length;
        }, [course.coursePlaces, course.placesCount]);

        // 잠금 상태 클릭 핸들러: 미로그인 → 로그인 모달, 로그인 → TicketPlans
        const handleLockedClick = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (!isAuthenticated) {
                setShowLoginModal(true);
            } else {
                setShowSubscriptionModal(true);
            }
        };

        return (
            <div className="block group relative cursor-pointer pb-3">
                {/* 잠금 여부에 따른 레이어 (기존 로직 유지) */}
                {course.isLocked ? (
                    <div onClick={handleLockedClick} className="absolute inset-0 z-15 cursor-pointer" />
                ) : (
                    <Link
                        href={`/courses/${course.id}`}
                        prefetch={true}
                        className="absolute inset-0 z-10"
                        onClick={() => {
                            try {
                                fetch(`/api/courses/${course.id}/view`, {
                                    method: "POST",
                                    keepalive: true,
                                }).catch(() => {});
                            } catch {}
                        }}
                    />
                )}

                {/* 이미지 섹션 */}
                <div className="relative w-full aspect-4/3 rounded-[20px] overflow-hidden bg-gray-100 dark:bg-gray-800 mb-3 shadow-sm border border-gray-100 dark:border-transparent">
                    {course.imageUrl ? (
                        <Image
                            src={course.imageUrl}
                            alt={course.title || t("courses.noTitle")}
                            fill
                            className={`object-cover transition-transform duration-700 group-hover:scale-105 ${
                                course.isLocked ? "blur-[2px] grayscale-[0.5]" : ""
                            }`}
                            sizes="(max-width: 768px) 100vw, 500px"
                            priority={isPriority}
                            loading={isPriority ? undefined : "lazy"}
                            quality={isPriority ? 75 : 60}
                            fetchPriority={isPriority ? "high" : "auto"}
                        />
                    ) : (
                        <PlaceholderImage />
                    )}

                    {course.isLocked && <CourseLockOverlay grade={course.grade} />}

                    <div className="absolute inset-0 bg-linear-to-t from-black/20 via-transparent to-transparent"></div>

                    {/* 휴무 장소 안내 (기존 기능 유지) */}
                    {hasClosedPlace && getClosedPlaceCount && hasClosedPlace(course) && (
                        <div className="absolute bottom-3 right-3 z-10">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur-sm border border-red-100">
                                <span className="text-[12px] font-bold text-red-600 leading-none">
                                    {t("courseCard.placesClosed", { n: getClosedPlaceCount(course) })}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* 배지 섹션 */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-20 pointer-events-auto">
                        {reservationInfo.hasReservation && (
                            <span className="bg-[#00b3a3] text-white text-[10px] px-2 py-1 rounded-md font-bold shadow-sm border border-[#00a394] flex items-center gap-1">
                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" />
                                </svg>
                                {t("courseCard.realtimeReservation")}
                            </span>
                        )}

                        {/* Web만 등급 배지 표시 (iOS/Android는 숨김) */}
                        {platform === "web" && !course.isLocked && course.grade && course.grade !== "FREE" && (
                            <span className="bg-emerald-600 text-white text-[10px] px-2 py-1 rounded-md font-bold shadow-sm border border-emerald-500">
                                {course.grade}
                            </span>
                        )}
                        <span className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded-md font-bold border border-gray-700">
                            #{displayConcept}
                        </span>
                        {showNewBadge && course.reviewCount === 0 && (
                            <span className="bg-[#7aa06f] text-white text-[10px] px-2 py-1 rounded-md font-bold">
                                NEW
                            </span>
                        )}
                    </div>
                </div>

                {/* 좋아요 버튼 */}
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleFavorite(e, course.id);
                    }}
                    className="absolute top-3 right-3 z-20 flex items-center justify-center w-11 h-11 rounded-full bg-gray-900 hover:bg-gray-800 transition-all active:scale-90 border border-gray-700"
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

                {/* 정보 섹션 */}
                <div className="px-1 pt-1">
                    {/* 1. 제목과 설명 영역 */}
                    <div className="mb-2">
                        <h3 className="text-[17px] font-medium text-gray-900 dark:text-white leading-tight">
                            {(course.sub_title ? translatedSubTitle : translatedTitle) || course.sub_title || course.title || t("courses.noTitle")}
                        </h3>
                        {translatedDescription && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{translatedDescription}</p>
                        )}
                        {course.sub_title && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-light mt-1 opacity-90 line-clamp-1">
                                {translatedTitle || course.title || t("courses.noTitle")}
                            </p>
                        )}
                    </div>

                    {/* 2. 하단 메타 태그 영역 */}
                    <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                        {infoDisplay && <span>{infoDisplay.content}</span>}
                        {infoDisplay && (course.region || course.location || validPlacesCount > 0 || course.duration) && (
                            <span className="w-0.5 h-0.5 bg-gray-400 rounded-full shrink-0" />
                        )}
                        {/* 지역 */}
                        {(course.region || course.location) && (
                            <div className="flex items-center gap-1">
                                <span>📍</span>
                                <span>{course.region || course.location}</span>
                            </div>
                        )}

                        {/* 구분선 (점) */}
                        {(course.region || course.location) && validPlacesCount > 0 && (
                            <span className="w-0.5 h-0.5 bg-gray-400 rounded-full shrink-0"></span>
                        )}

                        {/* 스팟 수 */}
                        {validPlacesCount > 0 && (
                            <span>{t("courses.metaSpots", { count: validPlacesCount, spots: t("courseDetail.spots") })}</span>
                        )}

                        {/* 구분선 */}
                        {validPlacesCount > 0 && course.duration && (
                            <span className="w-0.5 h-0.5 bg-gray-400 rounded-full shrink-0"></span>
                        )}

                        {/* 소요 시간 */}
                        {course.duration && (
                            <div className="flex items-center gap-1">
                                <span>⏳</span>
                                <span>{course.duration}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 모달 섹션 - 웹·앱 모두 TicketPlans 표시 */}
                {showSubscriptionModal && (
                    <TicketPlans
                        courseId={Number(course.id)}
                        courseGrade={(course.grade || "BASIC").toUpperCase() === "PREMIUM" ? "PREMIUM" : "BASIC"}
                        onClose={() => setShowSubscriptionModal(false)}
                    />
                )}
                {showLoginModal && (
                    <LoginModal
                        onClose={() => setShowLoginModal(false)}
                        next={`/courses/${course.id}`}
                        preset="courseDetail"
                    />
                )}
            </div>
        );
    },
);

CourseCard.displayName = "CourseCard";
export default CourseCard;
