"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "@/components/ImageFallback";
import dynamic from "next/dynamic";
import TicketPlans from "@/components/TicketPlans";
import { Place as MapPlace, UserLocation } from "@/types/map";

// --- 아이콘 (SVG) 완벽 정의 ---
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
    // [수정됨] className을 받을 수 있게 변경
    Close: ({ className }: { className?: string }) => (
        <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    // [추가됨] 팁 아이콘
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
    // [추가됨] 카카오톡 아이콘
    Kakao: () => (
        <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C5.373 3 0 6.663 0 11.182C0 14.07 1.83 16.63 4.67 18.11C4.54 18.57 3.82 21.05 3.77 21.23C3.73 21.46 3.98 21.58 4.15 21.46C4.19 21.43 7.84 18.96 8.35 18.63C9.52 18.82 10.74 18.92 12 18.92C18.627 18.92 24 15.257 24 10.738C24 6.219 18.627 3 12 3Z" />
        </svg>
    ),
    // [추가됨] 링크 아이콘
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
};

const ReviewModal = dynamic(() => import("@/components/ReviewModal"), { ssr: false, loading: () => null });
const NaverMap = dynamic(() => import("@/components/NaverMap"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-gray-100 rounded-[2rem] animate-pulse flex items-center justify-center text-gray-400">
            지도 로딩중...
        </div>
    ),
});

// --- 타입 정의 ---
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
    notes?: string;
    role_badge?: string | null;
    coaching_tip?: string | null;
    place: Place;
}

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
}

// --- Toast Component (수정됨: 성공 시 녹색 배경) ---
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

    // 배경색 로직 변경: 성공(success)일 때 emerald-500 사용
    const bgColor = type === "success" ? "bg-emerald-500" : type === "error" ? "bg-rose-500" : "bg-gray-900";

    return (
        <div
            className={`fixed top-6 left-1/2 -translate-x-1/2 ${bgColor} text-white px-6 py-3.5 rounded-full shadow-2xl z-[5000] animate-fade-in-down flex items-center gap-3 min-w-[320px] justify-center`}
        >
            <span className="text-lg">{type === "success" ? "🎉" : type === "error" ? "🚨" : "🔔"}</span>
            <span className="font-semibold text-sm tracking-wide">{message}</span>
        </div>
    );
};

interface CourseDetailClientProps {
    courseData: CourseData;
    initialReviews: Review[];
    courseId: string;
}

