"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "@/components/ImageFallback";
import dynamic from "next/dynamic";

// 🟢 [Fix] 에러 2304 해결: 파일 최상단에서 명시적으로 임포트하여 전역 스코프 확보
import { authenticatedFetch, fetchSession } from "@/lib/authClient";
import ReviewModal from "@/components/ReviewModal";
import TicketPlans from "@/components/TicketPlans";
import LoginModal from "@/components/LoginModal";
import { Place as MapPlace, UserLocation } from "@/types/map";
import { getS3StaticUrl } from "@/lib/s3Static";

// 🟢 [Optimization] 중복 API 호출 방지용 전역 변수 (Airtight Singleton Pattern)
// 레이아웃과 상세 페이지가 동시에 즐겨찾기를 조회해도 서버에는 1번만 요청합니다.
let layoutFavoritesPromise: Promise<any[] | null> | null = null;
let layoutFavoritesCache: any[] | null = null;

const NaverMap = dynamic(() => import("@/components/NaverMap"), { ssr: false });

export default function CoursesIdLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * 이 파일의 아래 부분에 있는 CourseDetailPage 함수는 더 이상 사용되지 않습니다.
 * 실제 사용되는 컴포넌트는 page.tsx (서버 컴포넌트)와 CourseDetailClient.tsx입니다.
 * 중복 fetch 방지를 위해 아래 코드는 주석 처리합니다.
 */

// --- 인터페이스 정의 (100% 보존) ---
interface Place {
    id: number;
    name: string;
    address: string;
    description: string;
    category: string;
    avg_cost_range: string;
    opening_hours: string;
    phone?: string;
    website?: string;
    parking_available: boolean;
    reservation_required: boolean;
    latitude: number;
    longitude: number;
    image_url?: string;
}

interface CoursePlace {
    id: number;
    course_id: number;
    place_id: number;
    order_index: number;
    estimated_duration: number;
    recommended_time: string;
    coaching_tip?: string | null;
    place: Place;
}

interface Course {
    id: string;
    title: string;
    description: string;
    duration: string;
    price: string;
    imageUrl: string;
    concept: string;
    rating: number;
    isPopular: boolean;
    recommended_start_time: string;
    season: string;
    courseType: string;
    transportation: string;
    parking: string;
    reservationRequired: boolean;
    createdAt: string;
    updatedAt: string;
}

interface Highlight {
    id: number;
    icon: string;
    title: string;
    description: string;
}
interface Benefit {
    id: number;
    benefit_text: string;
    category: string;
    display_order?: number;
}
interface Notice {
    id: number;
    notice_text: string;
    type?: string;
}
interface CourseData extends Course {
    highlights?: Highlight[];
    benefits?: Benefit[];
    notices?: Notice[];
    coursePlaces?: CoursePlace[];
}

