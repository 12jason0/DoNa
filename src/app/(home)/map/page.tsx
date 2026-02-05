"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Container as MapDiv, NaverMap, Marker, Polyline } from "react-naver-maps";
import TicketPlans from "@/components/TicketPlans";
import LoginModal from "@/components/LoginModal";
import TapFeedback from "@/components/TapFeedback";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch, fetchSession } from "@/lib/authClient";

// --- 타입 정의 ---
interface Place {
    id: string; // ID를 문자열로 통일
    name: string;
    category: string;
    address: string;
    description?: string;
    phone?: string;
    latitude: number;
    longitude: number;
    source: "kakao" | "db";
}

interface Course {
    id: string; // ID를 문자열로 통일
    title: string;
    description: string;
    distance: number;
    latitude?: number;
    longitude?: number;
}

/** 코스 상세 API 응답 (GET /api/courses/[id] 는 payload를 그대로 반환) */
interface CourseDetailApiBody {
    coursePlaces?: Array<{
        order_index?: number;
        place?: {
            id?: number | string;
            name?: string | null;
            address?: string | null;
            category?: string | null;
            latitude?: number | null;
            longitude?: number | null;
        };
    }>;
}

// --- 1. 흰색 핀 + 컬러 아이콘 (카테고리별) ---
const MARKER_ICONS = {
    // 식당: 주황색 포크/나이프 (Lucide utensils)
    restaurant: `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
    // 카페: 갈색 커피잔 (Lucide coffee)
    cafe: `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/></svg>`,
    // 술집: 파란색 맥주잔 (Lucide beer)
    bar: `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M9 12v6"/><path d="M13 12v6"/><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"/><path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/></svg>`,
    // 놀거리/관광: 보라색 티켓 (Lucide ticket)
    play: `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>`,
    // 서점: 청록색 책 (Lucide book)
    bookstore: `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/></svg>`,
    // 명소: 이색데이트/공방/쇼핑몰 (Lucide landmark)
    landmark: `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/></svg>`,
    // 기본: 회색 핀
    default: `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
};

type CategoryIconKey = keyof typeof MARKER_ICONS;

function getCategoryIconKey(category: string): CategoryIconKey {
    const cat = category?.toLowerCase() || "";
    if (
        cat.includes("카페") ||
        cat.includes("cafe") ||
        cat.includes("커피") ||
        cat.includes("던킨") ||
        cat.includes("dunkin")
    )
        return "cafe";
    if (
        cat.includes("음식") ||
        cat.includes("식당") ||
        cat.includes("맛집") ||
        cat.includes("피자") ||
        cat.includes("한식") ||
        cat.includes("중식") ||
        cat.includes("양식") ||
        cat.includes("일식") ||
        cat.includes("이탈리안") ||
        cat.includes("italian")
    )
        return "restaurant";
    // 미술관·박물관·갤러리·이색데이트·공방·쇼핑몰 → 명소 (bar보다 먼저, '미술관'이 '술'에 걸리지 않도록)
    if (
        cat.includes("미술관") ||
        cat.includes("박물관") ||
        cat.includes("갤러리") ||
        cat.includes("도서관") ||
        cat.includes("이색데이트") ||
        cat.includes("공방") ||
        cat.includes("쇼핑몰") ||
        cat.includes("쇼핑")
    )
        return "landmark";
    if (
        cat.includes("술") ||
        cat.includes("바") ||
        cat.includes("맥주") ||
        cat.includes("호프") ||
        cat.includes("주점")
    )
        return "bar";
    if (
        cat.includes("관광") ||
        cat.includes("명소") ||
        cat.includes("놀거리") ||
        cat.includes("문화") ||
        cat.includes("뷰티") ||
        cat.includes("전시") ||
        cat.includes("테마파크") ||
        cat.includes("테마타크")
    )
        return "play";
    if (cat.includes("서점") || cat.includes("책") || cat.includes("북") || cat.includes("book")) return "bookstore";
    return "default";
}

// 리스트용: 둥근 사각형 박스 + 카테고리 아이콘 (F-Pattern, "사진인 척")
const svgProps = {
    xmlns: "http://www.w3.org/2000/svg" as const,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
};
function PlaceListIconBox({ iconKey }: { iconKey: CategoryIconKey }) {
    const iconClass = "w-8 h-8 shrink-0";
    return (
        <div className="flex items-center justify-center shrink-0">
            {iconKey === "restaurant" && (
                <svg {...svgProps} className={`${iconClass} text-orange-500 dark:text-orange-400`}>
                    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                    <path d="M7 2v20" />
                    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                </svg>
            )}
            {iconKey === "cafe" && (
                <svg {...svgProps} className={`${iconClass} text-amber-800 dark:text-amber-600`}>
                    <path d="M10 2v2" />
                    <path d="M14 2v2" />
                    <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
                    <path d="M6 2v2" />
                </svg>
            )}
            {iconKey === "bar" && (
                <svg {...svgProps} className={`${iconClass} text-blue-500 dark:text-blue-400`}>
                    <path d="M17 11h1a3 3 0 0 1 0 6h-1" />
                    <path d="M9 12v6" />
                    <path d="M13 12v6" />
                    <path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z" />
                    <path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />
                </svg>
            )}
            {iconKey === "play" && (
                <svg {...svgProps} className={`${iconClass} text-purple-500 dark:text-purple-400`}>
                    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                    <path d="M13 5v2" />
                    <path d="M13 17v2" />
                    <path d="M13 11v2" />
                </svg>
            )}
            {iconKey === "bookstore" && (
                <svg {...svgProps} className={`${iconClass} text-teal-600 dark:text-teal-400`}>
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
                </svg>
            )}
            {iconKey === "landmark" && (
                <svg {...svgProps} className={`${iconClass} text-rose-500 dark:text-rose-400`}>
                    <path d="M3 21h18" />
                    <path d="M5 21V7l8-4v18" />
                    <path d="M19 21V11l-6-4" />
                    <path d="M9 9v.01" />
                    <path d="M9 12v.01" />
                    <path d="M9 15v.01" />
                    <path d="M9 18v.01" />
                </svg>
            )}
            {iconKey === "default" && (
                <svg {...svgProps} className={`${iconClass} text-gray-500 dark:text-gray-400`}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                </svg>
            )}
        </div>
    );
}