export default function CourseDetailClient({ courseData, initialReviews, courseId }: CourseDetailClientProps) {
    const router = useRouter();

    // --- State ---
    const [reviews, setReviews] = useState<Review[]>(initialReviews);
    const [isSaved, setIsSaved] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showPlaceModal, setShowPlaceModal] = useState(false);
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

    // 전체 지도 모달 State
    const [showFullMapModal, setShowFullMapModal] = useState(false);

    // 모달 내에서 선택된 장소 상태
    const [modalSelectedPlace, setModalSelectedPlace] = useState<MapPlace | null>(null);

    // 모달이 닫힐 때 선택 상태 초기화
    const handleCloseFullMapModal = () => {
        setShowFullMapModal(false);
        setModalSelectedPlace(null);
    };

    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const mapSectionRef = useRef<HTMLDivElement | null>(null);

    // --- Effects ---
    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            fetch("/api/users/favorites", { headers: { Authorization: `Bearer ${token}` } })
                .then((res) => (res.ok ? res.json() : []))
                .then((favorites) => {
                    const isFavorited = favorites.some((fav: any) => fav.course_id.toString() === courseId);
                    setIsSaved(isFavorited);
                })
                .catch(() => {});

            fetch("/api/users/interactions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ courseId: Number(courseId), action: "view" }),
            }).catch(() => {});
        }

        const key = `course_view_${courseId}`;
        const now = Date.now();
        const lastView = localStorage.getItem(key);
        if (!lastView || now - parseInt(lastView) > 30 * 60 * 1000) {
            fetch(`/api/courses/${courseId}/view`, { method: "POST" })
                .then(() => localStorage.setItem(key, String(now)))
                .catch(() => {});
        }
    }, [courseId]);

    useEffect(() => {
        if (!navigator.geolocation) return;
        const geoOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 };
        const onOk = (pos: GeolocationPosition) =>
            setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        navigator.geolocation.getCurrentPosition(onOk, () => {}, geoOptions);
    }, []);

    const sortedCoursePlaces = useMemo(() => {
        if (!courseData?.coursePlaces) return [];
        return [...courseData.coursePlaces].sort((a, b) => a.order_index - b.order_index);
    }, [courseData?.coursePlaces]);

    useEffect(() => {
        if (sortedCoursePlaces.length > 0 && !selectedPlace) {
            setSelectedPlace(sortedCoursePlaces[0].place);
        }
    }, [sortedCoursePlaces, selectedPlace]);

    const heroImageUrl = useMemo(() => {
        if (courseData?.imageUrl) return courseData.imageUrl;
        if (sortedCoursePlaces.length > 0) return sortedCoursePlaces[0].place.imageUrl || undefined;
        return "";
    }, [courseData?.imageUrl, sortedCoursePlaces]);

    // --- Handlers ---
    const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
        setToast({ message, type });
    }, []);

    const handleTimelinePlaceClick = (coursePlace: CoursePlace) => {
        setSelectedPlace(coursePlace.place);
        try {
            const el = mapSectionRef.current;
            if (el) {
                const rect = el.getBoundingClientRect();
                const top = (window.scrollY || window.pageYOffset) + rect.top - 120;
                window.scrollTo({ top, behavior: "smooth" });
            }
        } catch {}
    };

    const handlePlaceDetailClick = (coursePlace: CoursePlace, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedPlace(coursePlace.place);
        setShowPlaceModal(true);
    };

    const fetchReviews = useCallback(async () => {
        if (!courseId) return;
        try {
            const response = await fetch(`/api/reviews?courseId=${courseId}`);
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data))
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
        } catch (error) {
            console.error(error);
        }
    }, [courseId]);

    const handleSaveCourse = async () => {
        const token = localStorage.getItem("authToken");
        if (!token) {
            showToast("로그인이 필요합니다.", "error");
            router.push("/login");
            return;
        }

        const nextState = !isSaved;
        setIsSaved(nextState);
        showToast(nextState ? "코스를 찜했어요! 💖" : "찜 목록에서 삭제했어요.", "success");

        try {
            const endpoint = `/api/users/favorites`;
            const method = isSaved ? "DELETE" : "POST";
            const url = isSaved ? `${endpoint}?courseId=${courseId}` : endpoint;
            const body = isSaved ? undefined : JSON.stringify({ courseId });

            await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body,
            });
            window.dispatchEvent(new CustomEvent("favoritesChanged"));
        } catch (error) {
            setIsSaved(!nextState);
            showToast("요청 처리에 실패했습니다.", "error");
        }
    };

    const handleShareCourse = () => setShowShareModal(true);

    const handleKakaoShare = async () => {
        const url = typeof window !== "undefined" ? window.location.href : "";
        try {
            const ensureKakao = () =>
                new Promise<void>((resolve, reject) => {
                    const w = window as any;
                    if (w.Kakao) return resolve();
                    const s = document.createElement("script");
                    s.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
                    s.async = true;
                    s.onload = () => resolve();
                    s.onerror = () => reject(new Error("Kakao SDK load failed"));
                    document.head.appendChild(s);
                });
            await ensureKakao();
            const w = window as any;
            const Kakao = w.Kakao;
            const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
            if (!Kakao.isInitialized()) Kakao.init(jsKey);

            Kakao.Share.sendDefault({
                objectType: "feed",
                content: {
                    title: courseData.title,
                    description: courseData.description,
                    imageUrl:
                        heroImageUrl || "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/logo/donalogo_512.png",
                    link: { mobileWebUrl: url, webUrl: url },
                },
                buttons: [{ title: "코스 보러가기", link: { mobileWebUrl: url, webUrl: url } }],
            });
            setShowShareModal(false);
        } catch (error) {
            try {
                await navigator.clipboard.writeText(url);
                showToast("링크가 복사되었습니다.", "success");
            } catch {}
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setShowShareModal(false);
            showToast("링크가 클립보드에 복사되었습니다.", "success");
        } catch {
            showToast("링크 복사 실패", "error");
        }
    };

    // ... (imports)

    // --- 🔒 잠금 화면 (Modern Commercial Style) ---
    if (courseData.isLocked) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50/50 backdrop-blur-sm">
                <div className="bg-white rounded-[24px] p-8 max-w-[360px] w-full text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 relative">
                    {/* 1. 세련된 아이콘 영역 (이모지 제거 -> 벡터 아이콘 적용) */}
                    <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 ring-1 ring-emerald-100/50">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-8 h-8 text-emerald-600"
                        >
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                    </div>

                    {/* 2. 타이포그래피 & 배지 (절제된 디자인) */}
                    <div className="space-y-2 mb-8">
                        <div className="flex justify-center mb-3">
                            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-[11px] font-bold uppercase tracking-wider border border-gray-200">
                                {courseData.grade} Membership
                            </span>
                        </div>

                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">멤버십 전용 콘텐츠입니다</h2>

                        <p className="text-gray-500 text-sm leading-relaxed font-medium">
                            <span className="text-gray-800 font-semibold border-b border-gray-200 pb-0.5">
                                "{courseData.title}"
                            </span>
                            <br />
                            상세 코스는 멤버십 가입 후 열람 가능합니다.
                        </p>
                    </div>

                    {/* 3. 액션 버튼 (직관적이고 단단한 느낌) */}
                    <div className="space-y-3">
                        <button
                            onClick={() => setShowSubscriptionModal(true)}
                            className="w-full py-3.5 rounded-xl bg-gray-900 text-white font-semibold text-[15px] hover:bg-gray-800 transition-colors shadow-sm flex items-center justify-center gap-2"
                        >
                            <span>지금 시작하기</span>
                            {/* '결제하기' 같은 부담스러운 말 대신 '시작하기' 사용 */}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="w-4 h-4 text-gray-400"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </button>

                        <button
                            onClick={() => router.back()}
                            className="w-full py-3 rounded-xl text-gray-500 font-medium text-[14px] hover:text-gray-800 hover:bg-gray-50 transition-colors"
                        >
                            다음에 볼래요
                        </button>
                    </div>
                </div>

                {/* 결제 모달 */}
                {showSubscriptionModal && <TicketPlans onClose={() => setShowSubscriptionModal(false)} />}
            </div>
        );
    }

    return (
        <>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* --- Main Background --- */}
            <div className="min-h-screen bg-[#F8F9FA] font-sans text-gray-900 relative">
                {/* 1. Hero Section */}
                <header className="relative h-[400px] w-full max-w-[600px] mx-auto">
                    <div className="absolute inset-0">
                        <Image src={heroImageUrl || ""} alt={courseData.title} fill className="object-cover" priority />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute inset-0 bg-black/10" />
                    </div>

                    <div className="absolute bottom-0 left-0 w-full p-6 pb-14">
                        <div className="max-w-[600px] mx-auto">
                            {/* Badges */}
                            <div className="flex flex-wrap items-center gap-2.5 mb-4 animate-fade-in-up">
                                <span className="px-3.5 py-1.5 bg-white/20 backdrop-blur-md text-white text-[13px] font-bold rounded-full border border-white/20 flex items-center gap-1 shadow-sm">
                                    📍 {courseData.region || "서울"}
                                </span>
                                {courseData.target_situation && (
                                    <span className="px-3.5 py-1.5 bg-rose-500/80 backdrop-blur-md text-white text-[13px] font-bold rounded-full shadow-sm border border-white/10">
                                        {courseData.target_situation === "SOME"
                                            ? "💘 썸 탈출"
                                            : `#${courseData.target_situation}`}
                                    </span>
                                )}
                            </div>

                            {courseData.sub_title && (
                                <p className="text-sm font-bold text-emerald-300 mb-2 tracking-wide uppercase drop-shadow-md">
                                    {courseData.sub_title}
                                </p>
                            )}

                            <h1 className="text-2xl font-extrabold text-white leading-tight tracking-tight break-keep drop-shadow-xl mb-6">
                                {courseData.title}
                            </h1>

                            <div className="flex items-center gap-3 text-white/90 text-xs font-semibold">
                                <div className="bg-black/30 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 flex items-center gap-1.5">
                                    <span>👣</span> {courseData.coursePlaces?.length || 0} 스팟
                                </div>
                                <div className="bg-black/30 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 flex items-center gap-1.5">
                                    <span>⏳</span> {courseData.duration}
                                </div>
                                <div className="bg-black/30 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 flex items-center gap-1.5">
                                    <span className="text-yellow-400">★</span> {courseData.rating}
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* 2. Main Content Wrapper */}
                <main className="max-w-[600px] mx-auto -mt-8 relative z-10 px-5 space-y-10">
                    {/* Course Intro Card */}
                    <section className="bg-white rounded-[2rem] p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                            <h2 className="text-xl font-bold text-gray-900">어떤 코스인가요?</h2>
                        </div>
                        <p className="text-gray-600 text-[15px] leading-8 whitespace-pre-wrap font-medium">
                            {courseData.description}
                        </p>
                    </section>

                    {/* Naver Map (Embedded) */}
                    <section
                        ref={mapSectionRef}
                        className="bg-white rounded-[2rem] p-4 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)]"
                    >
                        <div className="relative rounded-3xl overflow-hidden shadow-inner border border-gray-100">
                            {sortedCoursePlaces.length > 0 ? (
                                <NaverMap
                                    places={sortedCoursePlaces.map((cp) => ({
                                        id: cp.place.id,
                                        name: cp.place.name,
                                        latitude: cp.place.latitude,
                                        longitude: cp.place.longitude,
                                        address: cp.place.address,
                                        imageUrl: cp.place.imageUrl,
                                        description: cp.place.description,
                                        orderIndex: cp.order_index,
                                    }))}
                                    userLocation={null}
                                    selectedPlace={selectedPlace}
                                    onPlaceClick={(mapPlace: MapPlace) => {
                                        const fullPlace = sortedCoursePlaces.find(
                                            (cp) => cp.place.id === mapPlace.id
                                        )?.place;
                                        if (fullPlace) setSelectedPlace(fullPlace);
                                    }}
                                    drawPath={true}
                                    numberedMarkers={true}
                                    className="w-full h-[320px]"
                                    showControls={false}
                                />
                            ) : (
                                <div className="h-64 bg-gray-50 flex items-center justify-center text-gray-400">
                                    지도 정보 없음
                                </div>
                            )}

                            <div className="absolute bottom-4 right-4">
                                <button
                                    className="bg-white/90 backdrop-blur text-gray-800 text-xs font-bold px-4 py-2.5 rounded-full shadow-lg border border-gray-100 flex items-center gap-1.5 hover:bg-white transition-colors"
                                    onClick={() =>
                                        window.open(
                                            `https://map.naver.com/v5/search/${encodeURIComponent(
                                                sortedCoursePlaces[0]?.place.name
                                            )}`
                                        )
                                    }
                                >
                                    <Icons.Map className="w-4 h-4" />
                                    <span>지도 앱에서 보기</span>
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* ★ Timeline Section (Color Fix Applied) ★ */}
                    <section className="relative px-4 pb-20">
                        {/* 수직 선: 은은한 점선 */}
                        <div className="absolute left-[34px] top-4 bottom-0 w-[2px] border-l-2 border-dashed border-gray-200" />

                        <div className="space-y-8">
                            {sortedCoursePlaces.map((coursePlace, idx) => {
                                const isSelected = selectedPlace?.id === coursePlace.place.id;
                                const isLast = idx === sortedCoursePlaces.length - 1;

                                return (
                                    <div key={coursePlace.id} className="relative">
                                        {/* 1. 장소 카드 (Card) */}
                                        <div
                                            onClick={() => handleTimelinePlaceClick(coursePlace)}
                                            className={`
                                                relative ml-12 bg-white rounded-3xl p-4 transition-all duration-300
                                                ${
                                                    isSelected
                                                        ? "shadow-[0_8px_30px_rgba(34,197,94,0.15)] border-2 border-emerald-500 scale-[1.02]"
                                                        : "shadow-sm border border-gray-100 opacity-90 grayscale-[0.3] hover:grayscale-0 hover:opacity-100"
                                                }
                                            `}
                                        >
                                            {/* 왼쪽 숫자 배지 (카드 밖으로 뺌) - 선택 시 녹색(emerald-500)으로 변경 */}
                                            <div
                                                className={`
                                                    absolute -left-[3.25rem] top-6 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm z-10 transition-colors
                                                    ${
                                                        isSelected
                                                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
                                                            : "bg-white text-gray-400 border border-gray-200"
                                                    }
                                                `}
                                            >
                                                {idx + 1}
                                            </div>

                                            {/* 이미지 & 정보 */}
                                            <div className="flex gap-4">
                                                <div className="relative w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-100">
                                                    {coursePlace.place.imageUrl ? (
                                                        <Image
                                                            src={coursePlace.place.imageUrl}
                                                            alt=""
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    ) : (
                                                        <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-300">
                                                            No Img
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    {/* 카테고리 & 역할 배지 */}
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                            {coursePlace.place.category}
                                                        </span>
                                                        {coursePlace.role_badge && (
                                                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-bold">
                                                                {coursePlace.role_badge}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="font-bold text-lg text-gray-900 truncate mb-1">
                                                        {coursePlace.place.name}
                                                    </h3>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {coursePlace.place.address}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Dona Pick (선택되었을 때만 확장해서 보여줌) */}
                                            {isSelected && (coursePlace.coaching_tip || coursePlace.notes) && (
                                                <div className="mt-4 pt-4 border-t border-dashed border-gray-100 animate-fade-in-down">
                                                    <div className="flex gap-2 items-start bg-amber-50 p-3 rounded-xl">
                                                        <div className="pt-0.5">
                                                            <Icons.Bulb />
                                                        </div>
                                                        <p className="text-xs text-gray-700 leading-5 font-medium">
                                                            <span className="font-bold text-emerald-600 block mb-0.5">
                                                                DoNa's Tip
                                                            </span>
                                                            {coursePlace.coaching_tip || coursePlace.notes}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* Review Section */}
                    <section className="bg-white rounded-[2rem] p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] mb-24">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-xl font-bold text-gray-900">
                                이용후기 <span className="text-emerald-500 ml-1">{reviews.length}</span>
                            </h2>
                            <button
                                onClick={() => setShowReviewModal(true)}
                                className="text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl hover:bg-emerald-100 transition-colors"
                            >
                                작성하기
                            </button>
                        </div>
                        {reviews.length > 0 ? (
                            <div className="space-y-4">
                                {reviews.map((review) => (
                                    <div key={review.id} className="bg-gray-50 p-5 rounded-2xl">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm">
                                                    👤
                                                </div>
                                                <span className="font-bold text-sm text-gray-800">
                                                    {review.userName}
                                                </span>
                                            </div>
                                            <span className="text-xs text-gray-400">
                                                {new Date(review.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-0.5 mb-3">
                                            {[...Array(5)].map((_, i) => (
                                                <span
                                                    key={i}
                                                    className={`text-sm ${
                                                        i < review.rating ? "text-yellow-400" : "text-gray-200"
                                                    }`}
                                                >
                                                    ★
                                                </span>
                                            ))}
                                        </div>
                                        <p className="text-[15px] text-gray-600 leading-relaxed">{review.content}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <p className="text-gray-400 text-sm">
                                    아직 작성된 후기가 없어요.
                                    <br />첫 번째 후기를 남겨보세요!
                                </p>
                            </div>
                        )}
                    </section>
                </main>

                {/* ✨✨✨ [NEW] 플로팅 전체 지도 보기 버튼 (항상 표시) ✨✨✨ */}
                <button
                    onClick={() => setShowFullMapModal(true)}
                    className="fixed bottom-24 right-5 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-gray-800 shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-transform active:scale-95 border border-gray-100 lg:right-[calc(50%-300px+20px)]"
                >
                    <Icons.Map className="w-4 h-4 text-emerald-500" />
                    <span>지도 보기</span>
                </button>

                {/* --- Mobile Bottom Floating Bar (Desktop에서도 표시) --- */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4 z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.04)] flex items-center justify-between gap-4 mx-auto lg:max-w-[600px]">
                    <div className="flex gap-4">
                        <button
                            onClick={handleSaveCourse}
                            className="flex flex-col items-center justify-center gap-0.5 text-gray-400 transition-colors active:scale-90"
                        >
                            {isSaved ? <Icons.LikeSolid /> : <Icons.LikeOutline />}
                            <span className={`text-[10px] font-medium ${isSaved ? "text-rose-500" : "text-gray-500"}`}>
                                찜하기
                            </span>
                        </button>
                        <button
                            onClick={handleShareCourse}
                            className="flex flex-col items-center justify-center gap-0.5 text-gray-400 transition-colors active:scale-90"
                        >
                            <Icons.Share />
                            <span className="text-[10px] font-medium text-gray-500">공유</span>
                        </button>
                    </div>
                    <button
                        onClick={() => router.push(`/courses/${courseId}/start`)}
                        className="flex-1 h-14 bg-[#99c08e] text-white rounded-2xl font-bold text-[16px] 
               shadow-xl shadow-gray-300 transition-all 
               hover:bg-[#85ad78] active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Icons.Rocket /> 코스 시작하기
                    </button>
                </div>
            </div>

            {/* Modals */}
            {showShareModal && (
                <div
                    className="fixed inset-0 bg-black/60 z-[9999] flex items-end md:items-center justify-center p-4 animate-fade-in"
                    onClick={() => setShowShareModal(false)}
                >
                    <div
                        className="bg-white rounded-t-[2rem] md:rounded-[2rem] w-full max-w-sm p-8 shadow-2xl animate-slide-up-mobile"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8 md:hidden" />
                        <h3 className="font-bold text-xl mb-8 text-center text-gray-900">어디로 공유할까요?</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={handleKakaoShare}
                                className="flex flex-col items-center justify-center gap-3 p-6 bg-[#FAE100] rounded-3xl hover:brightness-95 transition-all"
                            >
                                <div className="w-12 h-12 bg-white/30 rounded-full flex items-center justify-center mb-1">
                                    <Icons.Kakao />
                                </div>
                                <span className="font-bold text-[15px] text-[#371D1E]">카카오톡</span>
                            </button>
                            <button
                                onClick={handleCopyLink}
                                className="flex flex-col items-center justify-center gap-3 p-6 bg-gray-100 rounded-3xl hover:bg-gray-200 transition-all"
                            >
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-1 shadow-sm">
                                    <Icons.Link />
                                </div>
                                <span className="font-bold text-[15px] text-gray-700">링크 복사</span>
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

            {/* Place Detail Modal */}
            {showPlaceModal && selectedPlace && (
                <div
                    className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setShowPlaceModal(false)}
                >
                    <div
                        className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative h-72 bg-gray-100">
                            {selectedPlace.imageUrl && (
                                <Image
                                    src={selectedPlace.imageUrl}
                                    alt={selectedPlace.name}
                                    fill
                                    className="object-cover"
                                />
                            )}
                            <button
                                onClick={() => setShowPlaceModal(false)}
                                className="absolute top-4 right-4 bg-black/30 backdrop-blur-md text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/50 transition-colors"
                            >
                                ×
                            </button>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            <div className="absolute bottom-6 left-6 text-white">
                                <h3 className="text-2xl font-bold mb-1">{selectedPlace.name}</h3>
                                <p className="opacity-90 text-sm font-medium">{selectedPlace.address}</p>
                            </div>
                        </div>
                        <div className="p-8">
                            <p className="text-gray-600 text-[15px] leading-relaxed whitespace-pre-wrap mb-8">
                                {selectedPlace.description || "상세 설명이 없습니다."}
                            </p>
                            <button
                                className="w-full py-4 rounded-2xl bg-gray-900 text-white font-bold text-[16px] hover:bg-black transition-colors shadow-xl"
                                onClick={() => setShowPlaceModal(false)}
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✨✨✨ [NEW] 전체 경로 지도 모달 (정보 카드 포함) ✨✨✨ */}
            {showFullMapModal && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[6000] flex items-center justify-center p-5 animate-fade-in"
                    onClick={handleCloseFullMapModal}
                >
                    <div
                        className="bg-white rounded-[1.5rem] w-full max-w-md aspect-[4/5] overflow-hidden shadow-2xl relative flex flex-col ring-1 ring-black/5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 지도 영역 (꽉 차게 배치) */}
                        <div className="absolute inset-0 w-full h-full bg-gray-100">
                            <NaverMap
                                places={sortedCoursePlaces.map((cp) => ({
                                    id: cp.place.id,
                                    name: cp.place.name,
                                    latitude: cp.place.latitude,
                                    longitude: cp.place.longitude,
                                    address: cp.place.address,
                                    imageUrl: cp.place.imageUrl,
                                    description: cp.place.description,
                                    orderIndex: cp.order_index,
                                }))}
                                userLocation={null}
                                selectedPlace={null}
                                onPlaceClick={(place: MapPlace) => setModalSelectedPlace(place)}
                                drawPath={true}
                                numberedMarkers={true}
                                className="w-full h-full"
                                showControls={false}
                            />
                        </div>

                        {/* ✨ [NEW] 하단 플로팅 닫기 버튼 (지도 위에 알약 모양으로 띄움) */}
                        <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10 pointer-events-none">
                            <button
                                onClick={handleCloseFullMapModal}
                                className="bg-white text-gray-900 text-[14px] font-bold px-6 py-3 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex items-center gap-2 border border-gray-100 transition-transform active:scale-95 pointer-events-auto"
                            >
                                <span>지도 닫기</span>
                                <Icons.Close className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>

                        {/* ✨ [NEW] 하단 플로팅 정보 카드 (선택 시 올라옴) */}
                        <div
                            className={`absolute bottom-0 w-full bg-white transition-transform duration-300 ease-out z-20 
                                ${modalSelectedPlace ? "translate-y-0" : "translate-y-full"}
                            `}
                        >
                            {modalSelectedPlace && (
                                <div className="p-5 border-t-4 border-emerald-500/80 rounded-t-[1.5rem] shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
                                    <div className="flex gap-4 items-center">
                                        <div className="flex-none w-16 h-16 bg-gray-100 rounded-xl overflow-hidden relative">
                                            {modalSelectedPlace.imageUrl && (
                                                <Image
                                                    src={modalSelectedPlace.imageUrl}
                                                    alt={modalSelectedPlace.name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            )}
                                            <span className="absolute top-1 left-1 bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                                {
                                                    sortedCoursePlaces.find(
                                                        (cp) => cp.place.id === modalSelectedPlace.id
                                                    )?.order_index
                                                }
                                            </span>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-gray-500 mb-0.5 uppercase">
                                                {modalSelectedPlace.category}
                                            </p>
                                            <h4 className="text-lg font-bold truncate mb-1">
                                                {modalSelectedPlace.name}
                                            </h4>
                                            <p className="text-sm text-gray-600 truncate">
                                                {modalSelectedPlace.address}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex gap-3">
                                        <button
                                            onClick={() => {
                                                handleCloseFullMapModal();
                                                const coursePlace = sortedCoursePlaces.find(
                                                    (cp) => cp.place.id === modalSelectedPlace.id
                                                );
                                                if (coursePlace) handleTimelinePlaceClick(coursePlace);
                                            }}
                                            className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-[13px] font-bold hover:bg-black transition-colors"
                                        >
                                            상세 페이지로 이동
                                        </button>
                                        <button
                                            onClick={() => setModalSelectedPlace(null)}
                                            className="flex-none w-1/4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-[13px] font-bold hover:bg-gray-50 transition-colors"
                                        >
                                            닫기
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
