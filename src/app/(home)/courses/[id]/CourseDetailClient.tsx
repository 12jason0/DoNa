"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "@/components/ImageFallback";
import dynamic from "next/dynamic";
import TicketPlans from "@/components/TicketPlans";
import LoginModal from "@/components/LoginModal";
import { Place as MapPlace, UserLocation } from "@/types/map";
import { apiFetch, authenticatedFetch } from "@/lib/authClient";
import { getS3StaticUrl } from "@/lib/s3Static";
import { useAuth } from "@/context/AuthContext";
import { isIOS, isMobileApp } from "@/lib/platform";

// 🟢 [Optimization] API 요청 중복 방지 전역 변수
let globalFavoritesPromise: Promise<any[] | null> | null = null;
let globalFavoritesCache: any[] | null = null;

// --- 아이콘 (SVG) 정의 (유지) ---
const Icons = {
    LikeOutline: () => (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
        </svg>
    ),
    LikeSolid: () => (
        <svg className="w-6 h-6 text-rose-500" fill="currentColor" stroke="none" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
        </svg>
    ),
    Share: () => (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
        </svg>
    ),
    Map: ({ className }: { className?: string }) => (
        <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    ),
    Rocket: () => <span className="text-lg">🚀</span>,
    Close: ({ className }: { className?: string }) => (
        <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    Bulb: () => (
        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
        </svg>
    ),
    Kakao: () => (
        <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C5.373 3 0 6.663 0 11.182C0 14.07 1.83 16.63 4.67 18.11C4.54 18.57 3.82 21.05 3.77 21.23C3.73 21.46 3.98 21.58 4.15 21.46C4.19 21.43 7.84 18.96 8.35 18.63C9.52 18.82 10.74 18.92 12 18.92C18.627 18.92 24 15.257 24 10.738C24 6.219 18.627 3 12 3Z" />
        </svg>
    ),
    Link: () => (
        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
        </svg>
    ),
    ExternalLink: ({ className }: { className?: string }) => (
        <svg className={className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
        </svg>
    ),
    ToastSuccess: ({ className }: { className?: string }) => (
        <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
    ),
    ToastError: ({ className }: { className?: string }) => (
        <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    ToastInfo: ({ className }: { className?: string }) => (
        <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        </svg>
    ),
};

const ReviewModal = dynamic(() => import("@/components/ReviewModal"), { ssr: false, loading: () => null });
const NaverMap = dynamic(() => import("@/components/NaverMap"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-gray-100 rounded-lg animate-pulse flex items-center justify-center text-gray-400">
            지도 로딩중...
        </div>
    ),
});

// --- 타입 정의 (Export 추가) ---
export interface PlaceClosedDay {
    day_of_week: number | null;
    specific_date: Date | string | null;
    note?: string | null;
}
export interface Place {
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
    reservationUrl?: string | null; // 🟢 예약 주소 추가
    latitude: number;
    longitude: number;
    imageUrl?: string;
    closed_days?: PlaceClosedDay[];
}
export interface CoursePlace {
    id: number;
    course_id: number;
    place_id: number;
    order_index: number;
    estimated_duration: number;
    recommended_time: string;
    coaching_tip?: string | null;
    place: Place;
}

// 🟢 [Fix] page.tsx에서 사용 가능하도록 export 추가
export interface CourseData {
    id: string;
    title: string;
    description: string;
    region?: string | null;
    sub_title?: string | null;
    target_situation?: string | null;
    duration: string;
    price?: string;
    imageUrl: string;
    concept: string;
    rating: number;
    isPopular: boolean;
    grade?: "FREE" | "BASIC" | "PREMIUM";
    isLocked?: boolean;
    recommended_start_time: string;
    season: string;
    courseType: string;
    transportation: string;
    reservationRequired: boolean;
    createdAt: string;
    updatedAt: string;
    highlights?: any[];
    coursePlaces?: CoursePlace[];
}

export interface Review {
    id: number;
    rating: number;
    userName: string;
    createdAt: string;
    content: string;
    imageUrls?: string[];
}

// 🟢 [Fix] 이름 충돌 해결: Toast -> ToastPopup
const ToastPopup = ({
    message,
    type,
    onClose,
}: {
    message: string;
    type: "success" | "error" | "info";
    onClose: () => void;
}) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 2000);
        return () => clearTimeout(timer);
    }, [onClose]);
    const bgColor = type === "error" ? "bg-rose-600/90" : "bg-[#1A1A1A]/90";
    const IconComponent = { success: Icons.ToastSuccess, error: Icons.ToastError, info: Icons.ToastInfo }[type];
    return (
        <div
            className={`fixed bottom-28 left-1/2 -translate-x-1/2 ${bgColor} backdrop-blur-md text-white pl-5 pr-6 py-3.5 rounded-full shadow-lg z-9999 animate-slide-up-mobile flex items-center gap-3 border border-white/10`}
        >
            <div className={`shrink-0 ${type === "success" ? "text-emerald-400" : "text-white/90"}`}>
                <IconComponent className="w-5 h-5" />
            </div>
            <span className="font-medium text-[15px] tracking-tight pt-0.5">{message}</span>
        </div>
    );
};

interface CourseDetailClientProps {
    courseData: CourseData | null | undefined; // 🟢 [Fix] 로그인 과정에서 일시적으로 undefined가 될 수 있음
    initialReviews: Review[];
    courseId: string;
    userTier?: string;
}