function createReactNaverMapIcon(category: string, isSelected: boolean = false, source: "kakao" | "db" = "kakao") {
    const iconKey = getCategoryIconKey(category);
    const baseSize = isSelected ? 42 : 34;
    const iconBox = isSelected ? 20 : 16;
    const zIndexStyle = isSelected ? 999 : source === "db" ? 500 : 100;

    return {
        content: `
            <div style="
                width: ${baseSize}px; height: ${baseSize}px;
                position: relative;
                z-index: ${zIndexStyle};
                filter: drop-shadow(0 3px 6px rgba(0,0,0,0.15));
                transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                ${isSelected ? "transform: scale(1.15);" : ""}
            ">
                <div style="
                    width: 100%; height: 100%;
                    background: #ffffff;
                    border: 2px solid rgba(0,0,0,0.08);
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    display: flex; align-items: center; justify-content: center;
                    box-sizing: border-box;
                ">
                    <div style="
                        width: ${iconBox}px; height: ${iconBox}px;
                        display: flex; align-items: center; justify-content: center;
                        transform: rotate(45deg);
                    ">
                        ${MARKER_ICONS[iconKey]}
                    </div>
                </div>
            </div>
        `,
        size: { width: baseSize, height: baseSize },
        anchor: { x: baseSize / 2, y: baseSize / 2 },
    };
}

