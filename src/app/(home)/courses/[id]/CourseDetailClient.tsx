"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "@/components/ImageFallback";
import dynamic from "next/dynamic";
import TicketPlans from "@/components/TicketPlans";
import LoginModal from "@/components/LoginModal";
import { type LoginModalPresetKey } from "@/constants/loginModalPresets";
import BridgeModal, { checkAndClearOpenSubscriptionAfterLogin } from "@/components/BridgeModal";
import { Place as MapPlace, UserLocation } from "@/types/map";
import { apiFetch, authenticatedFetch } from "@/lib/authClient";
import { getS3StaticUrl } from "@/lib/s3Static";
import { useAuth } from "@/context/AuthContext";
import TapFeedback from "@/components/TapFeedback";
import { TipSection, TipCategoryIcon } from "@/components/TipSection";
import { parseTipsFromDb, FREE_TIP_CATEGORIES, PAID_TIP_CATEGORIES } from "@/types/tip";
import { getPremiumQuestions } from "../../../../lib/placeCategory";
import { getPlaceStatus } from "@/lib/placeStatus";
import PlaceStatusBadge from "@/components/PlaceStatusBadge";
import { isAndroid, isIOS, isMobileApp } from "@/lib/platform";
import { useLocale } from "@/context/LocaleContext";
import { useAppLayout } from "@/context/AppLayoutContext";
import { useTranslatedTitle } from "@/hooks/useTranslatedTitle";

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
    Close: ({ className }: { className?: string }) => (
        <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    Bulb: ({ className }: { className?: string }) => (
        <svg
            className={className || "w-4 h-4 text-emerald-500 shrink-0"}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
        </svg>
    ),
    Lock: ({ className }: { className?: string }) => (
        <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
        </svg>
    ),
    Crown: ({ className }: { className?: string }) => (
        <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2 17h20" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 17V8l5-4 5 4v9" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 17l3-6 3 4 3-6 3 4 3-6" />
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
    ArrowLeft: ({ className }: { className?: string }) => (
        <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" // 그림자로 가독성 확보
        >
            <path d="M15 18L9 12L15 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
};

const ReviewModal = dynamic(() => import("@/components/ReviewModal"), { ssr: false, loading: () => null });

function MapLoadingPlaceholder() {
    const { t } = useLocale();
    return (
        <div className="w-full h-full bg-gray-100 rounded-lg animate-pulse flex items-center justify-center text-gray-400">
            {t("courseDetail.mapLoading")}
        </div>
    );
}
const NaverMap = dynamic(() => import("@/components/NaverMap"), {
    ssr: false,
    loading: () => <MapLoadingPlaceholder />,
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
    segment?: string | null;
    order_in_segment?: number | null;
    estimated_duration: number;
    recommended_time: string;
    coaching_tip?: string | null; // 유료 팁
    coaching_tip_free?: string | null; // 무료 팁
    hasPaidTip?: boolean; // 서버 전달: 유료 팁 존재 여부(내용 숨김 시 잠김 영역 표시용)
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
    budget_range?: string | null;
    duration: string;
    price?: string;
    imageUrl: string;
    concept: string;
    rating: number;
    isPopular: boolean;
    grade?: "FREE" | "BASIC" | "PREMIUM";
    isLocked?: boolean;
    isSelectionType?: boolean;
    recommended_start_time: string;
    season: string;
    courseType: string;
    transportation: string;
    reservationRequired: boolean;
    createdAt: string;
    updatedAt: string;
    highlights?: any[];
    coursePlaces?: CoursePlace[];
    tags?: {
        mood?: string[];
        goal?: string;
        budget?: string;
        target?: string[];
        [key: string]: any;
    };
}

export interface Review {
    id: number;
    rating: number;
    userName: string;
    createdAt: string;
    content: string;
    imageUrls?: string[];
}

// 선택형 코스 세그먼트 순서·라벨 (Admin과 동일)
const SEGMENT_ORDER = ["brunch", "lunch", "cafe", "dinner", "bar", "date"];
const SEGMENT_LABELS: Record<string, string> = {
    brunch: "브런치",
    lunch: "점심",
    cafe: "카페",
    dinner: "저녁",
    bar: "바",
    date: "데이트",
};
// 세그먼트별 섹션 헤더 아이콘(이모지) - 이미지 레이아웃용
const SEGMENT_ICONS: Record<string, string> = {
    brunch: "🥐",
    lunch: "🍽",
    cafe: "☕",
    dinner: "🍷",
    bar: "🍸",
    date: "💑",
};

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
        const timer = setTimeout(onClose, 1000);
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
    const router = useRouter();
    const { t, locale } = useLocale();
    const translatedTitle = useTranslatedTitle(courseData?.title, locale);
    const translatedSubTitle = useTranslatedTitle(courseData?.sub_title || "", locale);
    // 🟢 [Fix]: 로그인 확인 중이거나 데이터가 유실된 경우를 대비한 가드 클로즈(Guard Clause)
    if (!courseData) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <p className="text-gray-500">{t("courseDetail.loading")}</p>
                </div>
            </div>
        );
    }
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [platform, setPlatform] = useState<"ios" | "android" | "web">("web");
    const [inApp, setInApp] = useState(false);
    const { containInPhone, modalContainerRef } = useAppLayout();

    // 🟢 플랫폼 감지 (iOS / Android / web) + 앱 WebView 여부 (하단바·지도버튼 위로 올리기)
    useEffect(() => {
        setPlatform(isIOS() ? "ios" : isAndroid() ? "android" : "web");
        setInApp(isMobileApp());
    }, []);
    // 🟢 앱에서 onLoadEnd 후 donaAppReady 이벤트로 재반영
    useEffect(() => {
        const onReady = () => setInApp(isMobileApp());
        window.addEventListener("donaAppReady", onReady);
        return () => window.removeEventListener("donaAppReady", onReady);
    }, []);

    // 🟢 성능 최적화: 코스 상세 페이지 진입 시 메인 페이지를 미리 로드하여 빠른 전환 보장
    useEffect(() => {
        router.prefetch("/");
    }, [router]);

    // 🟢 나만의 추억 클릭 시 빠른 진입: start 페이지 미리 prefetch
    useEffect(() => {
        if (courseId) router.prefetch(`/courses/${courseId}/start`);
    }, [courseId, router]);

    // 🟢 나만의 추억: 로그인 시 한도 체크 API 미리 요청 → 클릭 시 대기 없이 진입
    useEffect(() => {
        if (!isAuthenticated || authLoading || memoryCountPromiseRef.current) return;
        memoryCountPromiseRef.current = (async () => {
            const { authenticatedFetch } = await import("@/lib/authClient");
            return authenticatedFetch<{
                count: number;
                limit: number | null;
                tier: string;
            }>("/api/users/me/memory-count");
        })();
    }, [isAuthenticated, authLoading]);

    // --- State ---
    const [reviews, setReviews] = useState<Review[]>(initialReviews);
    const [isSaved, setIsSaved] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showPlaceModal, setShowPlaceModal] = useState(false);
    const [placeModalSlideUp, setPlaceModalSlideUp] = useState(false);
    const [placeModalDragY, setPlaceModalDragY] = useState(0);
    const placeModalDragStartY = useRef(0);
    const placeModalDragYRef = useRef(0);
    const placeModalHandleRef = useRef<HTMLElement | null>(null);
    const placeModalPointerIdRef = useRef<number | null>(null);
    const placeModalScrollRef = useRef<HTMLDivElement | null>(null);
    const [shareModalSlideUp, setShareModalSlideUp] = useState(false);
    // 🔒 [접근 제어] 잠긴 코스는 useEffect에서 인증 상태 확인 후 모달 표시 (미로그인 → 로그인 모달, 로그인 → TicketPlans)
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    // TIPS: 유료 팁 CTA로 열림 | COURSE: 코스 잠금으로 열림 (모달 카피 분기용)
    const [subscriptionModalContext, setSubscriptionModalContext] = useState<"TIPS" | "COURSE">("COURSE");
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginModalPreset, setLoginModalPreset] = useState<LoginModalPresetKey>("courseDetail");
    const [showBridgeModal, setShowBridgeModal] = useState(false);
    const [showMemoryLimitModal, setShowMemoryLimitModal] = useState(false);
    const [memoryLimitModalSlideUp, setMemoryLimitModalSlideUp] = useState(false);
    const [showFavoriteAddedModal, setShowFavoriteAddedModal] = useState(false);
    const [favoriteSheetType, setFavoriteSheetType] = useState<"added" | "removed">("added");
    const [favoriteModalSlideUp, setFavoriteModalSlideUp] = useState(false);
    // 🟢 예약/네이버 지도 하단 시트 (아래에서 위로, 헤더 아래까지)
    const [showWebSheet, setShowWebSheet] = useState(false);
    const [webSheetUrl, setWebSheetUrl] = useState<string>("");
    const [webSheetSlideUp, setWebSheetSlideUp] = useState(false);
    const [webSheetDragY, setWebSheetDragY] = useState(0);
    const webSheetDragStartY = useRef(0);
    const webSheetDragYRef = useRef(0);
    const webSheetHandleRef = useRef<HTMLElement | null>(null);
    const webSheetPointerIdRef = useRef<number | null>(null);

    // 🔒 [접근 제어] 인증 상태 확인 후 잠긴 코스의 모달 타입 결정
    useEffect(() => {
        if (authLoading || !courseData.isLocked) return;

        // 🟢 비로그인 유저 → 로그인 모달만 표시 (상세 보기용)
        if (!isAuthenticated) {
            setLoginModalPreset("courseDetail");
            setShowLoginModal(true);
            setShowSubscriptionModal(false);
        } else {
            // 🟢 로그인 유저 → TicketPlans만 표시 (코스 잠금 = COURSE 컨텍스트)
            setSubscriptionModalContext("COURSE");
            setShowSubscriptionModal(true);
            setShowLoginModal(false);
        }
    }, [courseData.isLocked, isAuthenticated, authLoading]);

    // 🟢 브릿지 모달 → 로그인 후 돌아왔을 때 구독 모달 자동 오픈
    useEffect(() => {
        if (authLoading || !isAuthenticated) return;
        if (checkAndClearOpenSubscriptionAfterLogin()) {
            // BridgeModal은 팁 CTA에서만 표시됨 → TIPS 컨텍스트
            setSubscriptionModalContext("TIPS");
            setShowSubscriptionModal(true);
            setShowLoginModal(false);
            setShowBridgeModal(false);
        }
    }, [isAuthenticated, authLoading]);

    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [activeCourse, setActiveCourse] = useState<{
        courseId: number;
        courseTitle: string;
        hasMemory: boolean;
    } | null>(null);
    // 선택형 코스: 유저가 저장한 선택 조합 (null = 아직 선택 안 함)
    const [mySelection, setMySelection] = useState<{
        id: string;
        templateCourseId: number;
        selectedPlaceIds: number[];
        createdAt: string;
    } | null>(null);
    const [selectionLoading, setSelectionLoading] = useState(false);
    const [showSelectionUI, setShowSelectionUI] = useState(false); // "다시 고르기" 시 true
    // 세그먼트별 선택된 place_id (선택 UI용)
    const [selectedBySegment, setSelectedBySegment] = useState<Record<string, number>>({});
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [previewImageIndex, setPreviewImageIndex] = useState(0);
    const [showFullMapModal, setShowFullMapModal] = useState(false);
    const [showFullMapModalSlideUp, setShowFullMapModalSlideUp] = useState(false);
    const [fullMapModalDragY, setFullMapModalDragY] = useState(0);
    const fullMapModalDragStartY = useRef(0);
    const fullMapModalDragYRef = useRef(0);
    const fullMapModalHandleRef = useRef<HTMLElement | null>(null);
    const fullMapModalPointerIdRef = useRef<number | null>(null);
    const [modalSelectedPlace, setModalSelectedPlace] = useState<MapPlace | null>(null);
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const mapSectionRef = useRef<HTMLDivElement | null>(null);
    // 🟢 나만의 추억: 터치/마우스 다운 시 한도 체크 미리 요청해 클릭 시 대기 최소화
    const memoryCountPromiseRef = useRef<Promise<{ count: number; limit: number | null; tier: string } | null> | null>(
        null,
    );

    // 🟢 나만의 추억 한도 모달 하단 시트: 열릴 때 slideUp
    useEffect(() => {
        if (!showMemoryLimitModal) return;
        setMemoryLimitModalSlideUp(false);
        const t = requestAnimationFrame(() => {
            requestAnimationFrame(() => setMemoryLimitModalSlideUp(true));
        });
        return () => cancelAnimationFrame(t);
    }, [showMemoryLimitModal]);

    // 🟢 장소 모달 하단 시트: 열릴 때 slideUp 애니메이션 + 드래그 초기화
    useEffect(() => {
        if (!showPlaceModal || !selectedPlace) return;
        setPlaceModalDragY(0);
        placeModalDragYRef.current = 0;
        const t = requestAnimationFrame(() => {
            requestAnimationFrame(() => setPlaceModalSlideUp(true));
        });
        return () => cancelAnimationFrame(t);
    }, [showPlaceModal, selectedPlace]);

    // 🟢 예약/네이버 지도 시트: 열릴 때 slideUp + 드래그 초기화
    useEffect(() => {
        if (!showWebSheet) return;
        setWebSheetDragY(0);
        webSheetDragYRef.current = 0;
        setWebSheetSlideUp(false);
        const t = requestAnimationFrame(() => {
            requestAnimationFrame(() => setWebSheetSlideUp(true));
        });
        return () => cancelAnimationFrame(t);
    }, [showWebSheet]);

    const webSheetClose = useCallback(() => {
        setWebSheetSlideUp(false);
        setWebSheetDragY(0);
        setTimeout(() => {
            setShowWebSheet(false);
            setWebSheetUrl("");
        }, 300);
    }, []);

    const handleWebSheetPointerDown = useCallback(
        (e: React.PointerEvent) => {
            const target = e.target as HTMLElement;
            webSheetDragStartY.current = e.clientY;
            webSheetHandleRef.current = target;
            webSheetPointerIdRef.current = e.pointerId;
            target.setPointerCapture(e.pointerId);
            const onMove = (ev: PointerEvent) => {
                const dy = Math.max(0, ev.clientY - webSheetDragStartY.current);
                setWebSheetDragY(dy);
                webSheetDragYRef.current = dy;
            };
            const onUp = () => {
                const handle = webSheetHandleRef.current;
                const pid = webSheetPointerIdRef.current;
                if (handle && pid !== null) {
                    try {
                        handle.releasePointerCapture(pid);
                    } catch (_) {}
                }
                webSheetHandleRef.current = null;
                webSheetPointerIdRef.current = null;
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                window.removeEventListener("pointercancel", onUp);
                if (webSheetDragYRef.current > 80) {
                    webSheetClose();
                } else {
                    setWebSheetDragY(0);
                    webSheetDragYRef.current = 0;
                }
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
            window.addEventListener("pointercancel", onUp);
        },
        [webSheetClose],
    );

    // 🟢 장소 모달: 위에서 잡고 내리면 닫기
    const placeModalClose = useCallback(() => {
        setPlaceModalSlideUp(false);
        setPlaceModalDragY(0);
        setTimeout(() => setShowPlaceModal(false), 300);
    }, []);
    const handlePlaceModalPointerDown = useCallback(
        (e: React.PointerEvent) => {
            const target = e.target as HTMLElement;
            placeModalDragStartY.current = e.clientY;
            placeModalHandleRef.current = target;
            placeModalPointerIdRef.current = e.pointerId;
            target.setPointerCapture(e.pointerId);
            const onMove = (ev: PointerEvent) => {
                const dy = Math.max(0, ev.clientY - placeModalDragStartY.current);
                setPlaceModalDragY(dy);
                placeModalDragYRef.current = dy;
            };
            const onUp = () => {
                const handle = placeModalHandleRef.current;
                const pid = placeModalPointerIdRef.current;
                if (handle && pid !== null) {
                    try {
                        handle.releasePointerCapture(pid);
                    } catch (_) {}
                }
                placeModalHandleRef.current = null;
                placeModalPointerIdRef.current = null;
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                window.removeEventListener("pointercancel", onUp);
                if (placeModalDragYRef.current > 80) {
                    placeModalClose();
                } else {
                    setPlaceModalDragY(0);
                    placeModalDragYRef.current = 0;
                }
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
            window.addEventListener("pointercancel", onUp);
        },
        [placeModalClose],
    );

    // 🟢 공유 모달 하단 시트: 열릴 때 slideUp 애니메이션
    useEffect(() => {
        if (!showShareModal) return;
        const t = requestAnimationFrame(() => {
            requestAnimationFrame(() => setShareModalSlideUp(true));
        });
        return () => cancelAnimationFrame(t);
    }, [showShareModal]);

    // 🟢 지도 모달 하단 시트: 열릴 때 slideUp 애니메이션 + 드래그 초기화
    useEffect(() => {
        if (!showFullMapModal) {
            setShowFullMapModalSlideUp(false);
            setFullMapModalDragY(0);
            fullMapModalDragYRef.current = 0;
            return;
        }
        setFullMapModalDragY(0);
        fullMapModalDragYRef.current = 0;
        const t = requestAnimationFrame(() => {
            requestAnimationFrame(() => setShowFullMapModalSlideUp(true));
        });
        return () => cancelAnimationFrame(t);
    }, [showFullMapModal]);

    const fullMapModalClose = useCallback(() => {
        setShowFullMapModalSlideUp(false);
        setFullMapModalDragY(0);
        fullMapModalDragYRef.current = 0;
        setTimeout(() => {
            setShowFullMapModal(false);
            setModalSelectedPlace(null);
        }, 300);
    }, []);

    const handleFullMapModalPointerDown = useCallback(
        (e: React.PointerEvent) => {
            const target = e.target as HTMLElement;
            fullMapModalDragStartY.current = e.clientY;
            fullMapModalHandleRef.current = target;
            fullMapModalPointerIdRef.current = e.pointerId;
            target.setPointerCapture(e.pointerId);
            const onMove = (ev: PointerEvent) => {
                const dy = Math.max(0, ev.clientY - fullMapModalDragStartY.current);
                setFullMapModalDragY(dy);
                fullMapModalDragYRef.current = dy;
            };
            const onUp = () => {
                const handle = fullMapModalHandleRef.current;
                const pid = fullMapModalPointerIdRef.current;
                if (handle && pid !== null) {
                    try {
                        handle.releasePointerCapture(pid);
                    } catch (_) {}
                }
                fullMapModalHandleRef.current = null;
                fullMapModalPointerIdRef.current = null;
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                window.removeEventListener("pointercancel", onUp);
                if (fullMapModalDragYRef.current > 80) {
                    fullMapModalClose();
                } else {
                    setFullMapModalDragY(0);
                    fullMapModalDragYRef.current = 0;
                }
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
            window.addEventListener("pointercancel", onUp);
        },
        [fullMapModalClose],
    );

    // 🟢 찜 추가 하단 시트: 열릴 때 slideUp, 1초 뒤 자동 닫기
    useEffect(() => {
        if (!showFavoriteAddedModal) return;
        setFavoriteModalSlideUp(false);
        const raf = requestAnimationFrame(() => {
            requestAnimationFrame(() => setFavoriteModalSlideUp(true));
        });
        let hideTimer: ReturnType<typeof setTimeout> | null = null;
        const closeTimer = setTimeout(() => {
            setFavoriteModalSlideUp(false);
            hideTimer = setTimeout(() => setShowFavoriteAddedModal(false), 300);
        }, 1000);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(closeTimer);
            if (hideTimer != null) clearTimeout(hideTimer);
        };
    }, [showFavoriteAddedModal]);

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
            geoOptions,
        );
    }, [userLocation]);

    // 🟢 [Fix]: IntersectionObserver에서 자동 위치 요청 제거 (브라우저 보안 정책 준수)
    // 위치 정보는 사용자 제스처(버튼 클릭)에 의해서만 요청됩니다.

    useEffect(() => {
        if (authLoading) return;
        setIsLoggedIn(isAuthenticated);
    });

    // 🟢 activeCourse: 오늘 데이트 진행 중인 코스
    useEffect(() => {
        if (!isAuthenticated || authLoading) return;
        (async () => {
            try {
                const { authenticatedFetch } = await import("@/lib/authClient");
                const data = await authenticatedFetch<{
                    courseId: number;
                    courseTitle: string;
                    hasMemory: boolean;
                } | null>("/api/users/active-course");
                setActiveCourse(data ?? null);
            } catch {
                setActiveCourse(null);
            }
        })();

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

    // 선택형 코스: 내 선택 조합 조회
    useEffect(() => {
        if (!courseData?.isSelectionType || !isAuthenticated || authLoading) {
            if (!courseData?.isSelectionType) setMySelection(null);
            return;
        }
        let cancelled = false;
        setSelectionLoading(true);
        (async () => {
            try {
                const { authenticatedFetch } = await import("@/lib/authClient");
                const data = await authenticatedFetch<{
                    selection: {
                        id: string;
                        templateCourseId: number;
                        selectedPlaceIds: number[];
                        createdAt: string;
                    } | null;
                }>(`/api/courses/${courseId}/my-selection`);
                if (!cancelled && data?.selection) setMySelection(data.selection);
                else if (!cancelled) setMySelection(null);
            } catch {
                if (!cancelled) setMySelection(null);
            } finally {
                if (!cancelled) setSelectionLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [courseId, courseData?.isSelectionType, isAuthenticated, authLoading]);

    // 선택 UI 표시 시 세그먼트별 기본 선택 초기화
    const placesBySegment = useMemo(() => {
        const list = courseData?.coursePlaces ?? [];
        const map: Record<string, CoursePlace[]> = {};
        for (const cp of list) {
            const seg = (cp as CoursePlace).segment ?? "";
            if (!seg) continue;
            if (!map[seg]) map[seg] = [];
            map[seg].push(cp);
        }
        for (const seg of Object.keys(map)) {
            map[seg].sort((a, b) => (a.order_in_segment ?? 0) - (b.order_in_segment ?? 0));
        }
        return map;
    }, [courseData?.coursePlaces]);

    const segmentOrderInCourse = useMemo(() => {
        return SEGMENT_ORDER.filter((seg) => placesBySegment[seg]?.length);
    }, [placesBySegment]);

    // 선택형 코스 선택 UI용: order_index 순으로 "고정 장소" + "세그먼트 블록" 혼합 (고정 장소도 보이도록)
    const selectionOrderedSteps = useMemo(() => {
        const places = courseData?.coursePlaces ?? [];
        const sorted = [...places].sort((a, b) => a.order_index - b.order_index);
        const steps: (
            | { type: "fixed"; coursePlace: CoursePlace }
            | { type: "segment"; segment: string; options: CoursePlace[] }
        )[] = [];
        const seenSeg = new Set<string>();
        for (const cp of sorted) {
            const seg = (cp as CoursePlace).segment ?? "";
            if (!seg) {
                steps.push({ type: "fixed", coursePlace: cp });
            } else if (!seenSeg.has(seg)) {
                seenSeg.add(seg);
                steps.push({ type: "segment", segment: seg, options: placesBySegment[seg] ?? [] });
            }
        }
        return steps;
    }, [courseData?.coursePlaces, placesBySegment]);

    useEffect(() => {
        if (!courseData?.isSelectionType || selectionOrderedSteps.length === 0) return;
        if (!showSelectionUI && mySelection) return; // 저장된 코스 보기 중이면 초기화 안 함
        if (mySelection && showSelectionUI && mySelection.selectedPlaceIds.length === selectionOrderedSteps.length) {
            const next: Record<string, number> = {};
            selectionOrderedSteps.forEach((step, i) => {
                if (step.type === "segment") next[step.segment] = mySelection!.selectedPlaceIds[i];
            });
            setSelectedBySegment(next);
            return;
        }
        const next: Record<string, number> = {};
        selectionOrderedSteps.forEach((step) => {
            if (step.type === "segment" && step.options?.[0]) next[step.segment] = step.options[0].place_id;
        });
        setSelectedBySegment(next);
    }, [courseData?.isSelectionType, showSelectionUI, mySelection, selectionOrderedSteps, placesBySegment]);

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
            { threshold: 0.1, rootMargin: "200px" }, // 🟢 200px 전에 미리 로드
        );
        observer.observe(mapSectionRef.current);
        return () => observer.disconnect();
    }, [shouldLoadMap]);

    // 🟢 [Fix] 데이터 메모이제이션 (참조값 고정으로 지도 SDK 리셋 방지)
    const sortedCoursePlaces = useMemo(() => {
        const places = courseData?.coursePlaces ?? [];
        return [...places].sort((a, b) => a.order_index - b.order_index);
    }, [courseData?.coursePlaces]);

    // 선택형 코스: 저장된 선택이 있으면 그 순서로, 없으면 템플릿 순서
    const displayCoursePlaces = useMemo(() => {
        if (!courseData?.isSelectionType) return sortedCoursePlaces;
        if (showSelectionUI || !mySelection || mySelection.selectedPlaceIds.length === 0) return sortedCoursePlaces;
        const places = courseData.coursePlaces ?? [];
        const byPlaceId = new Map(places.map((cp) => [cp.place_id, cp]));
        const resolved: CoursePlace[] = [];
        for (let i = 0; i < mySelection.selectedPlaceIds.length; i++) {
            const cp = byPlaceId.get(mySelection.selectedPlaceIds[i]);
            if (cp) resolved.push({ ...cp, order_index: i });
        }
        return resolved;
    }, [courseData?.isSelectionType, courseData?.coursePlaces, mySelection, showSelectionUI, sortedCoursePlaces]);

    // 세그먼트별 섹션 그룹 (이미지 스타일 레이아웃: 브런치 / 산책·기타 / 저녁·바)
    const displaySections = useMemo(() => {
        const list = displayCoursePlaces;
        if (list.length === 0) return [];
        const orderToSegment = new Map<number, string>();
        list.forEach((cp) => {
            const seg = (cp as CoursePlace).segment ?? "";
            orderToSegment.set(cp.order_index, seg);
        });
        const sections: { segmentKey: string; label: string; icon: string; places: CoursePlace[] }[] = [];
        let currentSegment: string | null = null;
        let currentSection: { segmentKey: string; label: string; icon: string; places: CoursePlace[] } | null = null;
        for (const cp of list) {
            const seg = (cp as CoursePlace).segment ?? "";
            const segmentKey = seg || "fixed";
            const label = seg ? (SEGMENT_LABELS[seg] ?? seg) : "코스";
            const icon = seg ? (SEGMENT_ICONS[seg] ?? "📍") : "📍";
            if (segmentKey !== currentSegment) {
                currentSegment = segmentKey;
                currentSection = { segmentKey, label, icon, places: [] };
                sections.push(currentSection);
            }
            currentSection!.places.push(cp);
        }
        return sections;
    }, [displayCoursePlaces]);

    const mapPlaces = useMemo(() => {
        return displayCoursePlaces.map((cp) => ({
            id: cp.place.id,
            name: cp.place.name,
            latitude: cp.place.latitude,
            longitude: cp.place.longitude,
            address: cp.place.address,
            imageUrl: cp.place.imageUrl,
            description: cp.place.description,
            orderIndex: cp.order_index,
        }));
    }, [displayCoursePlaces]);

    useEffect(() => {
        if (displayCoursePlaces.length > 0 && !selectedPlace) {
            setSelectedPlace(displayCoursePlaces[0].place);
        }
    }, [displayCoursePlaces, selectedPlace]);

    // 🟢 페이지 진입 시 모든 장소 이미지 미리 로드 (모달이 열릴 때 즉시 표시를 위해)
    useEffect(() => {
        if (displayCoursePlaces.length > 0) {
            // 모든 장소의 이미지를 미리 로드
            displayCoursePlaces.forEach((coursePlace) => {
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
    }, [displayCoursePlaces]);

    const handleMapPlaceClick = useCallback(
        (mapPlace: MapPlace) => {
            const fullPlace = displayCoursePlaces.find((cp) => cp.place.id === mapPlace.id)?.place;
            if (fullPlace) {
                // 모달이 열려있으면 모달용 상태 업데이트, 아니면 일반 상태 업데이트
                if (showFullMapModal) {
                    setModalSelectedPlace(mapPlace);
                } else {
                    setSelectedPlace(fullPlace);
                }
            }
        },
        [displayCoursePlaces, showFullMapModal],
    );

    const heroImageUrl = useMemo(() => {
        if (courseData?.imageUrl) return courseData.imageUrl;
        if (displayCoursePlaces.length > 0) return displayCoursePlaces[0].place.imageUrl || "";
        return "";
    }, [courseData?.imageUrl, displayCoursePlaces]);

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
        [],
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
            const url = `/api/reviews?courseId=${courseId}`;
            const response = await fetch(url, {
                cache: "no-store",
                credentials: "include",
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                console.error("[리뷰 조회 실패]", response.status, url, data);
                return;
            }
            if (Array.isArray(data)) {
                setReviews(
                    data.map((r: any) => ({
                        id: r.id,
                        rating: r.rating,
                        userName: r.user?.nickname || t("courses.anonymous"),
                        createdAt: r.createdAt,
                        content: r.comment,
                        imageUrls: r.imageUrls || [],
                    })),
                );
            } else {
                console.warn("[리뷰 조회] 배열이 아님", typeof data, data);
            }
        } catch (e) {
            console.error("[리뷰 조회 오류]", e);
        }
    }, [courseId]);

    const reviewsSectionRef = useRef<HTMLElement | null>(null);

    // 🟢 코스 상세 진입 시 해당 코스 리뷰 바로 로드 (공개 리뷰만 표시)
    useEffect(() => {
        if (courseId) fetchReviews();
    }, [courseId, fetchReviews]);

    // 🟢 후기 작성 성공 시 바로 목록 갱신
    useEffect(() => {
        const handleReviewSubmitted = () => {
            setTimeout(() => fetchReviews(), 100); // DB 반영 후 갱신
        };
        window.addEventListener("reviewSubmitted", handleReviewSubmitted);
        return () => window.removeEventListener("reviewSubmitted", handleReviewSubmitted);
    }, [fetchReviews]);

    const handleSaveCourse = async () => {
        if (!isLoggedIn) {
            setLoginModalPreset("saveRecord");
            setShowLoginModal(true);
            return;
        }
        // 🟢 [Fix]: API 호출 전에 현재 상태 저장 (상태 변경 전)
        const currentSavedState = isSaved;
        const nextState = !isSaved;

        // 🟢 클릭 즉시 하단 시트 표시 (찜 추가/취소 둘 다, 1초 후 자동 닫힘)
        setIsSaved(nextState);
        setFavoriteSheetType(nextState ? "added" : "removed");
        setShowFavoriteAddedModal(true);

        try {
            // 🟢 [Fix]: API 호출 시 변경 전 상태(currentSavedState) 사용
            const method = currentSavedState ? "DELETE" : "POST";
            const url = currentSavedState ? `/api/users/favorites?courseId=${courseId}` : `/api/users/favorites`;
            const response = await authenticatedFetch(url, {
                method,
                body: currentSavedState ? undefined : JSON.stringify({ courseId }),
            });

            // 🟢 [Fix]: API 호출 실패 시 상태 되돌리기 + 시트 닫기
            if (response === null) {
                setIsSaved(currentSavedState); // 원래 상태로 되돌림
                setFavoriteModalSlideUp(false);
                setTimeout(() => setShowFavoriteAddedModal(false), 300);
                showToast(t("courseDetail.errorRetry"), "error");
                return;
            }

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
                        (fav: any) => String(fav.course_id) !== courseId,
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

    // 선택형 코스: 고정 장소 + 세그먼트 선택 후 "이 코스로 시작" 저장
    const handleStartSelectionCourse = async () => {
        if (!isLoggedIn) {
            setLoginModalPreset("saveRecord");
            setShowLoginModal(true);
            return;
        }
        const selectedPlaceIds = selectionOrderedSteps
            .map((step) => (step.type === "fixed" ? step.coursePlace.place_id : selectedBySegment[step.segment]))
            .filter((id): id is number => id != null && id > 0);
        if (selectedPlaceIds.length !== selectionOrderedSteps.length) {
            setToast({ message: "각 구간에서 장소를 선택해주세요.", type: "info" });
            return;
        }
        setSelectionLoading(true);
        try {
            const { authenticatedFetch } = await import("@/lib/authClient");
            const data = await authenticatedFetch<{
                success?: boolean;
                selection?: { id: string; templateCourseId: number; selectedPlaceIds: number[] };
            }>(`/api/courses/${courseId}/my-selection`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ selectedPlaceIds }),
            });
            if (data?.success && data?.selection) {
                setMySelection({
                    id: data.selection.id,
                    templateCourseId: data.selection.templateCourseId,
                    selectedPlaceIds: data.selection.selectedPlaceIds,
                    createdAt: new Date().toISOString(),
                });
                setShowSelectionUI(false);
                setActiveCourse({
                    courseId: Number(courseId),
                    courseTitle: courseData?.title ?? "",
                    hasMemory: false,
                });
                setToast({ message: "코스가 저장되었어요.", type: "success" });
                handleMapActivation();
            } else {
                setToast({ message: t("courseDetail.startFailed"), type: "error" });
            }
        } catch {
            setToast({ message: t("courseDetail.startFailed"), type: "error" });
        } finally {
            setSelectionLoading(false);
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
                translatedTitle.length > 200 ? translatedTitle.substring(0, 197) + "..." : translatedTitle;
            const shareDescription = courseData.description
                ? courseData.description.length > 200
                    ? courseData.description.substring(0, 197) + "..."
                    : courseData.description
                : t("courseDetail.shareDesc");

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
                        title: t("courseDetail.shareTitle"),
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
                showToast(t("courseDetail.linkCopied"), "success");
            } catch {
                showToast(t("courseDetail.shareFailed"), "error");
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
            showToast(t("courseDetail.linkCopySuccess"), "success");
        } catch {
            showToast(t("courseDetail.linkCopyFail"), "error");
        }
    };

    // 🔒 [조건부 렌더링] isUnlocked 상태를 기준으로 콘텐츠 렌더링
    const isUnlocked = !courseData.isLocked;
    // 🔒 모달이 표시될 때는 코스 콘텐츠를 완전히 숨김
    const shouldShowContent = isUnlocked && !showSubscriptionModal && !showLoginModal && !showBridgeModal;

    return (
        <>
            {/* 🟢 [Fix] 컴포넌트명 수정 반영 */}
            {toast && <ToastPopup message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {shouldShowContent ? (
                // 🟢 잠금 해제된 경우: 전체 코스 상세 콘텐츠 렌더링
                <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0f1710] font-sans text-gray-900 dark:text-white relative">
                    <header
                        className={`relative w-full max-w-[900px] mx-auto overflow-hidden ${inApp ? "h-[400px]" : "h-[450px]"}`}
                    >
                        <Image
                            src={heroImageUrl || ""}
                            alt={translatedTitle || courseData.title}
                            fill
                            className="object-cover"
                            priority
                            loading="eager"
                            quality={75}
                            fetchPriority="high"
                            sizes="(max-width: 768px) 100vw, 33vw"
                            unoptimized={false}
                        />
                        {/* 🔥 진한 그라데이션 오버레이 */}
                        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent" />

                        {/* 🔥 뒤로 가기 버튼: 배경 없이 강한 그림자 */}
                        <TapFeedback>
                            <button
                                onClick={() => router.back()}
                                className="absolute top-4 left-4 z-50 p-2 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] hover:opacity-80 transition-all"
                                aria-label={t("courseDetail.back")}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2.5}
                                    stroke="currentColor"
                                    className="w-7 h-7"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M15.75 19.5L8.25 12l7.5-7.5"
                                    />
                                </svg>
                            </button>
                        </TapFeedback>

                        <div className="absolute bottom-0 left-0 w-full p-6 pb-20 text-white z-10">
                            {/* 🔥 Row 1: 핵심 정보 (불투명 태그) + 가격 칩 */}
                            <div className="flex flex-wrap gap-2.5 mb-4">
                                {courseData.target_situation && (
                                    <span className="px-2.5 py-1 text-[11px] font-bold text-white bg-gray-900 border border-gray-700 rounded-lg tracking-wide">
                                        #
                                        {courseData.target_situation === "SOME"
                                            ? t("courseDetail.someEscape")
                                            : courseData.target_situation}
                                    </span>
                                )}
                                {courseData.budget_range && (
                                    <span className="px-2.5 py-1 text-[11px] font-bold text-white bg-gray-900 border border-gray-700 rounded-lg tracking-wide">
                                        💸 {courseData.budget_range}
                                    </span>
                                )}
                            </div>

                            {/* 🔥 제목 구조: title이 메인, sub_title이 부제목 (locale별 번역) */}
                            <h1 className="text-xl md:text-xl font-extrabold mb-5 drop-shadow-lg">
                                {translatedTitle || courseData.title}
                            </h1>

                            {/* 🔥 Row 2: 메타 정보 (칩 형태, 살짝 테두리) */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-3 text-[13px] font-medium drop-shadow-md mt-2">
                                <span className="px-2.5 py-1 rounded-full bg-white/15 text-white border border-white/40">
                                    📍 {courseData.region || t("courses.regionSeoul")}
                                </span>
                                <span className="px-2.5 py-1 rounded-full bg-white/15 text-white border border-white/40">
                                    👣 {displayCoursePlaces.length} {t("courseDetail.spots")}
                                </span>
                                <span className="px-2.5 py-1 rounded-full bg-white/15 text-white border border-white/40">
                                    ⏳ {courseData.duration}
                                </span>
                                {courseData.rating > 0 && (
                                    <span className="px-2.5 py-1 rounded-full bg-white/15 text-white border border-white/40">
                                        <span className="text-yellow-400">★</span> {courseData.rating}
                                    </span>
                                )}
                            </div>
                        </div>
                    </header>

                    <main
                        className="max-w-[600px] mx-auto mb-1 mt-4 relative z-10 px-5 space-y-10"
                        style={{
                            touchAction: "pan-y", // 수직 스크롤 성능 최적화
                            WebkitOverflowScrolling: "touch", // iOS 부드러운 스크롤 보장
                        }}
                    >
                        <section className="relative px-4 pb-20 rounded-2xl bg-white dark:bg-[#1a241b] shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                            {/* 선택형 선택 UI일 때만 세로 타임라인 표시 */}
                            {courseData.isSelectionType &&
                                selectionOrderedSteps.length > 0 &&
                                (!mySelection || showSelectionUI) && (
                                    <div className="absolute left-[34px] top-4 bottom-0 w-[2px] border-l-2 border-dashed border-gray-200 dark:border-gray-700" />
                                )}
                            <div className="space-y-8">
                                {/* 선택형 코스: 첫 방문 또는 "다시 고르기" 시 고정 장소 + 세그먼트 선택 UI (order_index 순) */}
                                {courseData.isSelectionType &&
                                    selectionOrderedSteps.length > 0 &&
                                    (!mySelection || showSelectionUI) && (
                                        <div className="space-y-6">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                                각 구간에서 원하는 장소를 골라주세요.
                                            </p>
                                            {selectionOrderedSteps.map((step, stepIdx) => {
                                                if (step.type === "fixed") {
                                                    const coursePlace = step.coursePlace;
                                                    const isSelected = selectedPlace?.id === coursePlace.place.id;
                                                    return (
                                                        <div key={`fixed-${coursePlace.id}`} className="mb-6">
                                                            <h3 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white mb-3">
                                                                <span className="text-lg">📍</span>
                                                                코스
                                                            </h3>
                                                            <div
                                                                onClick={() => {
                                                                    setSelectedPlace(coursePlace.place);
                                                                    setShowPlaceModal(true);
                                                                }}
                                                                className={`relative ml-0 bg-white/95 dark:bg-[#1a241b]/95 backdrop-blur-md rounded-xl p-4 transition-all duration-300 border cursor-pointer ${
                                                                    isSelected
                                                                        ? "shadow-sm border-emerald-500 border-2 scale-[1.01]"
                                                                        : "border-gray-200 dark:border-gray-700 hover:border-emerald-300"
                                                                }`}
                                                            >
                                                                <div className="flex gap-4">
                                                                    <div className="relative w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                                                                        {coursePlace.place.imageUrl && (
                                                                            <Image
                                                                                src={coursePlace.place.imageUrl}
                                                                                alt=""
                                                                                fill
                                                                                className="object-cover"
                                                                                loading="lazy"
                                                                                sizes="96px"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">
                                                                            {coursePlace.place.category}
                                                                        </span>
                                                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate mt-1">
                                                                            {coursePlace.place.name}
                                                                        </h3>
                                                                        <p className="text-xs text-gray-500 truncate">
                                                                            {coursePlace.place.address}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                const { segment: seg, options } = step;
                                                const selectedPlaceId = selectedBySegment[seg];
                                                const selectedCp = options.find(
                                                    (cp) => cp.place_id === selectedPlaceId,
                                                );
                                                return (
                                                    <div key={`seg-${seg}`} className="mb-6">
                                                        <h3 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white mb-3">
                                                            <span className="text-lg">{SEGMENT_ICONS[seg] ?? "📍"}</span>
                                                            {SEGMENT_LABELS[seg] ?? seg}
                                                        </h3>
                                                        <div className="grid grid-cols-2 gap-3 ml-0">
                                                            {options.map((cp) => {
                                                                const isSelected = selectedPlaceId === cp.place_id;
                                                                const status = getPlaceStatus(
                                                                    cp.place.opening_hours ?? null,
                                                                    cp.place.closed_days ?? [],
                                                                ).status;
                                                                return (
                                                                    <div
                                                                        key={cp.id}
                                                                        onClick={() =>
                                                                            setSelectedBySegment((prev) => ({
                                                                                ...prev,
                                                                                [seg]: cp.place_id,
                                                                            }))
                                                                        }
                                                                        className={`rounded-xl border overflow-hidden bg-white dark:bg-[#1a241b] cursor-pointer transition-all ${
                                                                            isSelected
                                                                                ? "ring-2 ring-emerald-500 border-emerald-400 dark:border-emerald-600"
                                                                                : "border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700"
                                                                        }`}
                                                                    >
                                                                        <div className="relative flex">
                                                                            <div className="relative w-20 h-20 shrink-0 bg-gray-100 dark:bg-gray-800">
                                                                                {cp.place.imageUrl && (
                                                                                    <Image
                                                                                        src={cp.place.imageUrl}
                                                                                        alt=""
                                                                                        fill
                                                                                        className="object-cover"
                                                                                        sizes="80px"
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                            <div className="flex-1 min-w-0 p-2 flex flex-col justify-start">
                                                                                <div className="flex justify-end">
                                                                                    {isSelected ? (
                                                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                                            </svg>
                                                                                            바꾸기
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                                                                            {status === "영업중" ? "Open" : status}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate mt-0.5 leading-tight">
                                                                                    {cp.place.name}
                                                                                </h4>
                                                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                                                    {(cp as CoursePlace).recommended_time || cp.place.address}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setSelectedPlace(cp.place);
                                                                                setShowPlaceModal(true);
                                                                            }}
                                                                            className="w-full py-2 px-2 rounded-b-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1 border-t border-gray-100 dark:border-gray-700"
                                                                        >
                                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                                            </svg>
                                                                            추천 보기
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                {/* 고정 코스, 또는 선택형이지만 세그먼트 없음, 또는 저장된 선택: 장소 일자 표시 */}
                                {(!courseData.isSelectionType || segmentOrderInCourse.length === 0 || mySelection) &&
                                    !showSelectionUI && (
                                        <>
                                            {mySelection && courseData.isSelectionType && (
                                                <div className="flex justify-end mb-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowSelectionUI(true)}
                                                        className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                                                    >
                                                        다시 고르기
                                                    </button>
                                                </div>
                                            )}
                                            {displaySections.map((sec) => (
                                                <div key={sec.segmentKey} className="mb-8">
                                                    <h3 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white mb-3">
                                                        <span className="text-lg">{sec.icon}</span>
                                                        {sec.label}
                                                    </h3>
                                                    {sec.places.map((coursePlace: CoursePlace, idx: number) => {
                                                        const isSelected =
                                                            selectedPlace?.id === coursePlace.place.id;
                                                        return (
                                                            <div key={coursePlace.id} className="relative">
                                                                <div
                                                                    onClick={() => {
                                                                        setSelectedPlace(coursePlace.place);
                                                                        setShowPlaceModal(true);
                                                                    }}
                                                                    className={`relative ml-0 mt-3 bg-white/95 dark:bg-[#1a241b]/95 backdrop-blur-md rounded-xl p-4 transition-all duration-300 border cursor-pointer ${
                                                                        isSelected
                                                                            ? "shadow-sm border-emerald-500 border-2 scale-[1.01]"
                                                                            : "border-white/40 dark:border-gray-700/40 opacity-90 hover:opacity-100"
                                                                    }`}
                                                                >
                                                                    <div className="flex gap-4">
                                                                        <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-100">
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
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">
                                                                            {coursePlace.place.category}
                                                                        </span>
                                                                        {(() => {
                                                                            const status = getPlaceStatus(
                                                                                coursePlace.place.opening_hours ?? null,
                                                                                coursePlace.place.closed_days ?? [],
                                                                            ).status;
                                                                            const statusStyles: Record<string, string> =
                                                                                {
                                                                                    영업중: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
                                                                                    "곧 마감":
                                                                                        "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
                                                                                    "곧 브레이크":
                                                                                        "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
                                                                                    "브레이크 중":
                                                                                        "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
                                                                                    "오픈 준비중":
                                                                                        "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
                                                                                    휴무: "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300",
                                                                                    영업종료:
                                                                                        "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
                                                                                    "정보 없음":
                                                                                        "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
                                                                                };
                                                                            const statusKeyMap: Record<string, string> =
                                                                                {
                                                                                    영업중: "courseDetail.placeStatusOpen",
                                                                                    "곧 마감":
                                                                                        "courseDetail.placeStatusClosingSoon",
                                                                                    "곧 브레이크":
                                                                                        "courseDetail.placeStatusBreakSoon",
                                                                                    "브레이크 중":
                                                                                        "courseDetail.placeStatusOnBreak",
                                                                                    "오픈 준비중":
                                                                                        "courseDetail.placeStatusOpeningSoon",
                                                                                    휴무: "courseDetail.placeStatusClosed",
                                                                                    영업종료:
                                                                                        "courseDetail.placeStatusClosedToday",
                                                                                    "정보 없음":
                                                                                        "courseDetail.placeStatusNoInfo",
                                                                                };
                                                                            return (
                                                                                <span
                                                                                    className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                                                                                        statusStyles[status] ??
                                                                                        statusStyles["정보 없음"]
                                                                                    }`}
                                                                                >
                                                                                    {t(
                                                                                        (statusKeyMap[status] ??
                                                                                            "courseDetail.placeStatusNoInfo") as "courseDetail.placeStatusOpen",
                                                                                    )}
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                    <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate mb-0.5">
                                                                        {coursePlace.place.name}
                                                                    </h4>
                                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
                                                                        {coursePlace.recommended_time ||
                                                                            coursePlace.place.address}
                                                                    </p>
                                                                    {/* 🟢 예약 버튼 - 하단 시트로 열기 (휴무일이면 "다른 날 예약하기") */}
                                                                    {coursePlace.place.reservationUrl && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setWebSheetUrl(
                                                                                    coursePlace.place.reservationUrl!,
                                                                                );
                                                                                setShowWebSheet(true);
                                                                            }}
                                                                            className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] px-3 py-1.5 rounded-md font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap shrink-0"
                                                                        >
                                                                            {getPlaceStatus(
                                                                                coursePlace.place.opening_hours ?? null,
                                                                                coursePlace.place.closed_days ?? [],
                                                                            ).status === "휴무"
                                                                                ? t("courses.reserveInAdvance")
                                                                                : t("courses.reserve")}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* 🟢 보유 꿀팁: 아이콘 + 카테고리명만 (주차, 시그니처 등), 내용은 모달에서 */}
                                                            {(() => {
                                                                const courseGrade = (
                                                                    courseData.grade || "FREE"
                                                                ).toUpperCase();
                                                                const currentUserTier = (
                                                                    userTier || "FREE"
                                                                ).toUpperCase();
                                                                const shouldShowPaidTip = !(
                                                                    (courseGrade === "FREE" &&
                                                                        currentUserTier === "FREE") ||
                                                                    courseData.isLocked
                                                                );

                                                                const freeTips = parseTipsFromDb(
                                                                    coursePlace.coaching_tip_free,
                                                                );
                                                                const paidTips = parseTipsFromDb(
                                                                    coursePlace.coaching_tip,
                                                                );
                                                                const hasFreeTip = freeTips.length > 0;
                                                                const hasPaidTip =
                                                                    coursePlace.hasPaidTip ?? paidTips.length > 0;

                                                                if (!hasFreeTip && !hasPaidTip) return null;

                                                                const getCategoryLabel = (cat: string) =>
                                                                    FREE_TIP_CATEGORIES.find((c) => c.value === cat)
                                                                        ?.label ??
                                                                    PAID_TIP_CATEGORIES.find((c) => c.value === cat)
                                                                        ?.label ??
                                                                    t("courseDetail.etc");

                                                                const freeCategories = [
                                                                    ...new Set(freeTips.map((t) => t.category)),
                                                                ];
                                                                const paidCategories = [
                                                                    ...new Set(paidTips.map((t) => t.category)),
                                                                ];

                                                                return (
                                                                    <div className="mt-2 flex flex-col gap-1.5">
                                                                        <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">
                                                                            ✨ {t("courseDetail.freeTips")}
                                                                        </span>
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {freeCategories.map((cat) => (
                                                                                <span
                                                                                    key={`free-${cat}`}
                                                                                    className="inline-flex items-center gap-1 py-0.5 px-2 rounded-md text-[11px] font-medium bg-[#F3F4F6] dark:bg-gray-700 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40"
                                                                                >
                                                                                    <TipCategoryIcon
                                                                                        category={cat}
                                                                                        className="[&_svg]:w-3.5 [&_svg]:h-3.5 text-emerald-600 dark:text-emerald-400"
                                                                                    />
                                                                                    {getCategoryLabel(cat)}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                        {hasPaidTip && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (shouldShowPaidTip) {
                                                                                        setSelectedPlace(
                                                                                            coursePlace.place,
                                                                                        );
                                                                                        setShowPlaceModal(true);
                                                                                    } else if (isAuthenticated) {
                                                                                        setSubscriptionModalContext(
                                                                                            "TIPS",
                                                                                        );
                                                                                        setShowSubscriptionModal(true);
                                                                                    } else {
                                                                                        setSubscriptionModalContext(
                                                                                            "TIPS",
                                                                                        );
                                                                                        setShowBridgeModal(true);
                                                                                    }
                                                                                }}
                                                                                className="w-full text-left rounded-lg p-2.5 transition-all hover:opacity-95 bg-[#FFFBEB] dark:bg-[#1c1917] border border-amber-200 dark:border-amber-800/50"
                                                                            >
                                                                                <div className="flex items-center gap-1.5 mb-0.5 text-[11px] font-medium text-gray-800 dark:text-gray-100">
                                                                                    🔥 꼭 알아야 할 실패 방지 꿀팁
                                                                                </div>
                                                                                <p className="text-[11px] font-medium text-gray-800 dark:text-gray-100">
                                                                                    {
                                                                                        getPremiumQuestions(
                                                                                            coursePlace.place?.category,
                                                                                        ).headline
                                                                                    }
                                                                                </p>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                                </div>
                                            ))}
                                        </>
                                    )}
                            </div>
                        </section>

                        <section
                            ref={reviewsSectionRef}
                            className="rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/60 p-6 md:p-8 mb-24"
                        >
                            <div className={`flex justify-between items-center ${reviews.length > 0 ? "mb-6" : ""}`}>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {t("courseDetail.reviews")}{" "}
                                    <span className="text-emerald-500 ml-1">{reviews.length}</span>
                                </h2>
                                <button
                                    onClick={() => setShowReviewModal(true)}
                                    className="text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 rounded-lg border border-emerald-100 dark:border-emerald-800/50 transition-colors"
                                >
                                    {t("courseDetail.writeReview")}
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
                                            {review.rating > 0 && (
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
                                            )}
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
                            ) : null}
                        </section>
                    </main>

                    {/* 찜하기·공유 하단바: bottom-0. Android만 네비 바(64px) 위로 */}
                    <div
                        className={`${
                            containInPhone
                                ? "sticky bottom-0 left-0 right-0"
                                : "fixed left-0 right-0 bottom-0"
                        } bg-white dark:bg-[#1a241b] border-t border-gray-100 dark:border-gray-800 px-6 py-4 z-40 shadow-lg flex items-center justify-between gap-4 max-w-[900px] mx-auto`}
                        style={
                            inApp && !containInPhone
                                ? {
                                      paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0.5rem)",
                                      ...(typeof window !== "undefined" && isAndroid()
                                          ? { bottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }
                                          : {}),
                                  }
                                : undefined
                        }
                    >
                        <div className="flex gap-4">
                            <TapFeedback>
                                <button
                                    onClick={handleSaveCourse}
                                    className="flex flex-col items-center justify-center gap-0.5 text-gray-400 transition-all"
                                >
                                    {isSaved ? <Icons.LikeSolid /> : <Icons.LikeOutline />}
                                    <span
                                        className={`text-[10px] font-medium ${
                                            isSaved ? "text-rose-500" : "text-gray-500"
                                        }`}
                                    >
                                        {t("courseDetail.favorite")}
                                    </span>
                                </button>
                            </TapFeedback>
                            <TapFeedback>
                                <button
                                    onClick={() => setShowShareModal(true)}
                                    className="flex flex-col items-center justify-center gap-0.5 text-gray-400 transition-all"
                                >
                                    <Icons.Share />
                                    <span className="text-[10px] font-medium text-gray-500">
                                        {t("courseDetail.share")}
                                    </span>
                                </button>
                            </TapFeedback>
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                            {courseData.isSelectionType &&
                            segmentOrderInCourse.length > 0 &&
                            (!mySelection || showSelectionUI) ? (
                                <TapFeedback className="w-full">
                                    <button
                                        onClick={handleStartSelectionCourse}
                                        disabled={selectionLoading}
                                        className="w-full h-14 bg-[#99c08e] text-white rounded-lg font-bold text-[16px] shadow-lg hover:bg-[#85ad78] flex items-center justify-center disabled:opacity-60"
                                    >
                                        {selectionLoading ? "저장 중..." : "이 코스로 저장"}
                                    </button>
                                </TapFeedback>
                            ) : activeCourse && activeCourse.courseId === Number(courseId) ? (
                                <>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                        {t("courseDetail.dateInProgress")}
                                    </p>
                                    <TapFeedback className="w-full">
                                        <button
                                            onPointerDown={() => {
                                                if (!isLoggedIn) return;
                                                if (memoryCountPromiseRef.current) return;
                                                memoryCountPromiseRef.current = (async () => {
                                                    const { authenticatedFetch } = await import("@/lib/authClient");
                                                    return authenticatedFetch<{
                                                        count: number;
                                                        limit: number | null;
                                                        tier: string;
                                                    }>("/api/users/me/memory-count");
                                                })();
                                            }}
                                            onClick={async () => {
                                                if (!isLoggedIn) {
                                                    setLoginModalPreset("saveRecord");
                                                    setShowLoginModal(true);
                                                    return;
                                                }
                                                try {
                                                    const { authenticatedFetch } = await import("@/lib/authClient");
                                                    const promise =
                                                        memoryCountPromiseRef.current ??
                                                        (memoryCountPromiseRef.current = authenticatedFetch<{
                                                            count: number;
                                                            limit: number | null;
                                                            tier: string;
                                                        }>("/api/users/me/memory-count"));
                                                    const data = await promise;
                                                    memoryCountPromiseRef.current = null;
                                                    if (data && data.limit != null && data.count >= data.limit) {
                                                        setShowMemoryLimitModal(true);
                                                        return;
                                                    }
                                                } catch {
                                                    memoryCountPromiseRef.current = null;
                                                }
                                                router.push(`/courses/${courseId}/start`);
                                                handleMapActivation();
                                            }}
                                            className="w-full h-10 bg-[#99c08e] text-white rounded-lg font-bold text-[16px] shadow-lg hover:bg-[#85ad78] flex items-center justify-center"
                                        >
                                            나만의 추억 기록하기
                                        </button>
                                    </TapFeedback>
                                </>
                            ) : activeCourse && activeCourse.courseId !== Number(courseId) ? (
                                <>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                        오늘 이미 다른 코스를 시작했어요.
                                    </p>
                                    <TapFeedback className="w-full">
                                        <button
                                            onClick={async () => {
                                                if (!isLoggedIn) {
                                                    setLoginModalPreset("saveRecord");
                                                    setShowLoginModal(true);
                                                    return;
                                                }
                                                try {
                                                    const { authenticatedFetch } = await import("@/lib/authClient");
                                                    await authenticatedFetch("/api/users/active-course", {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ courseId: Number(courseId) }),
                                                    });
                                                    setActiveCourse({
                                                        courseId: Number(courseId),
                                                        courseTitle: courseData?.title ?? "",
                                                        hasMemory: false,
                                                    });
                                                } catch {
                                                    setToast({
                                                        message: t("courseDetail.changeFailed"),
                                                        type: "error",
                                                    });
                                                }
                                            }}
                                            className="w-full h-14 bg-[#99c08e] text-white rounded-lg font-bold text-[16px] shadow-lg hover:bg-[#85ad78] flex items-center justify-center"
                                        >
                                            {t("courseDetail.changeCourse")}
                                        </button>
                                    </TapFeedback>
                                </>
                            ) : (
                                <>
                                    <TapFeedback className="w-full">
                                        <button
                                            onClick={async () => {
                                                if (!isLoggedIn) {
                                                    setLoginModalPreset("saveRecord");
                                                    setShowLoginModal(true);
                                                    return;
                                                }
                                                try {
                                                    const { authenticatedFetch } = await import("@/lib/authClient");
                                                    await authenticatedFetch("/api/users/active-course", {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ courseId: Number(courseId) }),
                                                    });
                                                    setActiveCourse({
                                                        courseId: Number(courseId),
                                                        courseTitle: courseData?.title ?? "",
                                                        hasMemory: false,
                                                    });
                                                    handleMapActivation();
                                                } catch {
                                                    setToast({ message: t("courseDetail.startFailed"), type: "error" });
                                                }
                                            }}
                                            className="w-full h-14 bg-[#99c08e] text-white rounded-lg font-bold text-[16px] shadow-lg hover:bg-[#85ad78] flex items-center justify-center"
                                        >
                                            {t("courseDetail.startCourse")}
                                        </button>
                                    </TapFeedback>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                // 🔒 잠긴 경우: BlurComponent (흐릿한 이미지와 요약 정보만 표시)
                <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0f1710] font-sans text-gray-900 dark:text-white relative">
                    <header
                        className={`relative w-full max-w-[900px] mx-auto overflow-hidden ${inApp ? "h-[400px]" : "h-[450px]"}`}
                    >
                        <div className="relative w-full h-full">
                            {heroImageUrl && (
                                <Image
                                    src={heroImageUrl}
                                    alt={translatedTitle || courseData.title}
                                    fill
                                    className="object-cover blur-md grayscale"
                                    priority
                                    loading="eager"
                                    quality={60}
                                    sizes="(max-width: 768px) 100vw, 33vw"
                                />
                            )}
                            {/* 🔥 락 화면 그라데이션도 진하게 */}
                            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-black/20" />
                            {/* 🔥 뒤로 가기 버튼: 배경 없이 강한 그림자 */}
                            <TapFeedback>
                                <button
                                    onClick={() => router.back()}
                                    className="absolute top-4 left-4 md:top-6 md:left-6 z-50 p-2 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] hover:opacity-80 transition-all"
                                    aria-label={t("courseDetail.back")}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth={2.5}
                                        stroke="currentColor"
                                        className="w-7 h-7"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M15.75 19.5L8.25 12l7.5-7.5"
                                        />
                                    </svg>
                                </button>
                            </TapFeedback>
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
                                    {/* 🔥 제목 구조: title이 메인, sub_title이 부제목 (locale별 번역) */}
                                    <h1 className="text-2xl md:text-3xl font-extrabold mb-2">
                                        {translatedTitle || courseData.title}
                                    </h1>
                                    {courseData.sub_title && (
                                        <p className="text-sm text-white/80 mb-3 leading-relaxed">
                                            {translatedSubTitle || courseData.sub_title}
                                        </p>
                                    )}
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

            {/* 🔵 지도 보기 플로팅 버튼 - 웹 폰 목업에서는 폰 안으로, 앱에서는 하단바 위로 */}
            <div
                className={`right-6 z-50 ${containInPhone && !inApp ? "absolute" : "fixed"} ${inApp ? "bottom-44" : "bottom-28"}`}
            >
                <TapFeedback>
                    <button
                        onClick={() => {
                            setModalSelectedPlace(null);
                            setShowFullMapModal(true);
                        }}
                        aria-label={t("courseDetail.mapView")}
                        className="flex items-center justify-center w-12 h-12 rounded-full bg-[#99c08e] hover:bg-[#85ad78] dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-lg text-white font-bold text-sm transition-all duration-200 ease-out hover:scale-105 active:scale-95"
                    >
                        <Icons.Map className="w-6 h-6 text-white" />
                    </button>
                </TapFeedback>
            </div>

            {/* 🔵 [기능 유지] 전체 지도 모달 - 앱에서는 네이티브 하단 버튼 위로. Android는 네비 바(64px) 위로 */}
            {showFullMapModal &&
                (() => {
                    const posClass = containInPhone && !inApp ? "absolute" : "fixed";
                    const modalContent = (
                        <div
                            className={`${posClass} inset-0 bg-black/60 dark:bg-black/70 z-6000 flex flex-col justify-end animate-fade-in full-map-modal ${inApp && !(typeof window !== "undefined" && isAndroid()) ? "pb-24" : ""}`}
                            style={
                                inApp && typeof window !== "undefined" && isAndroid()
                                    ? { paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }
                                    : undefined
                            }
                            onClick={fullMapModalClose}
                        >
                            <div
                                className="flex flex-col bg-white dark:bg-[#1a241b] rounded-t-2xl border-t border-x border-gray-100 dark:border-gray-800 w-full max-w-md mx-auto h-[75vh] overflow-hidden relative naver-map-container"
                                style={{
                                    transform: showFullMapModalSlideUp
                                        ? `translateY(${fullMapModalDragY}px)`
                                        : "translateY(100%)",
                                    transition: fullMapModalDragY === 0 ? "transform 0.3s ease-out" : "none",
                                    marginBottom: inApp ? 80 : 0,
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* 드래그 핸들바: 위에서 잡고 내리면 닫기 */}
                                <div
                                    role="button"
                                    tabIndex={0}
                                    aria-label={t("courseDetail.mapSheetClose")}
                                    onPointerDown={handleFullMapModalPointerDown}
                                    className="flex items-center justify-center shrink-0 pt-3 pb-2 touch-none cursor-grab active:cursor-grabbing"
                                >
                                    <span className="w-12 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                                </div>
                                {/* 🟢 [Fix]: 지도 보기 모달에서도 지도가 제대로 표시되도록 키 추가 */}
                                <div className="flex-1 min-h-0 relative">
                                    <NaverMap
                                        key="full-map-modal"
                                        places={mapPlaces}
                                        userLocation={null}
                                        selectedPlace={null}
                                        onPlaceClick={handleMapPlaceClick}
                                        drawPath={true}
                                        numberedMarkers={true}
                                        className="w-full h-full"
                                        style={{ minHeight: "400px" }}
                                        showControls={false}
                                    />
                                </div>
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
                                                <h4 className="font-bold text-gray-900 dark:text-white">
                                                    {modalSelectedPlace.name}
                                                </h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
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
                                            {/* 🟢 예약 버튼 추가 (휴무일이면 "다른 날 예약하기") */}
                                            {(() => {
                                                const fullPlace = sortedCoursePlaces.find(
                                                    (c) => c.place.id === modalSelectedPlace.id,
                                                )?.place;
                                                const isClosedToday =
                                                    fullPlace &&
                                                    getPlaceStatus(
                                                        fullPlace.opening_hours ?? null,
                                                        fullPlace.closed_days ?? [],
                                                    ).status === "휴무";
                                                return fullPlace?.reservationUrl ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setWebSheetUrl(fullPlace.reservationUrl!);
                                                            setShowWebSheet(true);
                                                        }}
                                                        className="w-full py-2.5 rounded-lg bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        <Icons.ExternalLink className="w-4 h-4" />
                                                        {isClosedToday
                                                            ? t("courses.reserveOtherDay")
                                                            : t("courses.reserve")}
                                                    </button>
                                                ) : null;
                                            })()}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const q = encodeURIComponent(modalSelectedPlace.name);
                                                    const url = `https://map.naver.com/v5/search/${q}?c=${modalSelectedPlace.longitude},${modalSelectedPlace.latitude},15,0,0,0,dh`;
                                                    setWebSheetUrl(url);
                                                    setShowWebSheet(true);
                                                }}
                                                className="w-full py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold text-xs hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-600 mb-2"
                                            >
                                                네이버 지도
                                            </button>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        const cp = sortedCoursePlaces.find(
                                                            (c) => c.place.id === modalSelectedPlace.id,
                                                        );
                                                        setShowFullMapModalSlideUp(false);
                                                        setFullMapModalDragY(0);
                                                        setTimeout(() => {
                                                            setShowFullMapModal(false);
                                                            setModalSelectedPlace(null);
                                                            if (cp) handleTimelinePlaceClick(cp);
                                                        }, 300);
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
                                ) : null}
                            </div>
                        </div>
                    );
                    const portalTarget =
                        containInPhone && !inApp && modalContainerRef?.current
                            ? modalContainerRef.current
                            : document.body;
                    return createPortal(modalContent, portalTarget);
                })()}

            {/* 공유 모달 - 하단 시트 + 다크모드 - 웹 폰 목업에서는 폰 안으로 */}
            {showShareModal &&
                (() => {
                    const posClass = containInPhone && !inApp ? "absolute" : "fixed";
                    const modalContent = (
                        <div
                            className={`${posClass} inset-0 bg-black/60 dark:bg-black/70 z-9999 flex flex-col justify-end animate-fade-in`}
                            style={
                                inApp && typeof window !== "undefined" && isAndroid()
                                    ? { paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }
                                    : undefined
                            }
                            onClick={() => {
                                setShareModalSlideUp(false);
                                setTimeout(() => setShowShareModal(false), 300);
                            }}
                        >
                            <div
                                className={`bg-white dark:bg-[#1a241b] rounded-t-2xl border-t border-x border-gray-100 dark:border-gray-800 w-full max-w-sm mx-auto p-6 shadow-2xl transition-transform duration-300 ease-out ${
                                    inApp && typeof window !== "undefined" && isAndroid()
                                        ? "pb-[calc(1.5rem+64px+env(safe-area-inset-bottom))]"
                                        : "pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
                                }`}
                                style={{
                                    transform: shareModalSlideUp ? "translateY(0)" : "translateY(100%)",
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {t("courseDetail.shareModalTitle")}
                                    </h3>
                                    <button
                                        onClick={() => {
                                            setShareModalSlideUp(false);
                                            setTimeout(() => setShowShareModal(false), 300);
                                        }}
                                        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
                                        <span className="font-bold text-gray-900">{t("courseDetail.shareKakao")}</span>
                                    </button>
                                    <button
                                        onClick={handleCopyLink}
                                        className="flex items-center gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors active:scale-95"
                                    >
                                        <Icons.Link />
                                        <span className="font-bold text-gray-900 dark:text-white">
                                            {t("courseDetail.copyLink")}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                    const portalTarget =
                        containInPhone && !inApp && modalContainerRef?.current
                            ? modalContainerRef.current
                            : document.body;
                    return createPortal(modalContent, portalTarget);
                })()}

            <ReviewModal
                isOpen={showReviewModal}
                onClose={() => setShowReviewModal(false)}
                courseId={parseInt(courseId)}
                courseName={translatedTitle || courseData.title}
            />
            {/* 🟢 [IN-APP PURCHASE]: 모바일 앱에서만 표시 (TicketPlans 컴포넌트 내부에서도 체크) */}
            {showSubscriptionModal && (
                <TicketPlans
                    courseId={parseInt(courseId)}
                    courseGrade={(courseData.grade || "FREE").toUpperCase() === "PREMIUM" ? "PREMIUM" : "BASIC"}
                    context={subscriptionModalContext}
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
            {showBridgeModal && (
                <BridgeModal
                    onClose={() => setShowBridgeModal(false)}
                    onProceedToLogin={() => {
                        setShowBridgeModal(false);
                        setLoginModalPreset("courseDetail");
                        setShowLoginModal(true);
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
                    preset={loginModalPreset}
                />
            )}
            {/* 🟢 찜 추가/취소 하단 시트: 클릭 즉시 아래에서 올라옴, 1초 뒤 자동 사라짐 */}
            {showFavoriteAddedModal && (
                <>
                    <div
                        className="fixed inset-0 z-5000 bg-black/40 backdrop-blur-sm"
                        style={{ pointerEvents: "none" }}
                        aria-hidden
                    />
                    <div
                        className="fixed left-0 right-0 bottom-0 z-5001 flex justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pointer-events-auto"
                        style={{
                            transform: favoriteModalSlideUp ? "translateY(0)" : "translateY(100%)",
                            transition: "transform 0.3s ease-out",
                        }}
                    >
                        <div
                            className="bg-white dark:bg-[#1a241b] rounded-t-2xl rounded-b-2xl px-6 py-4 shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-sm flex items-center gap-3 cursor-pointer"
                            onClick={() => {
                                setFavoriteModalSlideUp(false);
                                setTimeout(() => {
                                    setShowFavoriteAddedModal(false);
                                    if (favoriteSheetType === "added") router.push("/mypage");
                                }, 300);
                            }}
                        >
                            <span className="w-6 h-6 shrink-0 text-red-500 dark:text-red-400 [&_svg]:size-full">
                                {favoriteSheetType === "added" ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12.001 4.52853C14.35 2.42 17.98 2.49 20.2426 4.75736C22.5053 7.02472 22.583 10.637 20.4786 12.993L11.9999 21.485L3.52138 12.993C1.41705 10.637 1.49571 7.01901 3.75736 4.75736C6.02157 2.49315 9.64519 2.41687 12.001 4.52853Z"></path>
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12.001 4.52853C14.35 2.42 17.98 2.49 20.2426 4.75736C22.5053 7.02472 22.583 10.637 20.4786 12.993L11.9999 21.485L3.52138 12.993C1.41705 10.637 1.49571 7.01901 3.75736 4.75736C6.02157 2.49315 9.64519 2.41687 12.001 4.52853ZM18.827 6.1701C17.3279 4.66794 14.9076 4.60701 13.337 6.01687L12.0019 7.21524L10.6661 6.01781C9.09098 4.60597 6.67506 4.66808 5.17157 6.17157C3.68183 7.66131 3.60704 10.0473 4.97993 11.6232L11.9999 18.6543L19.0201 11.6232C20.3935 10.0467 20.319 7.66525 18.827 6.1701Z"></path>
                                    </svg>
                                )}
                            </span>
                            <p className="text-sm font-medium text-gray-900 dark:text-white flex-1">
                                {favoriteSheetType === "added"
                                    ? t("courseDetail.favoriteAdded")
                                    : t("courseDetail.favoriteRemoved")}
                            </p>
                        </div>
                    </div>
                </>
            )}
            {/* 🟢 나만의 추억 한도 초과 하단 시트 (아래에서 위로 올라옴) - 웹 폰 목업에서는 폰 안으로 */}
            {showMemoryLimitModal &&
                (() => {
                    const posClass = containInPhone && !inApp ? "absolute" : "fixed";
                    const modalContent = (
                        <>
                            <div
                                className={`${posClass} inset-0 z-5000 bg-black/60 backdrop-blur-sm animate-fade-in`}
                                style={containInPhone && !inApp ? { width: "100%", height: "100%" } : undefined}
                                onClick={() => setShowMemoryLimitModal(false)}
                                aria-hidden
                            />
                            <div className={`${posClass} left-0 right-0 bottom-0 z-5001 w-full`}>
                                <div
                                    className="bg-white dark:bg-[#1a241b] rounded-t-2xl border-t border-gray-100 dark:border-gray-800 w-full shadow-2xl transition-transform duration-300 ease-out"
                                    style={{
                                        transform: memoryLimitModalSlideUp ? "translateY(0)" : "translateY(100%)",
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="p-6 pt-8 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center">
                                        <div className="mb-4 flex justify-center">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                                className="w-12 h-12 text-gray-600 dark:text-gray-300"
                                            >
                                                <path d="M19 10H20C20.5523 10 21 10.4477 21 11V21C21 21.5523 20.5523 22 20 22H4C3.44772 22 3 21.5523 3 21V11C3 10.4477 3.44772 10 4 10H5V9C5 5.13401 8.13401 2 12 2C15.866 2 19 5.13401 19 9V10ZM5 12V20H19V12H5ZM11 14H13V18H11V14ZM17 10V9C17 6.23858 14.7614 4 12 4C9.23858 4 7 6.23858 7 9V10H17Z" />
                                            </svg>
                                        </div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                                            {t("courseDetail.memoryLimitReached")}
                                        </h2>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                                            {t("courseDetail.upgradeToSaveMore")}
                                        </p>
                                        <div className="flex flex-col gap-3">
                                            <button
                                                onClick={() => {
                                                    setShowMemoryLimitModal(false);
                                                    setShowSubscriptionModal(true);
                                                }}
                                                className="w-full py-4 text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition-all"
                                                style={{ backgroundColor: "#99c08e" }}
                                            >
                                                {t("courseDetail.subscriptionUpgrade")}
                                            </button>
                                            <button
                                                onClick={() => setShowMemoryLimitModal(false)}
                                                className="w-full py-3 text-gray-600 dark:text-gray-400 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                            >
                                                {t("common.close")}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    );
                    const portalTarget =
                        containInPhone && !inApp && modalContainerRef?.current
                            ? modalContainerRef.current
                            : document.body;
                    return createPortal(modalContent, portalTarget);
                })()}
            {showPlaceModal &&
                selectedPlace &&
                (() => {
                    const posClass = containInPhone && !inApp ? "absolute" : "fixed";
                    const modalContent = (
                        <div
                            className={`${posClass} inset-0 bg-black/60 z-9999 flex flex-col justify-end animate-fade-in`}
                            onClick={() => {
                                setPlaceModalSlideUp(false);
                                setTimeout(() => setShowPlaceModal(false), 300);
                            }}
                        >
                            <div
                                className={`${posClass} left-0 right-0 top-14 bottom-0 flex flex-col pointer-events-none`}
                            >
                                <div
                                    className="pointer-events-auto bg-white dark:bg-[#1a241b] rounded-t-2xl w-full max-w-md h-full overflow-hidden flex flex-col shadow-2xl mx-auto pb-[env(safe-area-inset-bottom)]"
                                    style={{
                                        transform: placeModalSlideUp
                                            ? `translateY(${placeModalDragY}px)`
                                            : "translateY(100%)",
                                        transition: placeModalDragY === 0 ? "transform 0.3s ease-out" : "none",
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="relative h-72 shrink-0 bg-gray-100 dark:bg-gray-800">
                                        {selectedPlace.imageUrl && (
                                            <Image
                                                src={selectedPlace.imageUrl}
                                                alt={selectedPlace.name}
                                                fill
                                                className="object-cover pointer-events-none"
                                                priority
                                                quality={60}
                                                sizes="(max-width: 768px) 95vw, 448px"
                                                placeholder="blur"
                                                blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDQ4IiBoZWlnaHQ9IjE5MiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDQ4IiBoZWlnaHQ9IjE5MiIgZmlsbD0iI2VlZSIvPjwvc3ZnPg=="
                                            />
                                        )}
                                        {/* 이미지 위 장소 이름 오버레이 */}
                                        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent pt-12 pb-4 px-4 z-1">
                                            <h3 className="text-lg font-bold text-white drop-shadow-md">
                                                {selectedPlace.name}
                                            </h3>
                                        </div>
                                        {/* 이미지 전체 영역: 잡고 내리면 모달 닫힘 */}
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            aria-label={t("courseDetail.modalClose")}
                                            onPointerDown={handlePlaceModalPointerDown}
                                            className="absolute inset-0 flex flex-col items-center pt-3 touch-none cursor-grab active:cursor-grabbing z-10"
                                        >
                                            <span className="w-12 h-1.5 rounded-full bg-white/90 shadow-md shrink-0" />
                                        </div>
                                    </div>
                                    <div
                                        ref={placeModalScrollRef}
                                        className="p-5 text-black dark:text-white flex-1 min-h-0 overflow-y-auto scrollbar-hide"
                                    >
                                        <h3 className="text-xl font-bold mb-2 dark:text-white">{selectedPlace.name}</h3>
                                        <div className="mb-3">
                                            <PlaceStatusBadge
                                                place={{
                                                    opening_hours: selectedPlace.opening_hours ?? null,
                                                    closed_days: selectedPlace.closed_days ?? [],
                                                }}
                                                closedDays={selectedPlace.closed_days}
                                                showHours={false}
                                                size="sm"
                                            />
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 font-medium truncate">
                                            {selectedPlace.address}
                                        </p>
                                        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap mb-6">
                                            {selectedPlace.description || "상세 설명이 없습니다."}
                                        </p>
                                        {/* 🟢 팁 섹션: 무료 팁(항상) + 유료 팁(권한 시만, 없으면 CTA) */}
                                        {(() => {
                                            const coursePlace = sortedCoursePlaces.find(
                                                (cp) => cp.place.id === selectedPlace.id,
                                            );
                                            const freeTips = parseTipsFromDb(coursePlace?.coaching_tip_free);
                                            const paidTips = parseTipsFromDb(coursePlace?.coaching_tip);
                                            const hasFreeTip = freeTips.length > 0;
                                            const hasPaidTip = coursePlace?.hasPaidTip ?? paidTips.length > 0;

                                            if (!hasFreeTip && !hasPaidTip) return null;

                                            const courseGrade = (courseData.grade || "FREE").toUpperCase();
                                            const currentUserTier = (userTier || "FREE").toUpperCase();
                                            const shouldShowPaidTip = !(
                                                (courseGrade === "FREE" && currentUserTier === "FREE") ||
                                                courseData.isLocked
                                            );

                                            return (
                                                <div className="mb-4 flex flex-col gap-2">
                                                    {hasFreeTip && (
                                                        <TipSection tips={freeTips} variant="free" compact={false} />
                                                    )}
                                                    {hasPaidTip &&
                                                        (shouldShowPaidTip ? (
                                                            <TipSection
                                                                tips={paidTips}
                                                                variant="paid"
                                                                compact={false}
                                                            />
                                                        ) : (
                                                            <>
                                                                <div className="rounded-xl p-3 bg-[#FFFBEB] dark:bg-[#1c1917] dark:border dark:border-amber-800/50">
                                                                    {(() => {
                                                                        const copy = getPremiumQuestions(
                                                                            selectedPlace?.category,
                                                                        );
                                                                        return (
                                                                            <>
                                                                                <div className="flex items-center gap-1.5 mb-1">
                                                                                    <Icons.Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300 shrink-0" />
                                                                                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                                                                        이 구역 시크릿 공략집
                                                                                    </span>
                                                                                </div>
                                                                                <div className="pl-5">
                                                                                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                                                                                        {copy.headline}
                                                                                    </p>
                                                                                    {copy.questions.length > 0 && (
                                                                                        <ul className="mt-1.5 space-y-0.5 text-[11px] text-gray-600 dark:text-gray-400">
                                                                                            {copy.questions.map(
                                                                                                (q, i) => (
                                                                                                    <li
                                                                                                        key={i}
                                                                                                        className="flex gap-1.5 items-start"
                                                                                                    >
                                                                                                        <TipCategoryIcon
                                                                                                            category={
                                                                                                                q.iconCategory
                                                                                                            }
                                                                                                            className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                                                                                                        />
                                                                                                        <span>
                                                                                                            {q.text}
                                                                                                        </span>
                                                                                                    </li>
                                                                                                ),
                                                                                            )}
                                                                                        </ul>
                                                                                    )}
                                                                                </div>
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (isAuthenticated) {
                                                                            setSubscriptionModalContext("TIPS");
                                                                            setShowSubscriptionModal(true);
                                                                        } else {
                                                                            setSubscriptionModalContext("TIPS");
                                                                            setShowBridgeModal(true);
                                                                        }
                                                                    }}
                                                                    className="w-full py-3 rounded-lg bg-emerald-500 text-white font-bold shadow-lg hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
                                                                >
                                                                    <Icons.Lock className="w-4 h-4" />
                                                                    시크릿 꿀팁 잠금 해제 (커피 한 잔 값)
                                                                </button>
                                                            </>
                                                        ))}
                                                </div>
                                            );
                                        })()}
                                        <div className="flex flex-col gap-2">
                                            {/* 🟢 예약하기: 하단 시트로 열기 (휴무일이면 "다른 날 예약하기") */}
                                            {selectedPlace.reservationUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setWebSheetUrl(selectedPlace.reservationUrl!);
                                                        setShowWebSheet(true);
                                                    }}
                                                    className="w-full py-3 rounded-lg bg-emerald-500 text-white font-bold shadow-lg hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
                                                >
                                                    <Icons.ExternalLink className="w-4 h-4" />
                                                    {getPlaceStatus(
                                                        selectedPlace.opening_hours ?? null,
                                                        selectedPlace.closed_days ?? [],
                                                    ).status === "휴무"
                                                        ? t("courses.reserveOtherDay")
                                                        : t("courses.reserve")}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                                onClick={() => {
                                                    setPlaceModalSlideUp(false);
                                                    setTimeout(() => setShowPlaceModal(false), 300);
                                                }}
                                            >
                                                그냥 닫기
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                    const portalTarget =
                        containInPhone && !inApp && modalContainerRef?.current
                            ? modalContainerRef.current
                            : document.body;
                    return createPortal(modalContent, portalTarget);
                })()}

            {/* 🟢 예약하기 / 네이버 지도 바텀 시트 (헤더 아래~하단 전체, 핸들바만) - 웹 폰 목업에서는 폰 안으로 */}
            {showWebSheet &&
                webSheetUrl &&
                (() => {
                    const posClass = containInPhone && !inApp ? "absolute" : "fixed";
                    const modalContent = (
                        <>
                            <div
                                className={`${posClass} inset-0 bg-black/60 z-10000 animate-fade-in`}
                                onClick={webSheetClose}
                                aria-hidden
                            />
                            <div className={`${posClass} top-14 left-0 right-0 bottom-0 z-10010 pointer-events-none`}>
                                <div
                                    className="pointer-events-auto h-full bg-white dark:bg-[#1a241b] rounded-t-2xl border-t border-gray-100 dark:border-gray-800 w-full overflow-hidden flex flex-col shadow-2xl transition-transform duration-300 ease-out"
                                    style={{
                                        transform: webSheetSlideUp
                                            ? `translateY(${webSheetDragY}px)`
                                            : "translateY(100%)",
                                        transition: webSheetDragY === 0 ? "transform 0.3s ease-out" : "none",
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {/* 핸들바 영역 전체 드래그로 닫기 */}
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        aria-label={t("courseDetail.sheetClose")}
                                        onPointerDown={handleWebSheetPointerDown}
                                        className="flex items-center justify-center shrink-0 pt-3 pb-3 touch-none cursor-grab active:cursor-grabbing"
                                    >
                                        <span className="w-12 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                                    </div>
                                    <iframe
                                        src={webSheetUrl}
                                        title="예약 / 지도"
                                        className="flex-1 w-full min-h-0 border-0"
                                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                                    />
                                </div>
                            </div>
                        </>
                    );
                    const portalTarget =
                        containInPhone && !inApp && modalContainerRef?.current
                            ? modalContainerRef.current
                            : document.body;
                    return createPortal(modalContent, portalTarget);
                })()}

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
                            alt={t("courseDetail.reviewImageAlt")}
                            className="max-w-full max-h-full object-contain"
                        />
                    </div>
                </div>
            )}
        </>
    );
}