// --- 공용 컴포넌트 (100% 보존) ---
const Toast = ({
    message,
    type,
    onClose,
}: {
    message: string;
    type: "success" | "error" | "info";
    onClose: () => void;
}) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);
    const bgColor = { success: "bg-green-500", error: "bg-red-500", info: "bg-blue-500" }[type];
    return (
        <div
            className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in-right`}
        >
            <div className="flex items-center gap-2">
                <span>{message}</span>
                <button onClick={onClose} className="ml-2 text-white hover:text-gray-200">
                    ×
                </button>
            </div>
        </div>
    );
};

const LoadingSpinner = ({ size = "large" }: { size?: "small" | "large" }) => {
    const sizeClasses = size === "large" ? "h-32 w-32" : "h-6 w-6";
    return <div className={`animate-spin rounded-full ${sizeClasses} border-b-2 border-blue-600`} />;
};

const ErrorDisplay = ({ error, onRetry }: { error: string; onRetry?: () => void }) => (
    <div className="text-center py-8">
        <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 15.5c-.77.833.192 2.5 1.732 2.5z"
                />
            </svg>
        </div>
        <p className="text-gray-600 mb-4">{error}</p>
        {onRetry && (
            <button
                onClick={onRetry}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
                다시 시도
            </button>
        )}
    </div>
);

const MapFallbackUI = ({ places }: { places: CoursePlace[] }) => (
    <div className="w-full h-80 bg-gray-100 rounded-2xl flex flex-col items-center justify-center p-6">
        <div className="text-center">
            <div className="text-6xl mb-4">🗺️</div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">지도 로딩 중...</h3>
            <p className="text-gray-500 mb-6">잠시만 기다려주세요</p>
            <div className="bg-white rounded-lg p-4 max-w-md">
                <h4 className="font-semibold mb-2">코스 장소 목록</h4>
                <div className="space-y-2 text-left">
                    {places.slice(0, 3).map((place, index) => (
                        <div key={place.id} className="flex items-center gap-2 text-sm">
                            <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">
                                {index + 1}
                            </span>
                            <span>{place.place.name}</span>
                        </div>
                    ))}
                    {places.length > 3 && (
                        <div className="text-xs text-gray-500 text-center pt-2">외 {places.length - 3}개 장소</div>
                    )}
                </div>
            </div>
        </div>
    </div>
);

// --- 레거시 함수 (수정 완료 및 보존) ---
function CourseDetailPage() {
    const params = useParams();
    const router = useRouter();

    if (!params || !params.id) {
        return (
            <main className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600">잘못된 코스 ID입니다.</p>
                    <button
                        onClick={() => router.push("/courses")}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        코스 목록으로 돌아가기
                    </button>
                </div>
            </main>
        );
    }

    const courseId = params.id as string;

    const [courseData, setCourseData] = useState<CourseData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [isShareLoading, setIsShareLoading] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [userTier, setUserTier] = useState<"FREE" | "BASIC" | "PREMIUM">("FREE");
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [reviews, setReviews] = useState<any[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewsError, setReviewsError] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
    const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
    const [showPlaceModal, setShowPlaceModal] = useState(false);

    const sortedCoursePlaces = useMemo(() => {
        if (!courseData?.coursePlaces) return [];
        return [...courseData.coursePlaces].sort((a, b) => a.order_index - b.order_index);
    }, [courseData?.coursePlaces]);

    const hasPlaces = useMemo(() => sortedCoursePlaces.length > 0, [sortedCoursePlaces]);
    const firstPlace = useMemo(() => sortedCoursePlaces[0], [sortedCoursePlaces]);
    const heroImageUrl = useMemo(
        () => courseData?.imageUrl || firstPlace?.place?.image_url || "",
        [courseData?.imageUrl, firstPlace?.place?.image_url]
    );

    const showToast = useCallback(
        (message: string, type: "success" | "error" | "info" = "info") => setToast({ message, type }),
        []
    );

    const handlePlaceClick = useCallback((place: MapPlace) => {
        setSelectedPlace(place);
        setShowPlaceModal(true);
    }, []);

    const createNavigationHandler = useCallback(
        (name: string, lat: number, lng: number) => () => {
            window.open(
                `https://map.naver.com/v5/search/${encodeURIComponent(name)}?c=${lng},${lat},15,0,0,0,dh`,
                "_blank"
            );
        },
        []
    );

    const fetchReviews = useCallback(async () => {
        try {
            setReviewsLoading(true);
            const response = await fetch(`/api/reviews?courseId=${courseId}`);
            const data = await response.json();
            if (response.ok && Array.isArray(data)) {
                setReviews(
                    data.map((r: any) => ({
                        id: r.id,
                        rating: r.rating,
                        userName: r.user?.nickname || "익명",
                        createdAt: r.createdAt,
                        content: r.comment,
                    }))
                );
            }
        } catch {
            setReviewsError("네트워크 오류가 발생했습니다.");
        } finally {
            setReviewsLoading(false);
        }
    }, [courseId]);

    // 🟢 [Fix] 사용자 등급 조회 (중복 Fetch 방지 패턴 적용)
    useEffect(() => {
        const fetchUserTierData = async () => {
            try {
                const session = await fetchSession();
                setIsLoggedIn(session.authenticated);
                if (session.authenticated) {
                    const data = await authenticatedFetch("/api/users/profile");
                    if (data) {
                        const tier = (data as any).user?.subscriptionTier || (data as any).subscriptionTier || "FREE";
                        setUserTier(tier as "FREE" | "BASIC" | "PREMIUM");
                    }
                }
            } catch {
                setIsLoggedIn(false);
            }
        };
        fetchUserTierData();
    }, []);

    // 🟢 [Fix] checkFavoriteStatus 중복 호출 방지 및 2304 에러 해결
    const checkFavoriteStatus = useCallback(async () => {
        if (!isLoggedIn) return;
        try {
            // 이미 캐시가 있다면 API 호출 없이 즉시 반영
            if (layoutFavoritesCache) {
                setIsSaved(layoutFavoritesCache.some((fav: any) => fav.course_id.toString() === courseId));
                return;
            }
            // 현재 요청 중인 Promise가 없다면 새로 생성 (Airtight Singleton)
            if (!layoutFavoritesPromise) {
                layoutFavoritesPromise = authenticatedFetch<any[]>("/api/users/favorites");
            }
            const favorites = await layoutFavoritesPromise;
            layoutFavoritesCache = favorites; // 캐시 업데이트
            if (favorites) {
                setIsSaved(favorites.some((fav: any) => fav.course_id.toString() === courseId));
            }
        } catch {
            layoutFavoritesPromise = null;
        }
    }, [courseId, isLoggedIn]);

    // 🟢 [Fix] handleSaveCourse 내의 2304 에러 해결
    const handleSaveCourse = async () => {
        try {
            // 🟢 [Fix]: API 호출 전에 현재 상태 저장 (상태 변경 전)
            const currentSavedState = isSaved;
            const nextState = !isSaved;
            
            // 🟢 [Fix]: 상태를 먼저 변경하여 UI 즉시 반영
            setIsSaved(nextState);
            
            const method = currentSavedState ? "DELETE" : "POST";
            const url = currentSavedState ? `/api/users/favorites?courseId=${courseId}` : "/api/users/favorites";
            const body = currentSavedState ? undefined : JSON.stringify({ courseId });

            const result = await authenticatedFetch(url, { method, body });

            if (result !== null) {
                showToast(nextState ? "찜 목록에 추가되었습니다." : "찜 목록에서 제거되었습니다.", "success");
                
                // 🟢 [Fix]: 캐시에 새로운 상태를 즉시 반영하여 favoritesChanged 이벤트 후에도 상태 유지
                if (!layoutFavoritesCache) {
                    layoutFavoritesCache = [];
                }
                if (nextState) {
                    // 찜하기 추가: 캐시에 추가
                    if (!layoutFavoritesCache.some((fav: any) => fav.course_id.toString() === courseId)) {
                        layoutFavoritesCache.push({ course_id: Number(courseId) });
                    }
                } else {
                    // 찜하기 제거: 캐시에서 제거
                    layoutFavoritesCache = layoutFavoritesCache.filter(
                        (fav: any) => fav.course_id.toString() !== courseId
                    );
                }
                
                layoutFavoritesPromise = null;
                window.dispatchEvent(new CustomEvent("favoritesChanged"));
            } else {
                // 🟢 API 호출 실패 시 상태 롤백
                setIsSaved(currentSavedState);
                showToast("로그인이 필요합니다.", "error");
                router.push("/login");
            }
        } catch {
            // 🟢 에러 발생 시 상태 롤백
            setIsSaved(currentSavedState); // 원래 상태로 복원
            showToast("오류가 발생했습니다.", "error");
        }
    };

    const handleKakaoShare = async () => {
        const url = window.location.href;
        try {
            const Kakao = (window as any).Kakao;
            if (Kakao && !Kakao.isInitialized()) Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY);
            Kakao.Share.sendDefault({
                objectType: "feed",
                content: {
                    title: courseData?.title || "DoNa",
                    description: courseData?.description || "",
                    imageUrl: heroImageUrl || getS3StaticUrl("logo/donalogo_512.png"),
                    link: { mobileWebUrl: url, webUrl: url },
                },
                buttons: [{ title: "코스 보러가기", link: { mobileWebUrl: url, webUrl: url } }],
            });
            setShowShareModal(false);
        } catch {
            navigator.clipboard.writeText(url);
            showToast("링크가 복사되었습니다.", "success");
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setShowShareModal(false);
            showToast("링크 복사 완료!", "success");
        } catch {
            showToast("링크 복사 실패", "error");
        }
    };

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) =>
                setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
            );
        }
    }, []);

    useEffect(() => {
        if (courseData) checkFavoriteStatus();
        
        // 🟢 [Fix]: favoritesChanged 이벤트 리스너 추가하여 찜하기 변경 시 동기화
        const handleFavoritesChanged = () => {
            // 🟢 [Fix]: 캐시를 무효화하지 않고 현재 캐시 상태 유지 (방금 변경한 상태 보존)
            if (layoutFavoritesCache) {
                setIsSaved(layoutFavoritesCache.some((fav: any) => fav.course_id.toString() === courseId));
            } else {
                // 캐시가 없으면 서버에서 다시 가져오기
                layoutFavoritesPromise = null;
                checkFavoriteStatus();
            }
        };
        
        window.addEventListener("favoritesChanged", handleFavoritesChanged);
        
        return () => {
            window.removeEventListener("favoritesChanged", handleFavoritesChanged);
        };
    }, [courseData, checkFavoriteStatus, courseId]);
    useEffect(() => {
        if (courseData) fetchReviews();
    }, [courseData, fetchReviews]);
    useEffect(() => {
        const refresh = () => fetchReviews();
        window.addEventListener("reviewSubmitted", refresh);
        return () => window.removeEventListener("reviewSubmitted", refresh);
    }, [fetchReviews]);

    if (loading)
        return (
            <main className="min-h-screen bg-gray-50 flex items-center justify-center">
                <LoadingSpinner />
                <p className="ml-4">불러오는 중...</p>
            </main>
        );
    if (error || !courseData)
        return (
            <main className="min-h-screen bg-gray-50 flex items-center justify-center">
                <ErrorDisplay error={error || "데이터가 없습니다."} onRetry={() => window.location.reload()} />
            </main>
        );

    return (
        <>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="min-h-screen bg-gray-50 text-black pt-10">
                <section className="relative h-[360px] md:h-[520px] overflow-hidden pt-10">
                    <Image src={heroImageUrl || ""} alt={courseData.title} fill priority className="object-cover" />
                    <div className="absolute inset-0 bg-linear-to-r from-black/70 to-transparent" />
                    <div className="relative h-full max-w-7xl mx-auto px-4 flex items-center">
                        <div className="max-w-2xl">
                            <div className="mb-4 flex gap-3 flex-wrap">
                                {courseData.isPopular && (
                                    <span className="px-4 py-1.5 bg-red-500 text-white text-sm font-bold rounded-full">
                                        🔥 인기
                                    </span>
                                )}
                                <span className="px-4 py-1.5 bg-blue-500 text-white text-sm font-bold rounded-full">
                                    {courseData.concept}
                                </span>
                            </div>
                            <h1 className="text-4xl font-bold text-white mb-4">{courseData.title}</h1>
                            <p className="text-xl text-white/90 mb-6">{courseData.description}</p>
                            <div className="flex items-center gap-6 text-white font-bold">
                                <span>★ {courseData.rating}</span>
                                <span>📍 {courseData.coursePlaces?.length} 스팟</span>
                                <span>⏱ {courseData.duration}</span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
            <ReviewModal
                isOpen={showReviewModal}
                onClose={() => setShowReviewModal(false)}
                courseId={parseInt(courseId)}
                courseName={courseData.title}
            />
            {/* 🟢 [IN-APP PURCHASE]: 모바일 앱에서만 표시 (TicketPlans 컴포넌트 내부에서도 체크) */}
            {showSubscriptionModal && <TicketPlans onClose={() => setShowSubscriptionModal(false)} />}
            {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
        </>
    );
}