// --- 2. 내 위치 마커 (유지) ---
function createUserLocationIcon() {
    return {
        content: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center;">
                <div style="
                    position: absolute; width: 60px; height: 60px;
                    background: rgba(59, 130, 246, 0.3); border-radius: 50%;
                    animation: pulse-ring 2s infinite;
                "></div>
                <div style="
                    position: relative; width: 22px; height: 22px;
                    background: #2563EB; border: 3px solid white; border-radius: 50%;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3); z-index: 1000;
                "></div>
                <style>
                    @keyframes pulse-ring {
                        0% { transform: scale(0.5); opacity: 0; }
                        100% { transform: scale(1.5); opacity: 0; }
                    }
                </style>
            </div>
        `,
        anchor: { x: 11, y: 11 },
    };
}

const LoadingSpinner = ({ text = "로딩 중..." }: { text?: string }) => (
    <div className="flex flex-col justify-center items-center h-full gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-emerald-100 border-t-emerald-600 dark:border-emerald-900 dark:border-t-emerald-400" />
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{text}</p>
    </div>
);

// --- 메인 지도 페이지 ---
function MapPageInner() {
    const router = useRouter();
    const [mapsReady, setMapsReady] = useState(false);
    const mapRef = useRef<any>(null);

    const navermaps =
        typeof window !== "undefined" && (window as any).naver && (window as any).naver.maps
            ? (window as any).naver.maps
            : null;

    const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 37.5665, lng: 126.978 });
    const [zoom, setZoom] = useState(15);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    // ✅ [수정] 중복 방지를 위해 상태 관리
    const [places, setPlaces] = useState<Place[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);

    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [searchInput, setSearchInput] = useState("");
    const [activeTab, setActiveTab] = useState<"places" | "courses">("places");
    const [loading, setLoading] = useState(false);
    const [panelState, setPanelState] = useState<"minimized" | "default" | "expanded">("default");
    const [showMapSearchButton, setShowMapSearchButton] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [userTier, setUserTier] = useState<"FREE" | "BASIC" | "PREMIUM">("FREE");
    /** 코스 탭에서 선택한 코스 → 지도에 루트(폴리라인) 표시 */
    const [selectedCourseForRoute, setSelectedCourseForRoute] = useState<Course | null>(null);
    const [courseRoutePath, setCourseRoutePath] = useState<{ lat: number; lng: number }[]>([]);
    /** 선택한 코스에 포함된 장소만 표시 (코스 클릭 시 장소 검색 결과 대신) */
    const [coursePlacesList, setCoursePlacesList] = useState<Place[]>([]);
    /** 코스 클릭 후 장소 목록 로딩 중 (캐시 없을 때만 true) */
    const [coursePlacesLoading, setCoursePlacesLoading] = useState(false);
    /** 코스별 장소·경로 캐시 (같은 코스 재클릭 시 즉시 표시) */
    const courseDetailCacheRef = useRef<Record<string, { path: { lat: number; lng: number }[]; list: Place[] }>>({});

    const { isAuthenticated } = useAuth();

    // 🟢 사용자 등급 가져오기 함수
    const fetchUserTier = async () => {
        if (!isAuthenticated) {
            setUserTier("FREE");
            return;
        }
        try {
            const data = await authenticatedFetch<{ user?: { subscriptionTier?: string } }>("/api/users/profile");
            const tier = (data?.user?.subscriptionTier || "FREE").toUpperCase();
            setUserTier(tier as "FREE" | "BASIC" | "PREMIUM");
        } catch {
            setUserTier("FREE");
        }
    };

    // 🟢 사용자 등급 미리 로드 (캐싱)
    useEffect(() => {
        fetchUserTier();
    }, [isAuthenticated]);

    // 🟢 구독 변경 이벤트 리스너 (환불 후 실시간 업데이트)
    useEffect(() => {
        const handleSubscriptionChanged = () => {
            console.log("[MapPage] 구독 변경 감지 - 사용자 등급 갱신");
            fetchUserTier();
        };
        window.addEventListener("subscriptionChanged", handleSubscriptionChanged as EventListener);
        return () => window.removeEventListener("subscriptionChanged", handleSubscriptionChanged as EventListener);
    }, [isAuthenticated]);
    const dragStartY = useRef<number>(0);
    const fetchAbortRef = useRef<AbortController | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2000);
    };

    // 🟢 코스 클릭 시 권한 체크 후 모달 표시 또는 이동 (캐시만 사용해 즉시 반응)
    const handleCourseClick = (course: any) => {
        const cleanId = course.id.startsWith("c-") ? course.id.replace("c-", "") : course.id;
        const courseGrade = (course.grade || "FREE").toUpperCase();
        const currentUserTier = userTier.toUpperCase();

        if (courseGrade === "FREE") {
            router.push(`/courses/${cleanId}`);
            return;
        }
        if (!isAuthenticated) {
            setShowLoginModal(true);
            return;
        }
        if (currentUserTier === "PREMIUM") {
            router.push(`/courses/${cleanId}`);
            return;
        }
        if (currentUserTier === "BASIC" && courseGrade === "BASIC") {
            router.push(`/courses/${cleanId}`);
            return;
        }
        setShowSubscriptionModal(true);
    };

    /** 코스 상세 fetch + path/list 파싱 (캐시만 채우는 prefetch용) */
    const fetchCourseDetailToCache = useCallback(async (courseId: string, cleanId: string) => {
        const { apiFetch } = await import("@/lib/authClient");
        const { data } = await apiFetch<CourseDetailApiBody>(`/api/courses/${cleanId}`, { cache: "no-store" });
        const coursePlaces = data?.coursePlaces;
        if (!Array.isArray(coursePlaces)) return;
        const sorted = coursePlaces.slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        const path = sorted
            .map((cp) => {
                const lat = cp.place?.latitude;
                const lng = cp.place?.longitude;
                if (lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))) {
                    return { lat: Number(lat), lng: Number(lng) };
                }
                return null;
            })
            .filter((p): p is { lat: number; lng: number } => p !== null);
        const list: Place[] = sorted
            .map((cp) => {
                const p = cp.place;
                if (!p) return null;
                const lat = p.latitude != null ? Number(p.latitude) : NaN;
                const lng = p.longitude != null ? Number(p.longitude) : NaN;
                if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
                return {
                    id: String(p.id ?? ""),
                    name: p.name ?? "",
                    category: p.category ?? "",
                    address: p.address ?? "",
                    latitude: lat,
                    longitude: lng,
                    source: "db" as const,
                };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null) as Place[];
        courseDetailCacheRef.current[courseId] = { path, list };
    }, []);

    /** 코스 목록 로드 후 상세 데이터 미리 가져오기 (클릭 시 즉시 표시용) */
    const prefetchCourseDetail = useCallback(
        (course: { id: string }) => {
            const courseId = course.id;
            const cleanId = courseId.startsWith("c-") ? courseId.replace("c-", "") : courseId;
            if (courseDetailCacheRef.current[courseId]) return;
            fetchCourseDetailToCache(courseId, cleanId).catch(() => {});
        },
        [fetchCourseDetailToCache]
    );

    /** 코스 탭에서 코스 클릭 시 지도에 루트 표시 + 장소 목록 (캐시 있으면 즉시 표시) */
    const handleCourseSelectForRoute = useCallback(
        async (course: any) => {
            const courseId = course.id;
            const cleanId = courseId.startsWith("c-") ? courseId.replace("c-", "") : courseId;
            setSelectedCourseForRoute(course);
            setSelectedPlace(null);

            const cached = courseDetailCacheRef.current[courseId];
            if (cached) {
                setCourseRoutePath(cached.path);
                setCoursePlacesList(cached.list);
                setCoursePlacesLoading(false);
                return;
            }

            setCourseRoutePath([]);
            setCoursePlacesList([]);
            setCoursePlacesLoading(true);
            try {
                await fetchCourseDetailToCache(courseId, cleanId);
                const cachedAfter = courseDetailCacheRef.current[courseId];
                if (cachedAfter) {
                    setCourseRoutePath(cachedAfter.path);
                    setCoursePlacesList(cachedAfter.list);
                }
            } catch {
                setCourseRoutePath([]);
                setCoursePlacesList([]);
            } finally {
                setCoursePlacesLoading(false);
            }
        },
        [fetchCourseDetailToCache]
    );

    /** 코스 탭 → 장소 탭 전환 시 선택 코스·리스트·로딩 초기화 */
    useEffect(() => {
        if (activeTab === "places") {
            setSelectedCourseForRoute(null);
            setCourseRoutePath([]);
            setCoursePlacesList([]);
            setCoursePlacesLoading(false);
        }
    }, [activeTab]);

    /** 코스 클릭 시 해당 코스 루트가 지도에 보이도록 뷰 이동( fitBounds ) */
    useEffect(() => {
        if (!selectedCourseForRoute || courseRoutePath.length < 2 || !mapRef.current || !navermaps) return;
        try {
            const bounds = new navermaps.LatLngBounds();
            courseRoutePath.forEach((p) => bounds.extend(new navermaps.LatLng(p.lat, p.lng)));
            requestAnimationFrame(() => {
                if (mapRef.current) {
                    mapRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
                }
            });
        } catch (e) {
            if (process.env.NODE_ENV === "development") {
                console.warn("[MapPage] 코스 루트 fitBounds 실패:", e);
            }
        }
    }, [selectedCourseForRoute?.id, courseRoutePath, navermaps]);

    /** 길찾기: 앱(nmap) 또는 웹(출발=현재위치, 도착=해당 장소) */
    const handleFindWay = useCallback((place: Place | null) => {
        if (!place) return;

        const dlat = Number(place.latitude);
        const dlng = Number(place.longitude);
        const destination = place.name || place.address || "목적지";

        if (Number.isNaN(dlat) || Number.isNaN(dlng)) {
            showToast("해당 장소의 위치 정보가 없어요.");
            return;
        }

        const appUrl = `nmap://route/public?dlat=${dlat}&dlng=${dlng}&dname=${encodeURIComponent(destination)}&appname=${encodeURIComponent("kr.io.dona.dona")}`;
        const searchOnlyUrl = `https://map.naver.com/p/search/${encodeURIComponent(destination)}`;

        const openWebDirections = () => {
            if (!navigator.geolocation) {
                window.open(searchOnlyUrl, "_blank", "noopener,noreferrer");
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const slng = pos.coords.longitude;
                    const slat = pos.coords.latitude;
                    const directionsUrl = `https://map.naver.com/index.nhn?slng=${slng}&slat=${slat}&stext=${encodeURIComponent("현재 위치")}&elng=${dlng}&elat=${dlat}&etext=${encodeURIComponent(destination)}&menu=route`;
                    window.open(directionsUrl, "_blank", "noopener,noreferrer");
                },
                () => {
                    window.open(searchOnlyUrl, "_blank", "noopener,noreferrer");
                },
                { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
            );
        };

        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        if (isMobile) {
            const startTime = Date.now();
            window.location.href = appUrl;
            setTimeout(() => {
                if (document.visibilityState === "visible" && Date.now() - startTime < 1500) {
                    openWebDirections();
                }
            }, 500);
        } else {
            openWebDirections();
        }
    }, []);

    // 1. 네이버 지도 SDK 로드
    useEffect(() => {
        if (typeof window === "undefined") return;
        if ((window as any).naver && (window as any).naver.maps) {
            setMapsReady(true);
            return;
        }
        const existing = document.getElementById("naver-maps-script-fallback");
        if (existing) return;

        const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "";
        if (!clientId) return;

        const script = document.createElement("script");
        script.id = "naver-maps-script-fallback";
        script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            const checkInterval = setInterval(() => {
                if ((window as any).naver && (window as any).naver.maps) {
                    setMapsReady(true);
                    clearInterval(checkInterval);
                }
            }, 100);
        };
        document.head.appendChild(script);
    }, []);

    // 2. CSS로 스크롤 경고 완화
    useEffect(() => {
        const style = document.createElement("style");
        style.innerHTML = `
      body, html { overscroll-behavior: none; touch-action: none; }
      #react-naver-map { touch-action: none !important; }
      /* 스크롤바 숨기기 */
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // 3. ✅ [핵심 수정] 데이터 Fetching 및 중복 제거 로직
    const fetchAllData = useCallback(
        async (
            location: { lat: number; lng: number },
            keyword?: string,
            bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number }
        ) => {
            try {
                try {
                    fetchAbortRef.current?.abort();
                } catch {}
                const aborter = new AbortController();
                fetchAbortRef.current = aborter;

                let minLat, maxLat, minLng, maxLng;
                let centerLat = location.lat;
                let centerLng = location.lng;

                if (bounds) {
                    ({ minLat, maxLat, minLng, maxLng } = bounds);
                    // bounds의 중심점 계산
                    centerLat = (minLat + maxLat) / 2;
                    centerLng = (minLng + maxLng) / 2;
                } else {
                    const range = 0.02;
                    minLat = location.lat - range;
                    maxLat = location.lat + range;
                    minLng = location.lng - range;
                    maxLng = location.lng + range;
                }

                const myDataUrl = `/api/map?minLat=${minLat}&maxLat=${maxLat}&minLng=${minLng}&maxLng=${maxLng}`;

                // 카카오 API와 DB API를 항상 병렬 호출 (DB 데이터가 적어도 카카오 데이터가 필요)
                const promises: Promise<any>[] = [
                    fetch(myDataUrl, { signal: aborter.signal }).then((res) => res.json()),
                ];

                // 카카오 API 호출 (keyword가 있으면 keyword 사용, 없으면 기본 "맛집")
                const effectiveKeyword = keyword && keyword.trim() ? keyword : "맛집";
                let radius = 2000; // 기본 2km

                if (bounds) {
                    // bounds가 있으면 bounds 크기에 맞는 반경 계산
                    const latDiff = maxLat - minLat;
                    const lngDiff = maxLng - minLng;
                    radius = Math.max(latDiff * 111000, lngDiff * 88800); // 위도 1도 ≈ 111km, 경도 1도 ≈ 88.8km
                }

                const placesUrl = `/api/places/search-kakao?lat=${centerLat}&lng=${centerLng}&keyword=${encodeURIComponent(
                    effectiveKeyword
                )}&radius=${Math.round(radius)}`;
                promises.push(
                    fetch(placesUrl, { signal: aborter.signal })
                        .then((res) => res.json())
                        .catch(() => ({ success: false, places: [], relatedCourses: [] })) // 카카오 API 실패해도 계속 진행
                );

                const [myData, kakaoData] = await Promise.all(promises);

                // bounds가 있으면 카카오 장소를 bounds 범위 내로 필터링
                let filteredKakaoPlaces = kakaoData.places || [];
                if (bounds && kakaoData.success && Array.isArray(kakaoData.places)) {
                    filteredKakaoPlaces = kakaoData.places.filter((p: any) => {
                        const pLat = parseFloat(p.latitude);
                        const pLng = parseFloat(p.longitude);
                        return pLat >= minLat && pLat <= maxLat && pLng >= minLng && pLng <= maxLng;
                    });
                    kakaoData.places = filteredKakaoPlaces;
                }

                // ✅ Map을 사용하여 중복 ID 원천 차단
                const uniquePlaces = new Map<string, Place>();
                const uniqueCourses = new Map<string, Course>();

                // (1) 카카오 데이터 처리 (ID 접두어: k-)
                if (kakaoData.success && Array.isArray(kakaoData.places)) {
                    kakaoData.places.forEach((p: any) => {
                        const id = `k-${p.id}`; // 접두어 강제 적용
                        uniquePlaces.set(id, {
                            ...p,
                            id: id,
                            latitude: parseFloat(p.latitude),
                            longitude: parseFloat(p.longitude),
                            source: "kakao",
                        });
                    });
                }

                // (2) DB 데이터 처리 (ID 접두어: db-)
                if (myData.places && Array.isArray(myData.places)) {
                    myData.places.forEach((p: any) => {
                        const id = `db-${p.id}`; // 접두어 강제 적용
                        uniquePlaces.set(id, { ...p, id: id, source: "db" });
                    });
                }

                // (3) 코스 데이터 처리 (ID 접두어: c-)
                // 기존 코드에서 코스 ID가 숫자 그대로 쓰여서 충돌 났을 확률 높음
                if (myData.courses && Array.isArray(myData.courses)) {
                    myData.courses.forEach((c: any) => {
                        const id = `c-${c.id}`; // 접두어 강제 적용
                        uniqueCourses.set(id, { ...c, id: id });
                    });
                }

                // 카카오 관련 코스도 처리
                if (kakaoData.relatedCourses && Array.isArray(kakaoData.relatedCourses)) {
                    kakaoData.relatedCourses.forEach((c: any) => {
                        const id = `c-${c.id}`;
                        uniqueCourses.set(id, { ...c, id: id });
                    });
                }

                // Map -> Array 변환하여 상태 업데이트
                const courseArray = Array.from(uniqueCourses.values());
                setPlaces(Array.from(uniquePlaces.values()));
                setCourses(courseArray);

                // 코스 상세 미리 가져오기 (클릭 시 즉시 표시)
                courseArray.slice(0, 10).forEach((c) => prefetchCourseDetail(c));

                if (keyword && uniqueCourses.size > 0) setActiveTab("courses");
            } catch (e: any) {
                if (e?.name !== "AbortError") {
                    console.error("Fetch error:", e);
                    // 에러 발생 시에도 빈 배열로 설정하여 UI가 멈추지 않도록
                    setPlaces([]);
                    setCourses([]);
                }
            }
        },
        [prefetchCourseDetail]
    );

    const moveToCurrentLocation = useCallback(async () => {
        if (!navigator.geolocation) {
            showToast("위치 정보를 사용할 수 없습니다.");
            return;
        }

        // 🟢 HTTP 환경에서 위치 정보 사용 불가 체크
        if (
            typeof window !== "undefined" &&
            window.location.protocol === "http:" &&
            !window.location.hostname.includes("localhost")
        ) {
            showToast("HTTPS 환경에서만 위치 정보를 사용할 수 있습니다.");
            // 현재 중심점 기준으로 데이터 로드
            try {
                await fetchAllData(center);
            } catch (error) {
                console.error("데이터 로드 오류:", error);
            }
            return;
        }

        setLoading(true);

        // 타임아웃 설정 (20초 후 자동 해제 - 더 여유있게)
        const timeoutId = setTimeout(() => {
            setLoading(false);
            showToast("위치 정보를 가져오는 데 시간이 걸리고 있어요.");
        }, 20000);

        navigator.geolocation.getCurrentPosition(
            async (p) => {
                clearTimeout(timeoutId);
                try {
                    const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
                    setUserLocation(loc);
                    setCenter(loc);
                    setZoom(16);
                    await fetchAllData(loc);
                } catch (error) {
                    console.error("위치 이동 중 오류:", error);
                    showToast("데이터를 불러오는 중 오류가 발생했습니다.");
                } finally {
                    setLoading(false);
                }
            },
            (err) => {
                clearTimeout(timeoutId);
                setLoading(false);
                console.error("위치 정보 가져오기 실패:", err);

                // 🟢 에러 코드별 구체적인 메시지 표시
                const errorMsgs: { [key: number]: string } = {
                    1: "위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.",
                    2: "위치를 확인할 수 없습니다. GPS 신호를 확인해주세요.",
                    3: "시간이 초과되었습니다. 네트워크 연결을 확인해주세요.",
                };
                const errorMsg = errorMsgs[err.code] || "위치를 가져올 수 없습니다.";
                showToast(errorMsg);

                // 현재 중심점 기준으로 데이터 로드
                try {
                    fetchAllData(center);
                } catch (error) {
                    console.error("데이터 로드 오류:", error);
                }
            },
            {
                // 🟢 실내 테스트에 더 적합한 설정
                enableHighAccuracy: false, // 실내에서는 false가 더 잘 잡힘
                timeout: 15000, // 타임아웃을 15초로 늘려 대기 시간 확보
                maximumAge: 0, // 항상 최신 위치를 가져오도록 캐시 끔
            }
        );
    }, [fetchAllData, center]);

    // 초기 로드 시 한 번만 현재 지도 중심 기준으로 데이터 로드 → 코스 탭에서 루트 표시 가능
    const initialFetchDone = useRef(false);
    useEffect(() => {
        if (!mapsReady || initialFetchDone.current) return;
        initialFetchDone.current = true;
        fetchAllData(center);
    }, [mapsReady, fetchAllData, center]);

    const handleSearch = useCallback(async () => {
        if (!searchInput.trim()) return;
        setLoading(true);
        setSelectedPlace(null);
        try {
            const res = await fetch(`/api/places/search-single?query=${encodeURIComponent(searchInput)}`);
            const data = await res.json();
            if (data.success && data.place) {
                const loc = { lat: parseFloat(data.place.lat), lng: parseFloat(data.place.lng) };
                setCenter(loc);
                await fetchAllData(loc, searchInput);
                setPanelState("default");
                setShowMapSearchButton(false);
                setSearchInput("");
            } else {
                showToast("검색 결과가 없습니다.");
            }
        } catch (e) {
            showToast("검색 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    }, [searchInput, fetchAllData]);

    const handleMapSearch = async () => {
        if (!mapRef.current) return;
        setLoading(true);
        try {
            const bounds = mapRef.current.getBounds();
            const minLat = bounds._min.y;
            const maxLat = bounds._max.y;
            const minLng = bounds._min.x;
            const maxLng = bounds._max.x;

            // bounds의 중심점 계산
            const centerLat = (minLat + maxLat) / 2;
            const centerLng = (minLng + maxLng) / 2;

            // bounds의 대각선 거리를 반경(m)으로 계산 (대략적으로)
            const latDiff = maxLat - minLat;
            const lngDiff = maxLng - minLng;
            const radius = Math.max(latDiff * 111000, lngDiff * 88800); // 위도 1도 ≈ 111km, 경도 1도 ≈ 88.8km (서울 기준)

            const myDataUrl = `/api/map?minLat=${minLat}&maxLat=${maxLat}&minLng=${minLng}&maxLng=${maxLng}`;
            // 카카오 API는 중심점과 반경으로 호출 (keyword 없이 기본 "맛집" 검색)
            const kakaoUrl = `/api/places/search-kakao?lat=${centerLat}&lng=${centerLng}&radius=${Math.round(radius)}`;

            // 병렬 요청 (DB는 빠르고, 카카오는 느릴 수 있으므로 함께 호출)
            const [myData, kakaoData] = await Promise.all([
                fetch(myDataUrl).then((res) => res.json()),
                fetch(kakaoUrl)
                    .then((res) => res.json())
                    .catch(() => ({ success: false, places: [], relatedCourses: [] })), // 카카오 API 실패해도 계속 진행
            ]);

            // 데이터 처리
            const uniquePlaces = new Map<string, Place>();
            const uniqueCourses = new Map<string, Course>();

            // (1) 카카오 데이터 처리
            if (kakaoData.success && Array.isArray(kakaoData.places)) {
                kakaoData.places.forEach((p: any) => {
                    // bounds 범위 내에 있는지 확인
                    const pLat = parseFloat(p.latitude);
                    const pLng = parseFloat(p.longitude);
                    if (pLat >= minLat && pLat <= maxLat && pLng >= minLng && pLng <= maxLng) {
                        const id = `k-${p.id}`;
                        uniquePlaces.set(id, {
                            ...p,
                            id: id,
                            latitude: pLat,
                            longitude: pLng,
                            source: "kakao",
                        });
                    }
                });
            }

            // (2) DB 데이터 처리
            if (myData.places && Array.isArray(myData.places)) {
                myData.places.forEach((p: any) => {
                    const id = `db-${p.id}`;
                    uniquePlaces.set(id, { ...p, id: id, source: "db" });
                });
            }

            // (3) 코스 데이터 처리
            if (myData.courses && Array.isArray(myData.courses)) {
                myData.courses.forEach((c: any) => {
                    const id = `c-${c.id}`;
                    uniqueCourses.set(id, { ...c, id: id });
                });
            }

            if (kakaoData.relatedCourses && Array.isArray(kakaoData.relatedCourses)) {
                kakaoData.relatedCourses.forEach((c: any) => {
                    const id = `c-${c.id}`;
                    uniqueCourses.set(id, { ...c, id: id });
                });
            }

            setPlaces(Array.from(uniquePlaces.values()));
            setCourses(Array.from(uniqueCourses.values()));
            setShowMapSearchButton(false);
            setPanelState("default");
        } catch (e: any) {
            console.error("현 지도 검색 오류:", e);
            showToast("검색 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        dragStartY.current = e.touches[0].clientY;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        const endY = e.changedTouches[0].clientY;
        const diff = endY - dragStartY.current;
        if (diff > 50) {
            if (panelState === "expanded") setPanelState("default");
            else if (panelState === "default") setPanelState("minimized");
        } else if (diff < -50) {
            if (panelState === "minimized") setPanelState("default");
            else if (panelState === "default") setPanelState("expanded");
        }
    };

    const getPanelHeightClass = () => {
        if (panelState === "expanded") return "h-[85vh]";
        if (panelState === "minimized") return "h-[120px]";
        return "h-[40vh]"; // 50vh -> 40vh로 줄여서 지도가 더 많이 보이도록
    };

    const handlePlaceClick = (place: Place) => {
        setSelectedPlace(place);
        setCenter({ lat: place.latitude, lng: place.longitude });
        setZoom(17);
        setPanelState("default");
        setShowMapSearchButton(false);
    };

    if (!mapsReady || !navermaps)
        return (
            <div className="h-screen flex items-center justify-center">
                <LoadingSpinner />
            </div>
        );

    return (
        <div className="relative w-full min-h-screen h-full overflow-hidden bg-gray-100 dark:bg-[#0f1710] font-sans touch-none">
            {/* 상단: 플로팅 UI (지도 움직일 때만 현 지도 검색 노출) */}
            <div className="absolute top-0 left-0 right-0 z-30 flex flex-col p-2 bg-linear-to-b from-white/90 via-white/60 to-transparent dark:from-[#1a241b]/90 dark:via-[#1a241b]/60 dark:to-transparent pointer-events-none">
                <div className="flex items-center gap-1.5 pointer-events-auto mb-1.5">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="shrink-0 h-8 w-8 rounded-lg bg-white dark:bg-gray-800 shadow-md flex items-center justify-center text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all"
                        aria-label="뒤로 가기"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-5 h-5 shrink-0"
                        >
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex-1 flex items-center bg-white dark:bg-[#1a241b] rounded-lg shadow-md px-2 py-1.5 min-w-0">
                        <div className="pr-1.5 text-emerald-500 dark:text-emerald-400 shrink-0">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="w-4 h-4"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="장소, 맛집, 코스 검색"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            className="flex-1 bg-transparent focus:outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-xs font-medium min-w-0"
                        />
                    </div>
                </div>

                {/* 탭: 장소 | 코스 (지도 움직이면 현 지도 검색 버튼만 표시) */}
                <div className="flex items-center justify-between pointer-events-auto w-full max-w-md mx-auto gap-1.5">
                    <div className="relative flex rounded-full bg-white dark:bg-[#1a241b] shadow-md p-0.5 min-w-0 flex-1 max-w-[160px]">
                        <div
                            className="absolute top-0.5 bottom-0.5 rounded-full bg-[#6bb88a] dark:bg-[#6bb88a] transition-[left] duration-200 ease-out"
                            style={{
                                width: "calc(50% - 2px)",
                                left: activeTab === "places" ? "2px" : "calc(50% + 0px)",
                            }}
                            aria-hidden
                        />
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab("places");
                                setSelectedPlace(null);
                                setPanelState("default");
                            }}
                            className="relative z-10 flex-1 py-1.5 rounded-full text-xs font-bold transition-colors duration-200"
                        >
                            <span
                                className={
                                    activeTab === "places" ? "text-white font-bold" : "text-gray-500 dark:text-gray-400"
                                }
                            >
                                장소
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab("courses");
                                setPanelState("default");
                            }}
                            className="relative z-10 flex-1 py-1.5 rounded-full text-xs font-bold transition-colors duration-200"
                        >
                            <span
                                className={
                                    activeTab === "courses"
                                        ? "text-white font-bold"
                                        : "text-gray-500 dark:text-gray-400"
                                }
                            >
                                코스
                            </span>
                        </button>
                    </div>
                    {showMapSearchButton && (
                        <button
                            onClick={handleMapSearch}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold shadow-md border-0 bg-white dark:bg-[#1a241b] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 active:scale-95 transition-all whitespace-nowrap shrink-0"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="w-3.5 h-3.5"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            현 지도 검색
                        </button>
                    )}
                </div>
            </div>

            {/* 지도 영역 */}
            <div className="absolute inset-0 z-0 w-full h-full">
                <MapDiv
                    id="react-naver-map"
                    style={{ width: "100%", height: "100%", touchAction: "none" }}
                    onClick={() => {
                        // 지도 영역 클릭 시 패널 최소화
                        if (selectedPlace || panelState !== "minimized") {
                            setSelectedPlace(null);
                            setPanelState("minimized");
                        }
                    }}
                >
                    <NaverMap
                        ref={mapRef}
                        center={new navermaps.LatLng(center.lat, center.lng)}
                        zoom={zoom}
                        onCenterChanged={(c) => {
                            setCenter({ lat: c.y, lng: c.x });
                            setShowMapSearchButton(true);
                        }}
                        // onClick은 NaverMap에서 지원하지 않으므로 제거
                        // 지도 클릭 기능이 필요하면 MapDiv에 onClick 핸들러를 추가해야 함
                    >
                        {userLocation && (
                            <Marker
                                position={new navermaps.LatLng(userLocation.lat, userLocation.lng)}
                                icon={createUserLocationIcon()}
                                zIndex={2000}
                            />
                        )}

                        {/* 코스 탭: 코스 선택 시에만 해당 코스 장소 표시. 장소 탭: 현 지도 검색 결과 또는 선택 장소 */}
                        {(activeTab === "courses"
                            ? selectedCourseForRoute
                                ? coursePlacesList
                                : []
                            : selectedPlace
                            ? [selectedPlace]
                            : places
                        )
                            .sort((a, b) => (a.source === "kakao" && b.source === "db" ? -1 : 1))
                            .map((place) => {
                                const isSelected = selectedPlace?.id === place.id;
                                // ✅ 여기 key가 중복되면 에러가 납니다. 위에서 id를 유니크하게 만들었으므로 안전합니다.
                                return (
                                    <Marker
                                        key={place.id}
                                        position={new navermaps.LatLng(place.latitude, place.longitude)}
                                        icon={createReactNaverMapIcon(
                                            place.category || place.name,
                                            isSelected,
                                            place.source as any
                                        )}
                                        onClick={() => handlePlaceClick(place)}
                                        zIndex={isSelected ? 1000 : place.source === "db" ? 500 : 100}
                                    />
                                );
                            })}

                        {/* 코스 탭: 코스를 클릭했을 때만 해당 코스 루트 표시 */}
                        {activeTab === "courses" &&
                            selectedCourseForRoute &&
                            courseRoutePath.length >= 2 &&
                            navermaps && (
                                <Polyline
                                    key={`selected-${selectedCourseForRoute.id}`}
                                    path={courseRoutePath.map((p) => new navermaps.LatLng(p.lat, p.lng))}
                                    strokeColor="#10b981"
                                    strokeWeight={6}
                                    strokeOpacity={1}
                                    strokeLineCap="round"
                                    strokeLineJoin="round"
                                    zIndex={300}
                                />
                            )}
                    </NaverMap>
                </MapDiv>

                {/* 토스트 메시지 */}
                <div
                    className={`absolute top-24 left-1/2 transform -translate-x-1/2 z-60 transition-all duration-300 pointer-events-none ${
                        toastMessage ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
                    }`}
                >
                    <div className="bg-gray-800/95 text-white px-5 py-3 rounded-full text-sm font-bold shadow-xl backdrop-blur-md whitespace-nowrap flex items-center gap-2 border border-gray-700">
                        {toastMessage}
                    </div>
                </div>

                {/* 내 위치 버튼 */}
                <button
                    onClick={moveToCurrentLocation}
                    className="absolute right-5 z-20 w-12 h-12 bg-white dark:bg-[#1a241b] rounded-full shadow-lg border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-700 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all active:scale-95"
                    style={{
                        bottom:
                            panelState === "expanded"
                                ? "calc(85vh + 16px)"
                                : panelState === "minimized"
                                ? "calc(120px + 16px)"
                                : "calc(40vh + 16px)",
                        transition: "bottom 0.3s ease-out",
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                        <path
                            fillRule="evenodd"
                            d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>
            </div>

            {/* 하단 패널 */}
            <div
                className={`z-40 absolute inset-x-0 bottom-0 bg-white dark:bg-[#1a241b] rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-all duration-300 ease-out flex flex-col ${getPanelHeightClass()}`}
            >
                <div
                    className="w-full flex justify-center pt-3 pb-1 cursor-pointer touch-none active:bg-gray-50 dark:active:bg-gray-800 transition-colors rounded-t-3xl"
                    onClick={() =>
                        setPanelState((prev) =>
                            prev === "expanded" ? "default" : prev === "default" ? "minimized" : "default"
                        )
                    }
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-2" />
                </div>

                {!selectedPlace && (
                    <div className="px-4 pb-3 pt-1 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-2">
                        <div
                            className={`flex-1 min-w-0 ${
                                activeTab === "courses" && selectedCourseForRoute ? "cursor-pointer" : ""
                            }`}
                            role={activeTab === "courses" && selectedCourseForRoute ? "button" : undefined}
                            onClick={
                                activeTab === "courses" && selectedCourseForRoute
                                    ? () => handleCourseClick(selectedCourseForRoute)
                                    : undefined
                            }
                        >
                            <TapFeedback className="block w-full">
                                <h2 className="font-bold text-lg text-gray-900 dark:text-white leading-tight flex items-center gap-1.5">
                                    {activeTab === "places" ? (
                                        <>
                                            내 주변 장소
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="20"
                                                height="20"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="text-orange-500 dark:text-orange-400 shrink-0"
                                            >
                                                <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />
                                            </svg>
                                        </>
                                    ) : selectedCourseForRoute ? (
                                        <>
                                            <span className="line-clamp-1">{selectedCourseForRoute.title}</span>
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="18"
                                                height="18"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                className="text-emerald-500 dark:text-emerald-400 shrink-0"
                                            >
                                                <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                            </svg>
                                        </>
                                    ) : (
                                        <>
                                            추천 데이트 코스
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="20"
                                                height="20"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="text-rose-500 dark:text-rose-400 shrink-0"
                                            >
                                                <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
                                            </svg>
                                        </>
                                    )}
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                    {activeTab === "places"
                                        ? `지도에 ${places.length}개의 장소가 있어요`
                                        : selectedCourseForRoute
                                        ? selectedCourseForRoute.description || "코스에 포함된 장소예요"
                                        : "엄선된 코스를 확인해보세요"}
                                </p>
                            </TapFeedback>
                        </div>
                        {activeTab === "courses" && selectedCourseForRoute && (
                            <TapFeedback>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedCourseForRoute(null);
                                        setCourseRoutePath([]);
                                        setCoursePlacesList([]);
                                    }}
                                    className="shrink-0 w-12 h-12 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                                    aria-label="뒤로 가기"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="w-7 h-7"
                                    >
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            </TapFeedback>
                        )}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1a241b] scrollbar-hide">
                    {loading ? (
                        <LoadingSpinner text="정보를 불러오고 있어요..." />
                    ) : activeTab === "courses" && selectedCourseForRoute && coursePlacesLoading ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <LoadingSpinner text="장소 불러오는 중..." />
                        </div>
                    ) : selectedPlace ? (
                        <div className="px-5 pt-0 animate-fadeIn">
                            {/* 상세 정보 뷰 (생략 없이 유지) */}
                            <div className="flex justify-between items-start mb-2 mt-1">
                                <span className="inline-block px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full border border-emerald-100 dark:border-emerald-800/50">
                                    {selectedPlace.category || "추천 장소"}
                                </span>
                                <button
                                    onClick={() => setSelectedPlace(null)}
                                    className="p-2 -mr-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="w-6 h-6"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </button>
                            </div>
                            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-1 leading-tight tracking-tight">
                                {selectedPlace.name}
                            </h2>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex items-start gap-1">
                                <span className="leading-snug">{selectedPlace.address}</span>
                            </div>
                            {/* ✅ 수정된 버튼 영역 (안전장치 추가됨) */}
                            <div className="flex gap-2.5 mb-6 h-11">
                                {/* 1. 전화하기 버튼 (작은 아이콘) */}
                                <button
                                    onClick={() =>
                                        selectedPlace?.phone
                                            ? (window.location.href = `tel:${selectedPlace.phone}`)
                                            : showToast("전화번호 정보가 없어요 🥲")
                                    }
                                    className="w-11 h-full flex items-center justify-center bg-white dark:bg-[#1a241b] text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg hover:text-emerald-500 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 active:scale-95 transition-all"
                                    aria-label="전화하기"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="w-5 h-5"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </button>

                                {/* 2. 길찾기 버튼 (메인 강조) */}
                                <button
                                    type="button"
                                    onClick={() => handleFindWay(selectedPlace)}
                                    className="flex-1 h-full flex items-center justify-center gap-1.5 bg-[#6bb88a] dark:bg-[#6bb88a] text-white rounded-lg font-semibold text-sm shadow-sm hover:opacity-90 active:scale-95 transition-all"
                                >
                                    <span>길찾기</span>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="w-4 h-4"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="px-5 pb-20 pt-1">
                            {(activeTab === "places" ? places : selectedCourseForRoute ? coursePlacesList : courses)
                                .length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center opacity-60">
                                    <div className="text-4xl mb-2">🤔</div>
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                                        {activeTab === "courses" && selectedCourseForRoute
                                            ? "이 코스에 등록된 장소가 없어요."
                                            : "이 근처에는 아직 정보가 없어요."}
                                        <br />
                                        {activeTab === "courses" && selectedCourseForRoute
                                            ? ""
                                            : "지도를 조금만 이동해볼까요?"}
                                    </p>
                                </div>
                            ) : (
                                (activeTab === "places"
                                    ? places
                                    : selectedCourseForRoute
                                    ? coursePlacesList
                                    : courses
                                ).map((item: any) => {
                                    const isCourse = "title" in item && typeof item.title === "string";
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => {
                                                if (activeTab === "courses" && !selectedCourseForRoute)
                                                    handleCourseSelectForRoute(item);
                                                else handlePlaceClick(item);
                                            }}
                                            className={`group bg-white dark:bg-[#1a241b] px-4 py-2.5 mb-2 rounded-2xl border shadow-sm cursor-pointer flex items-stretch gap-3 transition-all duration-150 hover:bg-gray-50/80 dark:hover:bg-gray-800/30 hover:border-emerald-200 dark:hover:border-emerald-700/50 active:scale-[0.98] active:bg-gray-100/80 dark:active:bg-gray-800/50 ${
                                                isCourse && selectedCourseForRoute?.id === item.id
                                                    ? "border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-200 dark:ring-emerald-800/50"
                                                    : "border-gray-100 dark:border-gray-800"
                                            }`}
                                        >
                                            <PlaceListIconBox
                                                iconKey={
                                                    isCourse ? "play" : getCategoryIconKey(item.category || item.name)
                                                }
                                            />
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span
                                                        className={`text-xs font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                                                            isCourse
                                                                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/50"
                                                                : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50"
                                                        }`}
                                                    >
                                                        {isCourse ? "추천 코스" : item.category || "장소"}
                                                    </span>
                                                    {isCourse && selectedCourseForRoute?.id === item.id && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCourseClick(item);
                                                            }}
                                                            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                                                        >
                                                            상세 보기
                                                        </button>
                                                    )}
                                                </div>
                                                <h4 className="text-sm font-semibold text-gray-800 dark:text-white leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                                    {item.name || item.title}
                                                </h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                                                    {isCourse ? item.description : item.address}
                                                </p>
                                            </div>
                                            <div className="w-8 h-8 shrink-0 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors self-center">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="currentColor"
                                                    className="w-5 h-5"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M12.97 3.97a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06l6.22-6.22H3a.75.75 0 010-1.5h16.19l-6.22-6.22a.75.75 0 010-1.06z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
            {/* 🟢 [IN-APP PURCHASE]: 모바일 앱에서만 표시 (TicketPlans 컴포넌트 내부에서도 체크) */}
            {showSubscriptionModal && <TicketPlans onClose={() => setShowSubscriptionModal(false)} />}
            {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} next={`/map`} />}
        </div>
    );
}

export default function MapPage() {
    return (
        <Suspense
            fallback={
                <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f1710]">
                    <LoadingSpinner />
                </div>
            }
        >
            <MapPageInner />
        </Suspense>
    );
}