export default function CourseDetailClient({
    courseData,
    initialReviews,
    courseId,
    userTier = "FREE",
}: CourseDetailClientProps) {
    // 🟢 [Fix]: 로그인 확인 중이거나 데이터가 유실된 경우를 대비한 가드 클로즈(Guard Clause)
    // 이 로직은 UI를 변경하지 않고 런타임 에러만 원천 봉쇄합니다.
    if (!courseData) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <p className="text-gray-500">코스 정보를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [platform, setPlatform] = useState<"ios" | "android" | "web">("web");

    // 🟢 iOS 플랫폼 감지
    useEffect(() => {
        setPlatform(isIOS() ? "ios" : "web");
    }, []);

    // 🟢 성능 최적화: 코스 상세 페이지 진입 시 메인 페이지를 미리 로드하여 빠른 전환 보장
    useEffect(() => {
        router.prefetch("/");
    }, [router]);

    // --- State ---
    const [reviews, setReviews] = useState<Review[]>(initialReviews);
    const [isSaved, setIsSaved] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showPlaceModal, setShowPlaceModal] = useState(false);
    // 🔒 [접근 제어] 잠긴 코스는 초기 state에서 즉시 모달 표시 (페이지가 보이기 전에)
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(() => {
        return courseData.isLocked ? true : false;
    });
    const [showLoginModal, setShowLoginModal] = useState(false);

    // 🔒 [접근 제어] 인증 상태 확인 후 잠긴 코스의 모달 타입 결정
    useEffect(() => {
        if (authLoading || !courseData.isLocked) return;

        // 🟢 비로그인 유저 → 로그인 모달만 표시
        if (!isAuthenticated) {
            setShowLoginModal(true);
            setShowSubscriptionModal(false);
        } else {
            // 🟢 로그인 유저 → TicketPlans만 표시
            setShowSubscriptionModal(true);
            setShowLoginModal(false);
        }
    }, [courseData.isLocked, isAuthenticated, authLoading]);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [previewImageIndex, setPreviewImageIndex] = useState(0);
    const [showFullMapModal, setShowFullMapModal] = useState(false);
    const [modalSelectedPlace, setModalSelectedPlace] = useState<MapPlace | null>(null);
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const mapSectionRef = useRef<HTMLDivElement | null>(null);

    // 🟢 [Fix]: 지도 랙(Lag) 및 preventDefault 에러 원천 차단 패치
    useEffect(() => {
        if (typeof window === "undefined" || (EventTarget.prototype as any)._isPatched) return;

        const originalAddEventListener = EventTarget.prototype.addEventListener;
        (EventTarget.prototype as any)._isPatched = true;

        // 브라우저의 'Passive' 인터벤션을 무력화하고 지도의 제어권을 복구함
        EventTarget.prototype.addEventListener = function (type: string, listener: any, options: any) {
            let updatedOptions = options;

            // 지도의 핵심 조작 이벤트(휠, 터치) 감지
            if (["wheel", "mousewheel", "touchstart", "touchmove"].includes(type)) {
                if (typeof options === "object") {
                    // 🟢 핵심: 브라우저가 뭐라든 passive를 false로 강제하여 지도 조작권 확보
                    updatedOptions = { ...options, passive: false };
                } else {
                    updatedOptions = { capture: !!options, passive: false };
                }
            }

            return originalAddEventListener.call(this, type, listener, updatedOptions);
        };

        // 🛡️ [추가] releasePointerCapture 브라우저 에러 방어
        if (window.Element && Element.prototype.releasePointerCapture) {
            const originalRelease = Element.prototype.releasePointerCapture;
            Element.prototype.releasePointerCapture = function (pointerId) {
                try {
                    originalRelease.call(this, pointerId);
                } catch (e) {
                    // 포인터 ID가 유효하지 않아 발생하는 NotFoundError를 조용히 무시하여 비정상 종료 방지
                }
            };
        }

        // 🔴 중요: 전역 패치이므로 컴포넌트가 언마운트되어도 유지되는 것이 성능상 유리함 (원복 생략)
    }, []);

    // 🟢 [Performance]: 사용자 제스처(버튼 클릭)에 의해서만 위치 정보 요청
    const handleMapActivation = useCallback(() => {
        if (typeof window === "undefined" || !navigator.geolocation || userLocation) return;
        const geoOptions = { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }; // 🟢 성능 최적화: 정확도 낮춤, 타임아웃 단축
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.warn("위치 정보 요청 실패:", err.message),
            geoOptions
        );
    }, [userLocation]);

    // 🟢 [Fix]: IntersectionObserver에서 자동 위치 요청 제거 (브라우저 보안 정책 준수)
    // 위치 정보는 사용자 제스처(버튼 클릭)에 의해서만 요청됩니다.

    useEffect(() => {
        if (authLoading) return;
        setIsLoggedIn(isAuthenticated);

        // 🟢 [Performance]: favorites 동기화를 requestIdleCallback으로 지연
        const syncFavorites = async () => {
            if (!isAuthenticated) {
                setIsSaved(false);
                return;
            }
            // 🟢 [Fix]: 캐시가 있으면 캐시 우선 사용 (사용자가 방금 변경한 상태 반영)
            if (globalFavoritesCache) {
                setIsSaved(globalFavoritesCache.some((fav: any) => String(fav.course_id) === courseId));
                return;
            }
            if (!globalFavoritesPromise) {
                globalFavoritesPromise = authenticatedFetch<any[]>("/api/users/favorites");
            }
            try {
                const data = await globalFavoritesPromise;
                globalFavoritesCache = data;
                if (data) setIsSaved(data.some((fav: any) => String(fav.course_id) === courseId));
            } catch {
                globalFavoritesPromise = null;
            }
        };

        // 🟢 [Performance]: 유휴 시간에 favorites 로드
        const ric = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 100));
        ric(syncFavorites);

        // 🟢 [Fix]: favoritesChanged 이벤트 리스너 추가하여 다른 컴포넌트에서 찜하기 변경 시 동기화
        const handleFavoritesChanged = () => {
            // 🟢 [Fix]: 캐시를 무효화하지 않고 현재 캐시 상태 유지 (방금 변경한 상태 보존)
            if (globalFavoritesCache) {
                setIsSaved(globalFavoritesCache.some((fav: any) => String(fav.course_id) === courseId));
            } else {
                // 캐시가 없으면 서버에서 다시 가져오기
                globalFavoritesPromise = null;
                ric(syncFavorites);
            }
        };

        window.addEventListener("favoritesChanged", handleFavoritesChanged);

        return () => {
            window.removeEventListener("favoritesChanged", handleFavoritesChanged);
        };

        // 🟢 [Performance]: 조회수 추적도 지연
        const trackView = () => {
            const key = `course_view_${courseId}`;
            const now = Date.now();
            const lastView = localStorage.getItem(key);
            if (!lastView || now - parseInt(lastView) > 1800000) {
                const callApi = () =>
                    fetch(`/api/courses/${courseId}/view`, { method: "POST", keepalive: true })
                        .then(() => localStorage.setItem(key, String(now)))
                        .catch(() => {});
                // 🟢 더 긴 지연으로 메인 스레드 부하 감소
                setTimeout(callApi, 3000);
            }
        };
        ric(trackView);
    }, [courseId, isAuthenticated, authLoading]);

    // 🟢 [Performance]: 지도 컴포넌트 지연 로딩을 위한 상태
    const [shouldLoadMap, setShouldLoadMap] = useState(false);

    // 🟢 [Performance]: 지도 섹션이 보일 때만 NaverMap 로드
    useEffect(() => {
        if (!mapSectionRef.current || shouldLoadMap) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setShouldLoadMap(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1, rootMargin: "200px" } // 🟢 200px 전에 미리 로드
        );
        observer.observe(mapSectionRef.current);
        return () => observer.disconnect();
    }, [shouldLoadMap]);

    // 🟢 [Fix] 데이터 메모이제이션 (참조값 고정으로 지도 SDK 리셋 방지)
    const sortedCoursePlaces = useMemo(() => {
        const places = courseData?.coursePlaces ?? [];
        return [...places].sort((a, b) => a.order_index - b.order_index);
    }, [courseData?.coursePlaces]);

    const mapPlaces = useMemo(() => {
        return sortedCoursePlaces.map((cp) => ({
            id: cp.place.id,
            name: cp.place.name,
            latitude: cp.place.latitude,
            longitude: cp.place.longitude,
            address: cp.place.address,
            imageUrl: cp.place.imageUrl,
            description: cp.place.description,
            orderIndex: cp.order_index,
        }));
    }, [sortedCoursePlaces]);

    useEffect(() => {
        if (sortedCoursePlaces.length > 0 && !selectedPlace) {
            setSelectedPlace(sortedCoursePlaces[0].place);
        }
    }, [sortedCoursePlaces, selectedPlace]);

    // 🟢 페이지 진입 시 모든 장소 이미지 미리 로드 (모달이 열릴 때 즉시 표시를 위해)
    useEffect(() => {
        if (sortedCoursePlaces.length > 0) {
            // 모든 장소의 이미지를 미리 로드
            sortedCoursePlaces.forEach((coursePlace) => {
                if (coursePlace.place.imageUrl) {
                    // link preload
                    const link = document.createElement("link");
                    link.rel = "preload";
                    link.as = "image";
                    link.href = coursePlace.place.imageUrl;
                    document.head.appendChild(link);

                    // Image 객체로도 미리 로드 (더 빠른 로딩)
                    const img = document.createElement("img");
                    img.src = coursePlace.place.imageUrl;
                }
            });
        }
    }, [sortedCoursePlaces]);

    // 🟢 모달이 열릴 때 이미지 미리 로드 (즉시 표시를 위해)
    useEffect(() => {
        if (showPlaceModal && selectedPlace?.imageUrl) {
            // 이미지 preload
            const link = document.createElement("link");
            link.rel = "preload";
            link.as = "image";
            link.href = selectedPlace.imageUrl;
            document.head.appendChild(link);

            // Image 객체로도 미리 로드 (더 빠른 로딩)
            const img = document.createElement("img");
            img.src = selectedPlace.imageUrl;
        }
    }, [showPlaceModal, selectedPlace?.imageUrl]);

    const handleMapPlaceClick = useCallback(
        (mapPlace: MapPlace) => {
            const fullPlace = sortedCoursePlaces.find((cp) => cp.place.id === mapPlace.id)?.place;
            if (fullPlace) {
                // 모달이 열려있으면 모달용 상태 업데이트, 아니면 일반 상태 업데이트
                if (showFullMapModal) {
                    setModalSelectedPlace(mapPlace);
                } else {
                    setSelectedPlace(fullPlace);
                }
            }
        },
        [sortedCoursePlaces, showFullMapModal]
    );

    const heroImageUrl = useMemo(() => {
        if (courseData?.imageUrl) return courseData.imageUrl;
        if (sortedCoursePlaces.length > 0) return sortedCoursePlaces[0].place.imageUrl || "";
        return "";
    }, [courseData?.imageUrl, sortedCoursePlaces]);

    // 🟢 Hero 이미지 미리 로드 (성능 최적화)
    useEffect(() => {
        if (heroImageUrl) {
            const link = document.createElement("link");
            link.rel = "preload";
            link.as = "image";
            link.href = heroImageUrl;
            document.head.appendChild(link);
            return () => {
                document.head.removeChild(link);
            };
        }
    }, [heroImageUrl]);

    const showToast = useCallback(
        (message: string, type: "success" | "error" | "info" = "info") => setToast({ message, type }),
        []
    );

    const handleTimelinePlaceClick = (coursePlace: CoursePlace) => {
        setSelectedPlace(coursePlace.place);
        if (mapSectionRef.current) {
            const rect = mapSectionRef.current.getBoundingClientRect();
            const top = (window.scrollY || window.pageYOffset) + rect.top - 120;
            window.scrollTo({ top, behavior: "smooth" });
        }
    };

    const fetchReviews = useCallback(async () => {
        if (!courseId) return;
        try {
            const response = await fetch(`/api/reviews?courseId=${courseId}`, {
                cache: "force-cache", // 🟢 캐싱으로 성능 향상
                next: { revalidate: 300 }, // 🟢 5분간 캐시 유지
            });
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    setReviews(
                        data.map((r: any) => ({
                            id: r.id,
                            rating: r.rating,
                            userName: r.user?.nickname || "익명",
                            createdAt: r.createdAt,
                            content: r.comment,
                            imageUrls: r.imageUrls || [],
                        }))
                    );
                }
            }
        } catch {}
    }, [courseId]);

    // 🟢 [Performance]: 리뷰 섹션이 보일 때만 로드
    const [shouldLoadReviews, setShouldLoadReviews] = useState(false);
    const reviewsSectionRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!reviewsSectionRef.current || shouldLoadReviews) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setShouldLoadReviews(true);
                    fetchReviews();
                    observer.disconnect();
                }
            },
            { threshold: 0.1, rootMargin: "100px" }
        );
        observer.observe(reviewsSectionRef.current);
        return () => observer.disconnect();
    }, [shouldLoadReviews, fetchReviews]);

    const handleSaveCourse = async () => {
        if (!isLoggedIn) {
            setShowLoginModal(true);
            return;
        }
        // 🟢 [Fix]: API 호출 전에 현재 상태 저장 (상태 변경 전)
        const currentSavedState = isSaved;
        const nextState = !isSaved;

        // 🟢 [Fix]: 상태를 먼저 변경하여 UI 즉시 반영
        setIsSaved(nextState);
        showToast(nextState ? "취향에 쏙 담겼어요 ✨" : "다음에 다시 담아주세요 💫", "success");

        try {
            // 🟢 [Fix]: API 호출 시 변경 전 상태(currentSavedState) 사용
            const method = currentSavedState ? "DELETE" : "POST";
            const url = currentSavedState ? `/api/users/favorites?courseId=${courseId}` : `/api/users/favorites`;
            const response = await authenticatedFetch(url, {
                method,
                body: currentSavedState ? undefined : JSON.stringify({ courseId }),
            });

            // 🟢 API 호출 성공 시에만 캐시 업데이트
            if (response !== null) {
                // 🟢 [Fix]: 캐시에 새로운 상태를 즉시 반영하여 favoritesChanged 이벤트 후에도 상태 유지
                if (!globalFavoritesCache) {
                    globalFavoritesCache = [];
                }
                if (nextState) {
                    // 찜하기 추가: 캐시에 추가
                    if (!globalFavoritesCache.some((fav: any) => String(fav.course_id) === courseId)) {
                        globalFavoritesCache.push({ course_id: Number(courseId) });
                    }
                } else {
                    // 찜하기 제거: 캐시에서 제거
                    globalFavoritesCache = globalFavoritesCache.filter(
                        (fav: any) => String(fav.course_id) !== courseId
                    );
                }
                globalFavoritesPromise = null;
                window.dispatchEvent(new CustomEvent("favoritesChanged"));
            } else {
                // 🟢 API 호출 실패 시 상태 롤백
                setIsSaved(currentSavedState);
            }
        } catch {
            // 🟢 에러 발생 시 상태 롤백
            setIsSaved(currentSavedState);
        }
    };

    // 카카오 SDK 로드 및 초기화 함수
    const ensureKakaoSdk = async (): Promise<any | null> => {
        if (typeof window === "undefined") return null;
        if (!(window as any).Kakao) {
            await new Promise<void>((resolve, reject) => {
                const script = document.createElement("script");
                script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error("Kakao SDK load failed"));
                document.head.appendChild(script);
            });
        }
        const Kakao = (window as any).Kakao;
        try {
            if (Kakao && !Kakao.isInitialized?.()) {
                const jsKey =
                    process.env.NEXT_PUBLIC_KAKAO_JS_KEY ||
                    process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY ||
                    process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY;
                if (!jsKey) {
                    console.warn("Kakao JS Key가 설정되지 않았습니다.");
                    return Kakao;
                }
                Kakao.init(jsKey);
            }
        } catch (error) {
            console.error("Kakao SDK 초기화 실패:", error);
        }
        return Kakao || null;
    };

    const handleKakaoShare = async () => {
        // 🟢 [2025-12-28] 통합: 접속 환경에 따라 baseUrl을 자동으로 결정 (로컬 IP 또는 운영 도메인)
        let baseUrl = "https://dona.io.kr"; // 기본값을 운영 도메인으로 설정

        if (typeof window !== "undefined") {
            const origin = window.location.origin.replace(/\/$/, "");
            // dona.io.kr로 접속 중이면 해당 도메인 사용
            if (origin.includes("dona.io.kr")) {
                baseUrl = "https://dona.io.kr";
            } else if (origin.includes("192.168.") || origin.includes("localhost") || origin.includes("127.0.0.1")) {
                // 로컬 개발 환경: 실제 접속 주소 사용
                baseUrl = origin;
            }
        }

        // 🟢 [2025-12-28] baseUrl 끝의 슬래시 제거 후 URL 생성
        // 🟢 [테스트용]: 운영 도메인으로 하드코딩 (카카오 콘솔 테스트용)
        const cleanCourseUrl = "https://dona.io.kr/courses/" + courseId;

        // 🟢 [2025-12-28] 디버깅: 전달되는 URL 확인 (카카오 콘솔 등록값과 비교용)
        console.log("[카카오 공유] 테스트용 주소로 공유 시도:", cleanCourseUrl);

        try {
            const Kakao = await ensureKakaoSdk();
            if (!Kakao) {
                throw new Error("Kakao SDK 로드 실패");
            }

            // 🟢 카카오톡 공유 4002 오류 해결: 패킷 사이즈 제한(10K) 준수
            // title 최대 200자, description 최대 200자로 제한
            const shareTitle =
                courseData.title.length > 200 ? courseData.title.substring(0, 197) + "..." : courseData.title;
            const shareDescription = courseData.description
                ? courseData.description.length > 200
                    ? courseData.description.substring(0, 197) + "..."
                    : courseData.description
                : "DoNa에서 추천하는 코스를 확인해보세요!";

            // 🟢 [2025-12-28] 이미지 URL: 절대 경로로 변환 (카카오 공유는 절대 경로만 허용)
            // 🟢 [테스트용]: 운영 도메인 사용 (카카오 서버가 접근 가능하도록)
            const testBaseUrl = "https://dona.io.kr";
            let shareImageUrl = heroImageUrl || courseData.imageUrl;
            if (shareImageUrl) {
                // 이미 절대 경로인 경우 그대로 사용
                if (!shareImageUrl.startsWith("http")) {
                    // 상대 경로인 경우 운영 도메인과 결합
                    shareImageUrl = shareImageUrl.startsWith("/")
                        ? `${testBaseUrl}${shareImageUrl}`
                        : `${testBaseUrl}/${shareImageUrl}`;
                }
            } else {
                // 기본 로고 사용 (절대 경로)
                shareImageUrl = getS3StaticUrl("logo/donalogo_512.png");
            }

            // 🟢 [2025-12-28] 통합: 앱/웹 모두 템플릿 번호 없이 '기본 공유' 방식 사용
            Kakao.Share.sendDefault({
                objectType: "feed",
                content: {
                    title: shareTitle,
                    description: shareDescription,
                    imageUrl: shareImageUrl,
                    link: {
                        mobileWebUrl: cleanCourseUrl,
                        webUrl: cleanCourseUrl,
                    },
                },
                buttons: [
                    {
                        title: "코스 보러가기",
                        link: {
                            mobileWebUrl: cleanCourseUrl,
                            webUrl: cleanCourseUrl,
                        },
                    },
                ],
            });

            setShowShareModal(false);
        } catch (error: any) {
            console.error("[카카오 공유] 실패:", error);
            // 🟢 [2025-12-28] 에러 상세 정보 로깅
            if (error?.message) {
                console.error("[카카오 공유] 에러 메시지:", error.message);
            }
            if (error?.code) {
                console.error("[카카오 공유] 에러 코드:", error.code);
            }

            // 실패 시 클립보드 복사 Fallback 유지
            try {
                await navigator.clipboard.writeText(cleanCourseUrl);
                showToast("링크가 복사되었습니다.", "success");
            } catch {
                showToast("공유에 실패했습니다.", "error");
            }
        }
    };

    const handleCopyLink = async () => {
        try {
            // 🟢 코스 페이지 URL을 명시적으로 생성 (공유된 링크가 해당 코스 페이지로 이동하도록)
            const courseUrl =
                typeof window !== "undefined"
                    ? `${window.location.origin}/courses/${courseId}`
                    : `https://dona.app/courses/${courseId}`;
            await navigator.clipboard.writeText(courseUrl);
            setShowShareModal(false);
            showToast("링크 복사 완료!", "success");
        } catch {
            showToast("링크 복사 실패", "error");
        }
    };

    // 🔒 [조건부 렌더링] isUnlocked 상태를 기준으로 콘텐츠 렌더링
    const isUnlocked = !courseData.isLocked;
    // 🔒 모달이 표시될 때는 코스 콘텐츠를 완전히 숨김
    const shouldShowContent = isUnlocked && !showSubscriptionModal && !showLoginModal;

    return (
        <>
            {/* 🟢 [Fix] 컴포넌트명 수정 반영 */}
            {toast && <ToastPopup message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {shouldShowContent ? (
                // 🟢 잠금 해제된 경우: 전체 코스 상세 콘텐츠 렌더링
                <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0f1710] font-sans text-gray-900 dark:text-white relative">
                    <header className="relative h-[400px] md:h-[500px] w-full max-w-[900px] mx-auto overflow-hidden">
                        <Image
                            src={heroImageUrl || ""}
                            alt={courseData.title}
                            fill
                            className="object-cover"
                            priority
                            loading="eager"
                            quality={75}
                            fetchPriority="high"
                            sizes="(max-width: 768px) 100vw, 33vw"
                            unoptimized={false}
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 w-full p-6 pb-14 text-white">
                            <div className="flex flex-wrap gap-2.5 mb-4">
                                <span className="px-3.5 py-1.5 bg-white/20 backdrop-blur-md text-[13px] font-bold rounded-full border border-white/20 shadow-sm">
                                    📍 {courseData.region || "서울"}
                                </span>
                                {courseData.target_situation && (
                                    <span className="px-3.5 py-1.5 bg-rose-500/80 backdrop-blur-md text-[13px] font-bold rounded-full shadow-sm border border-white/10">
                                        {courseData.target_situation === "SOME"
                                            ? "💘 썸 탈출"
                                            : `#${courseData.target_situation}`}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold mb-6">{courseData.title}</h1>
                            <div className="flex items-center gap-3 text-xs font-semibold">
                                <div className="bg-black/30 backdrop-blur-md px-3 py-2 rounded-md border border-white/10">
                                    👣 {sortedCoursePlaces.length} 스팟
                                </div>
                                <div className="bg-black/30 backdrop-blur-md px-3 py-2 rounded-md border border-white/10">
                                    ⏳ {courseData.duration}
                                </div>
                                <div className="bg-black/30 backdrop-blur-md px-3 py-2 rounded-md border border-white/10">
                                    <span className="text-yellow-400">★</span> {courseData.rating}
                                </div>
                            </div>
                        </div>
                    </header>

                    <main
                        className="max-w-[600px] mx-auto -mt-8 relative z-10 px-5 space-y-10"
                        style={{
                            touchAction: "pan-y", // 수직 스크롤 성능 최적화
                            WebkitOverflowScrolling: "touch", // iOS 부드러운 스크롤 보장
                        }}
                    >
                        <section className="bg-white dark:bg-[#1a241b] rounded-lg p-8 shadow-lg border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">어떤 코스인가요?</h2>
                            </div>
                            <p className="text-gray-600 dark:text-gray-300 text-[15px] leading-8 whitespace-pre-wrap font-medium">
                                {courseData.description}
                            </p>
                        </section>

                        <section
                            ref={mapSectionRef}
                            className="bg-white dark:bg-[#1a241b] rounded-lg p-4 shadow-lg border border-gray-100 dark:border-gray-800 naver-map-container"
                        >
                            <div className="relative rounded-lg overflow-hidden border border-gray-200">
                                {mapPlaces.length > 0 ? (
                                    shouldLoadMap ? (
                                        <NaverMap
                                            places={mapPlaces}
                                            userLocation={userLocation}
                                            selectedPlace={selectedPlace}
                                            onPlaceClick={handleMapPlaceClick}
                                            drawPath={true}
                                            numberedMarkers={true}
                                            className="w-full h-[320px] md:h-[400px]"
                                            showControls={false}
                                        />
                                    ) : (
                                        <div className="h-[320px] md:h-[400px] bg-gray-50 flex items-center justify-center text-gray-400 animate-pulse">
                                            지도 로딩 중...
                                        </div>
                                    )
                                ) : (
                                    <div className="h-64 bg-gray-50 flex items-center justify-center text-gray-400">
                                        지도 정보 없음
                                    </div>
                                )}
                                <div className="absolute bottom-4 right-4">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleMapActivation();
                                            window.open(
                                                `https://map.naver.com/v5/search/${encodeURIComponent(
                                                    sortedCoursePlaces[0]?.place.name || ""
                                                )}`
                                            );
                                        }}
                                        className="bg-white/90 dark:bg-[#1a241b]/90 backdrop-blur text-gray-800 dark:text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 flex items-center gap-1.5 active:scale-95 transition-transform"
                                    >
                                        <Icons.Map className="w-4 h-4" /> <span>지도 앱에서 보기</span>
                                    </button>
                                </div>
                            </div>
                        </section>

                        <section className="relative px-4 pb-20">
                            <div className="absolute left-[34px] top-4 bottom-0 w-[2px] border-l-2 border-dashed border-gray-200" />
                            <div className="space-y-8">
                                {sortedCoursePlaces.map((coursePlace: CoursePlace, idx: number) => {
                                    const isSelected = selectedPlace?.id === coursePlace.place.id;
                                    return (
                                        <div key={coursePlace.id} className="relative">
                                            <div
                                                onClick={() => {
                                                    // 🟢 모달 이미지 미리 로드 (즉시 표시를 위해)
                                                    if (coursePlace.place.imageUrl) {
                                                        const link = document.createElement("link");
                                                        link.rel = "preload";
                                                        link.as = "image";
                                                        link.href = coursePlace.place.imageUrl;
                                                        document.head.appendChild(link);

                                                        // 🟢 이미지 객체로도 미리 로드 (더 빠른 로딩)
                                                        const img = document.createElement("img");
                                                        img.src = coursePlace.place.imageUrl;
                                                    }
                                                    setSelectedPlace(coursePlace.place);
                                                    // 🟢 다음 프레임에서 모달 열기 (이미지 프리로드 시간 확보)
                                                    requestAnimationFrame(() => {
                                                        setShowPlaceModal(true);
                                                    });
                                                }}
                                                className={`relative ml-12 bg-white dark:bg-[#1a241b] rounded-lg p-4 transition-all duration-300 border cursor-pointer ${
                                                    isSelected
                                                        ? "shadow-lg border-2 border-emerald-500 scale-[1.01]"
                                                        : "border-gray-200 dark:border-gray-700 opacity-90 grayscale-[0.3]"
                                                }`}
                                            >
                                                <div
                                                    className={`absolute -left-13 top-6 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm z-10 ${
                                                        isSelected
                                                            ? "bg-emerald-500 text-white shadow-lg"
                                                            : "bg-white dark:bg-[#1a241b] text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700"
                                                    }`}
                                                >
                                                    {idx + 1}
                                                </div>
                                                <div className="flex gap-4">
                                                    <div className="relative w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                                                        {coursePlace.place.imageUrl && (
                                                            <Image
                                                                src={coursePlace.place.imageUrl}
                                                                alt=""
                                                                fill
                                                                className="object-cover"
                                                                loading="lazy"
                                                                quality={60}
                                                                sizes="96px"
                                                                placeholder="blur"
                                                                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxUf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                                                                // 🟢 priority 제거: 작은 썸네일이므로 lazy 로딩
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                                                            {coursePlace.place.category}
                                                        </span>
                                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate mb-1">
                                                            {coursePlace.place.name}
                                                        </h3>
                                                        <p className="text-xs text-gray-500 truncate mb-2">
                                                            {coursePlace.place.address}
                                                        </p>
                                                        {/* 🟢 예약 버튼 - 텍스트 한 줄 유지 */}
                                                        {coursePlace.place.reservationUrl && (
                                                            <a
                                                                href={coursePlace.place.reservationUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); // 부모 클릭 이벤트 차단
                                                                }}
                                                                className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] px-3 py-1.5 rounded-md font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap shrink-0"
                                                            >
                                                                <Icons.ExternalLink className="w-3 h-3 shrink-0" />
                                                                예약하기
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* 🔒 팁 섹션 - 코스 잠금 상태 및 유저 등급 기준으로 표시 (웹과 동일) */}
                                                {coursePlace.coaching_tip
                                                    ? (() => {
                                                          // 🔒 FREE 코스는 userTier 체크, BASIC/PREMIUM 코스는 isLocked 체크
                                                          const courseGrade = (
                                                              courseData.grade || "FREE"
                                                          ).toUpperCase();
                                                          const currentUserTier = (userTier || "FREE").toUpperCase();

                                                          // 🔒 FREE 코스 + FREE 유저 또는 잠긴 코스 → 버튼만 표시
                                                          const shouldShowTipButton =
                                                              (courseGrade === "FREE" && currentUserTier === "FREE") ||
                                                              courseData.isLocked;

                                                          if (shouldShowTipButton) {
                                                              // 🟢 [Fix]: 비로그인 유저와 로그인 유저 메시지 구분
                                                              const tipMessage = !isAuthenticated
                                                                  ? "로그인하고 숨겨진 꿀팁을 확인하세요!"
                                                                  : "BASIC 등급이면 볼 수 있어요";

                                                              return (
                                                                  <button
                                                                      onClick={(e) => {
                                                                          e.stopPropagation();
                                                                          if (isAuthenticated) {
                                                                              setShowSubscriptionModal(true);
                                                                          } else {
                                                                              setShowLoginModal(true);
                                                                          }
                                                                      }}
                                                                      className="mt-3 w-full text-left p-3 rounded-lg bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200 hover:border-amber-300 transition-all"
                                                                  >
                                                                      <div className="flex items-center gap-2 mb-1">
                                                                          <Icons.Bulb />
                                                                          <span className="text-xs font-bold text-amber-700">
                                                                              💡 팁
                                                                          </span>
                                                                      </div>
                                                                      <p className="text-xs text-gray-600 line-clamp-2">
                                                                          {tipMessage}
                                                                      </p>
                                                                  </button>
                                                              );
                                                          } else {
                                                              // 🔒 BASIC/PREMIUM 유저가 FREE 코스를 보거나, 권한이 있는 코스: 팁 표시
                                                              return (
                                                                  <div className="mt-3 p-3 rounded-lg bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200">
                                                                      <div className="flex items-center gap-2 mb-1">
                                                                          <Icons.Bulb />
                                                                          <span className="text-xs font-bold text-amber-700">
                                                                              💡 팁
                                                                          </span>
                                                                      </div>
                                                                      <p
                                                                          className="text-xs text-gray-700 leading-relaxed"
                                                                          style={{
                                                                              display: "-webkit-box",
                                                                              WebkitLineClamp: 3,
                                                                              WebkitBoxOrient: "vertical",
                                                                              overflow: "hidden",
                                                                              textOverflow: "ellipsis",
                                                                          }}
                                                                      >
                                                                          {coursePlace.coaching_tip}
                                                                      </p>
                                                                  </div>
                                                              );
                                                          }
                                                      })()
                                                    : null}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        <section
                            ref={reviewsSectionRef}
                            className="bg-white dark:bg-[#1a241b] rounded-lg p-8 shadow-lg border border-gray-100 dark:border-gray-800 mb-24"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    이용후기 <span className="text-emerald-500 ml-1">{reviews.length}</span>
                                </h2>
                                <button
                                    onClick={() => setShowReviewModal(true)}
                                    className="text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 rounded-lg border border-emerald-100 dark:border-emerald-800/50 transition-colors"
                                >
                                    작성하기
                                </button>
                            </div>
                            {reviews.length > 0 ? (
                                <div className="space-y-4">
                                    {reviews.map((review) => (
                                        <div key={review.id} className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-2xl">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm">
                                                        👤
                                                    </div>
                                                    <span className="font-bold text-sm text-gray-800 dark:text-gray-200">
                                                        {review.userName}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                                    {new Date(review.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-0.5 mb-3">
                                                {[...Array(5)].map((_, i) => (
                                                    <span
                                                        key={i}
                                                        className={`text-sm ${
                                                            i < review.rating
                                                                ? "text-yellow-400"
                                                                : "text-gray-200 dark:text-gray-600"
                                                        }`}
                                                    >
                                                        ★
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="text-[15px] text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
                                                {review.content}
                                            </p>
                                            {review.imageUrls && review.imageUrls.length > 0 && (
                                                <div className="grid grid-cols-3 gap-2 mt-3">
                                                    {review.imageUrls.map((imageUrl, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                                                            onClick={() => {
                                                                setPreviewImages(review.imageUrls || []);
                                                                setPreviewImageIndex(idx);
                                                                setPreviewImage(imageUrl);
                                                            }}
                                                        >
                                                            <Image
                                                                src={imageUrl}
                                                                alt={`후기 이미지 ${idx + 1}`}
                                                                fill
                                                                className="object-cover"
                                                                loading="lazy"
                                                                quality={65}
                                                                sizes="(max-width: 768px) 33vw, 150px"
                                                                placeholder="blur"
                                                                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxUf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                                                                // 🟢 priority 제거: 후기 이미지는 lazy 로딩
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-16 bg-gray-50 dark:bg-[#1a241b] rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                                    <p className="text-gray-600 dark:text-[#e7efe4] text-sm">
                                        아직 작성된 후기가 없어요.
                                        <br />첫 번째 후기를 남겨보세요!
                                    </p>
                                </div>
                            )}
                        </section>
                    </main>

                    {/* 🔵 [기능 유지] 지도 보기 플로팅 버튼 */}
                    <button
                        onClick={() => {
                            if (!isLoggedIn) {
                                setShowLoginModal(true);
                                return;
                            }
                            setModalSelectedPlace(null); // 모달 열 때 선택 초기화
                            setShowFullMapModal(true);
                        }}
                        className="fixed bottom-24 right-5 z-40 flex items-center gap-2 rounded-full bg-white dark:bg-[#1a241b] px-4 py-2.5 text-sm font-bold text-gray-800 dark:text-white shadow-xl border border-gray-100 dark:border-gray-700 active:scale-95 transition-all"
                    >
                        <Icons.Map className="w-4 h-4 text-emerald-500" />
                        <span>지도 보기</span>
                    </button>

                    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1a241b] border-t border-gray-100 dark:border-gray-800 px-6 py-4 z-40 shadow-lg flex items-center justify-between gap-4 max-w-[900px] mx-auto">
                        <div className="flex gap-4">
                            <button
                                onClick={handleSaveCourse}
                                className="flex flex-col items-center justify-center gap-0.5 text-gray-400 active:scale-90 transition-all"
                            >
                                {isSaved ? <Icons.LikeSolid /> : <Icons.LikeOutline />}
                                <span
                                    className={`text-[10px] font-medium ${isSaved ? "text-rose-500" : "text-gray-500"}`}
                                >
                                    찜하기
                                </span>
                            </button>
                            <button
                                onClick={() => setShowShareModal(true)}
                                className="flex flex-col items-center justify-center gap-0.5 text-gray-400 active:scale-90 transition-all"
                            >
                                <Icons.Share />
                                <span className="text-[10px] font-medium text-gray-500">공유</span>
                            </button>
                        </div>
                        <button
                            onClick={() => {
                                if (!isLoggedIn) {
                                    setShowLoginModal(true);
                                    return;
                                }
                                // 🟢 [Fix]: 사용자 제스처(버튼 클릭)에 의해서만 위치 정보 요청
                                handleMapActivation();
                                router.push(`/courses/${courseId}/start`);
                            }}
                            className="flex-1 h-14 bg-[#99c08e] text-white rounded-lg font-bold text-[16px] shadow-lg hover:bg-[#85ad78] active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Icons.Rocket /> 코스 시작하기
                        </button>
                    </div>
                </div>
            ) : (
                // 🔒 잠긴 경우: BlurComponent (흐릿한 이미지와 요약 정보만 표시)
                <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0f1710] font-sans text-gray-900 dark:text-white relative">
                    <header className="relative h-[400px] md:h-[500px] w-full max-w-[900px] mx-auto overflow-hidden">
                        <div className="relative w-full h-full">
                            {heroImageUrl && (
                                <Image
                                    src={heroImageUrl}
                                    alt={courseData.title}
                                    fill
                                    className="object-cover blur-md grayscale"
                                    priority
                                    loading="eager"
                                    quality={60}
                                    sizes="(max-width: 768px) 100vw, 33vw"
                                />
                            )}
                            <div className="absolute inset-0 bg-black/60" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center text-white px-6">
                                    <div className="mb-4">
                                        <svg
                                            className="w-16 h-16 mx-auto text-white/80"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                            />
                                        </svg>
                                    </div>
                                    <h1 className="text-2xl md:text-3xl font-extrabold mb-2">{courseData.title}</h1>
                                    {/* 🟢 [iOS/Android]: iOS/Android에서는 등급 안내 텍스트 숨김 */}
                                    {platform === "web" && (
                                        <p className="text-white/80 text-sm">
                                            {courseData.grade === "BASIC" ? "BASIC" : "PREMIUM"} 등급 이상만 이용
                                            가능합니다
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </header>
                </div>
            )}

            {/* 🔵 [기능 유지] 전체 지도 모달 */}
            {showFullMapModal && (
                <div
                    className="fixed inset-0 bg-black/60 z-6000 flex items-center justify-center p-5 animate-fade-in full-map-modal"
                    onClick={() => {
                        setModalSelectedPlace(null);
                        setShowFullMapModal(false);
                    }}
                >
                    <div
                        className="bg-white dark:bg-[#1a241b] rounded-lg w-full max-w-md aspect-4/5 overflow-hidden relative naver-map-container"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <NaverMap
                            places={mapPlaces}
                            userLocation={null}
                            selectedPlace={null}
                            onPlaceClick={handleMapPlaceClick}
                            drawPath={true}
                            numberedMarkers={true}
                            className="w-full h-full"
                            showControls={false}
                        />
                        {modalSelectedPlace ? (
                            <div className="absolute bottom-0 w-full bg-white dark:bg-[#1a241b] p-5 border-t-4 border-emerald-500 rounded-t-lg shadow-2xl z-20">
                                <div className="flex gap-4 items-center mb-4">
                                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden relative shrink-0">
                                        {modalSelectedPlace.imageUrl && (
                                            <Image
                                                src={modalSelectedPlace.imageUrl}
                                                alt=""
                                                fill
                                                className="object-cover"
                                                sizes="(max-width: 768px) 100vw, 33vw"
                                                // 🟢 모달이 열릴 때만 렌더링되므로 priority 적용 (즉시 로드)
                                                priority
                                                loading="eager"
                                            />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-900 dark:text-white truncate">
                                            {modalSelectedPlace.name}
                                        </h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {modalSelectedPlace.address}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setModalSelectedPlace(null)}
                                        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                    >
                                        <Icons.Close className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {/* 🟢 예약 버튼 추가 */}
                                    {(() => {
                                        const fullPlace = sortedCoursePlaces.find(
                                            (c) => c.place.id === modalSelectedPlace.id
                                        )?.place;
                                        return fullPlace?.reservationUrl ? (
                                            <a
                                                href={fullPlace.reservationUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full py-2.5 rounded-lg bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <Icons.ExternalLink className="w-4 h-4" />
                                                예약하기
                                            </a>
                                        ) : null;
                                    })()}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setShowFullMapModal(false);
                                                const cp = sortedCoursePlaces.find(
                                                    (c) => c.place.id === modalSelectedPlace.id
                                                );
                                                if (cp) handleTimelinePlaceClick(cp);
                                            }}
                                            className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white font-bold text-xs active:scale-95 transition-all"
                                        >
                                            상세보기
                                        </button>
                                        <button
                                            onClick={() => setModalSelectedPlace(null)}
                                            className="py-2.5 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs font-bold active:scale-95 transition-all"
                                        >
                                            닫기
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
                                <button
                                    onClick={() => {
                                        setModalSelectedPlace(null);
                                        setShowFullMapModal(false);
                                    }}
                                    className="bg-white dark:bg-[#1a241b] text-gray-900 dark:text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold border border-gray-100 dark:border-gray-700"
                                >
                                    지도 닫기 <Icons.Close className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 공유 모달 */}
            {showShareModal && (
                <div
                    className="fixed inset-0 bg-black/60 z-9999 flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setShowShareModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900">공유하기</h3>
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <Icons.Close className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleKakaoShare}
                                className="flex items-center gap-4 p-4 bg-[#FEE500] rounded-xl hover:bg-[#FDD835] transition-colors active:scale-95"
                            >
                                <Icons.Kakao />
                                <span className="font-bold text-gray-900">카카오톡으로 공유</span>
                            </button>
                            <button
                                onClick={handleCopyLink}
                                className="flex items-center gap-4 p-4 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors active:scale-95"
                            >
                                <Icons.Link />
                                <span className="font-bold text-gray-900">링크 복사</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ReviewModal
                isOpen={showReviewModal}
                onClose={() => setShowReviewModal(false)}
                courseId={parseInt(courseId)}
                courseName={courseData.title}
            />
            {/* 🟢 [IN-APP PURCHASE]: 모바일 앱에서만 표시 (TicketPlans 컴포넌트 내부에서도 체크) */}
            {showSubscriptionModal && (
                <TicketPlans
                    onClose={() => {
                        // 🔒 잠금된 코스에서 모달을 닫으면 즉시 홈으로 이동 (딜레이 없이)
                        if (courseData.isLocked) {
                            router.replace("/");
                            return; // 모달 상태 변경 없이 바로 이탈
                        }
                        setShowSubscriptionModal(false);
                    }}
                />
            )}
            {showLoginModal && (
                <LoginModal
                    onClose={() => {
                        // 🔒 잠금된 코스에서 모달을 닫으면 즉시 홈으로 이동 (딜레이 없이)
                        if (courseData.isLocked) {
                            router.replace("/");
                            return; // 모달 상태 변경 없이 바로 이탈
                        }
                        setShowLoginModal(false);
                    }}
                    // 🔒 잠긴 코스의 경우 next prop을 전달하지 않음 (자동 리다이렉트 방지)
                    next={courseData.isLocked ? undefined : `/courses/${courseId}`}
                />
            )}
            {showPlaceModal && selectedPlace && (
                <div
                    className="fixed inset-0 bg-black/60 z-9999 flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setShowPlaceModal(false)}
                >
                    <div
                        className="bg-white dark:bg-[#1a241b] rounded-lg w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative h-48 bg-gray-100 dark:bg-gray-800">
                            {selectedPlace.imageUrl && (
                                <Image
                                    src={selectedPlace.imageUrl}
                                    alt={selectedPlace.name}
                                    fill
                                    className="object-cover"
                                    priority
                                    loading="eager"
                                    quality={80}
                                    sizes="(max-width: 768px) 100vw, 33vw"
                                    fetchPriority="high"
                                />
                            )}
                            <button
                                onClick={() => setShowPlaceModal(false)}
                                className="absolute top-4 right-4 bg-black/30 text-white w-9 h-9 rounded-full flex items-center justify-center"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-5 text-black dark:text-white">
                            <h3 className="text-xl font-bold mb-2 dark:text-white">{selectedPlace.name}</h3>
                            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 font-medium">
                                {selectedPlace.address}
                            </p>
                            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap mb-6">
                                {selectedPlace.description || "상세 설명이 없습니다."}
                            </p>
                            {/* 🟢 팁 섹션 추가 */}
                            {(() => {
                                const coursePlace = sortedCoursePlaces.find((cp) => cp.place.id === selectedPlace.id);
                                const coachingTip = coursePlace?.coaching_tip;

                                if (!coachingTip) return null;

                                // 🟢 iOS/Android: 모든 Tip 무료 제공 (출시 기념 이벤트)
                                // 🔒 Web만: FREE 코스는 userTier 체크, BASIC/PREMIUM 코스는 isLocked 체크
                                const courseGrade = (courseData.grade || "FREE").toUpperCase();
                                const currentUserTier = (userTier || "FREE").toUpperCase();
                                const currentPlatform = isIOS() ? "ios" : "web";

                                // iOS/Android는 모든 Tip 무료, Web만 기존 로직 유지
                                const shouldShowTipButton =
                                    currentPlatform === "web" &&
                                    ((courseGrade === "FREE" && currentUserTier === "FREE") || courseData.isLocked);

                                if (shouldShowTipButton) {
                                    return (
                                        <div className="mb-5 p-3 rounded-lg bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <Icons.Bulb />
                                                <span className="text-xs font-bold text-amber-700">💡 DoNa's Tip</span>
                                            </div>
                                            <p className="text-xs text-gray-600">BASIC 등급이면 볼 수 있어요</p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="mb-5 p-3 rounded-lg bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Icons.Bulb />
                                            <span className="text-xs font-bold text-amber-700">💡 DoNa's Tip</span>
                                        </div>
                                        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                                            {coachingTip}
                                        </p>
                                    </div>
                                );
                            })()}
                            <div className="flex flex-col gap-2">
                                {/* 🟢 예약 버튼 추가 */}
                                {selectedPlace.reservationUrl && (
                                    <a
                                        href={selectedPlace.reservationUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-3 rounded-lg bg-emerald-500 text-white font-bold shadow-lg hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
                                    >
                                        <Icons.ExternalLink className="w-4 h-4" />
                                        예약하기
                                    </a>
                                )}
                                <button
                                    className="w-full py-3 rounded-lg bg-gray-900 text-white font-bold shadow-lg active:scale-95 transition-all text-sm"
                                    onClick={() => setShowPlaceModal(false)}
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 이미지 미리보기 모달 */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-9999 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => {
                        setPreviewImage(null);
                        setPreviewImages([]);
                        setPreviewImageIndex(0);
                    }}
                >
                    <button
                        className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 z-10"
                        onClick={() => {
                            setPreviewImage(null);
                            setPreviewImages([]);
                            setPreviewImageIndex(0);
                        }}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                    {previewImages.length > 1 && (
                        <>
                            <button
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/50 rounded-full p-2 z-10"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const prevIndex =
                                        previewImageIndex > 0 ? previewImageIndex - 1 : previewImages.length - 1;
                                    setPreviewImageIndex(prevIndex);
                                    setPreviewImage(previewImages[prevIndex]);
                                }}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 19l-7-7 7-7"
                                    />
                                </svg>
                            </button>
                            <button
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/50 rounded-full p-2 z-10"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const nextIndex =
                                        previewImageIndex < previewImages.length - 1 ? previewImageIndex + 1 : 0;
                                    setPreviewImageIndex(nextIndex);
                                    setPreviewImage(previewImages[nextIndex]);
                                }}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </button>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full z-10">
                                {previewImageIndex + 1} / {previewImages.length}
                            </div>
                        </>
                    )}
                    <div
                        className="relative w-full h-full flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={previewImage}
                            alt="후기 이미지 미리보기"
                            className="max-w-full max-h-full object-contain"
                        />
                    </div>
                </div>
            )}
        </>
    );
}
