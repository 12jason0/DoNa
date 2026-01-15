"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Container as MapDiv, NaverMap, Marker } from "react-naver-maps";
import TicketPlans from "@/components/TicketPlans";
import LoginModal from "@/components/LoginModal";
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

// --- 1. 아이콘 디자인 (유지) ---
function createReactNaverMapIcon(category: string, isSelected: boolean = false, source: "kakao" | "db" = "kakao") {
    const cat = category?.toLowerCase() || "";
    let color = "#10B981"; // 기본 초록색
    let icon = "📍";

    if (cat.includes("카페") || cat.includes("cafe") || cat.includes("커피")) {
        color = "#EA580C"; // 주황색 (이미지 참조)
        icon = "☕";
    } else if (cat.includes("음식") || cat.includes("식당") || cat.includes("맛집")) {
        color = "#059669"; // 짙은 초록색
        icon = "🍽️";
    } else if (cat.includes("관광") || cat.includes("명소")) {
        color = "#7C3AED"; // 보라색
        icon = "📷";
    }

    // 🟢 변경점 1: 전체적인 크기를 줄였습니다 (기존 42/52 -> 34/42)
    const baseSize = isSelected ? 42 : 34;
    // 아이콘 크기도 비율에 맞게 조정
    const iconSize = isSelected ? 22 : 18;
    const zIndexStyle = isSelected ? 999 : source === "db" ? 500 : 100;

    return {
        content: `
            <div style="
                width: ${baseSize}px; height: ${baseSize}px;
                position: relative;
                z-index: ${zIndexStyle};
                /* 🟢 변경점 2: 그림자를 더 부드럽고 깔끔하게 변경 */
                filter: drop-shadow(0 3px 6px rgba(0,0,0,0.15));
                transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                ${isSelected ? "transform: scale(1.15);" : ""}
            ">
                <div style="
                    width: 100%; height: 100%;
                    background: ${color};
                    /* 🟢 변경점 3: 흰색 테두리를 조금 더 얇게 조정 (3px -> 2.5px) */
                    border: 2.5px solid white;
                    /* 🟢 변경점 4: 물방울 모양 속성 제거 -> 완전한 원으로 변경 */
                    border-radius: 50%;
                    /* transform: rotate(-45deg);  <- 삭제됨 */
                    display: flex; align-items: center; justify-content: center;
                    box-sizing: border-box; /* 테두리가 크기 내부에 포함되도록 설정 */
                ">
                    <div style="
                        /* transform: rotate(45deg); <- 삭제됨 */
                        font-size: ${iconSize}px;
                        line-height: 1;
                        color: white;
                        /* 이모지 수직 중앙 정렬 보정 */
                        padding-top: 2px;
                    ">
                        ${icon}
                    </div>
                </div>
            </div>
        `,
        size: { width: baseSize, height: baseSize },
        // 🟢 변경점 5: 중심점(Anchor)을 원의 정중앙으로 이동
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

    const { isAuthenticated } = useAuth();

    // 🟢 사용자 등급 미리 로드 (캐싱)
    useEffect(() => {
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
        fetchUserTier();
    }, [isAuthenticated]);
    const dragStartY = useRef<number>(0);
    const fetchAbortRef = useRef<AbortController | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2000);
    };

    // 🟢 코스 클릭 시 권한 체크 후 모달 표시 또는 이동 (속도 최적화)
    const handleCourseClick = async (course: any) => {
        // 🟢 "c-" 접두사 제거
        const cleanId = course.id.startsWith("c-") ? course.id.replace("c-", "") : course.id;

        // 🟢 iOS/Android 플랫폼 체크
        const userAgent = typeof window !== "undefined" ? navigator.userAgent.toLowerCase() : "";
        const isMobilePlatform = /iphone|ipad|ipod|android/.test(userAgent);

        // 🟢 1. 코스 등급 확인 (캐싱된 값 우선 사용)
        let courseGrade: string = "FREE";
        if (course.grade) {
            courseGrade = (course.grade || "FREE").toUpperCase();
        } else {
            // grade 정보가 없으면 API 호출 (타임아웃 1초)
            try {
                const { apiFetch } = await import("@/lib/authClient");
                const result = await Promise.race([
                    apiFetch<any>(`/api/courses/${cleanId}`),
                    new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000)),
                ]);
                courseGrade = (result?.data?.grade || "FREE").toUpperCase();
            } catch (error) {
                // API 호출 실패 시 기본값 FREE로 처리
                courseGrade = "FREE";
            }
        }

        // 🟢 2. FREE 코스는 모든 유저 접근 가능
        if (courseGrade === "FREE") {
            router.push(`/courses/${cleanId}`);
            return;
        }

        // 🟢 3. 유료 코스 (BASIC, PREMIUM)
        // 🟢 3-1. 비로그인 유저 → 로그인 모달 (즉시 표시)
        if (!isAuthenticated) {
            setShowLoginModal(true);
            return;
        }

        // 🟢 3-2. 로그인 유저 → 사용자 등급 확인 (캐싱된 값 우선 사용)
        let currentUserTier: string = userTier.toUpperCase(); // 캐싱된 값 먼저 사용
        try {
            // 타임아웃 0.8초로 빠른 응답 보장
            const data = await Promise.race([
                authenticatedFetch<{ user?: { subscriptionTier?: string } }>("/api/users/profile"),
                new Promise<{ user?: { subscriptionTier?: string } }>((_, reject) =>
                    setTimeout(() => reject(new Error("Timeout")), 800)
                ),
            ]);
            currentUserTier = (data?.user?.subscriptionTier || "FREE").toUpperCase();
        } catch {
            // API 호출 실패 시 캐싱된 userTier 사용 (이미 설정됨)
        }

        // 🟢 3-3. PREMIUM 유저는 모든 코스 접근 가능
        if (currentUserTier === "PREMIUM") {
            router.push(`/courses/${cleanId}`);
            return;
        }

        // 🟢 3-4. BASIC 유저
        if (currentUserTier === "BASIC") {
            if (courseGrade === "BASIC") {
                // BASIC 유저 + BASIC 코스 → 접근 가능
                router.push(`/courses/${cleanId}`);
                return;
            } else if (courseGrade === "PREMIUM") {
                // BASIC 유저 + PREMIUM 코스 → TicketPlans
                // 🟢 [iOS/Android]: iOS/Android에서는 결제 모달 표시 안함
                if (!isMobilePlatform) {
                    setShowSubscriptionModal(true);
                }
                return;
            }
        }

        // 🟢 3-5. FREE 유저 (BASIC, PREMIUM 코스) → TicketPlans
        // 🟢 [iOS/Android 출시 기념 이벤트]: iOS/Android에서는 위에서 이미 Basic 코스 처리 완료
        // 🟢 [iOS/Android]: iOS/Android에서는 결제 모달 표시 안함
        if (!isMobilePlatform) {
            setShowSubscriptionModal(true);
        }
    };

    const handleFindWay = (placeName: string) => {
        setToastMessage("네이버 지도로 연결합니다 🚀");
        setTimeout(() => {
            const query = encodeURIComponent(placeName);
            window.open(`https://map.naver.com/p/search/${query}`, "_blank");
            setToastMessage(null);
        }, 700);
    };

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
                setPlaces(Array.from(uniquePlaces.values()));
                setCourses(Array.from(uniqueCourses.values()));

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
        []
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

    // 초기 로드 시 자동 데이터 로드는 제거 - "현 지도 검색" 버튼을 클릭해야만 데이터 로드
    // useEffect(() => {
    //     if (mapsReady) {
    //         fetchAllData(center);
    //     }
    // }, [mapsReady]);

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
        <div className="relative w-full h-full overflow-hidden bg-gray-100 dark:bg-[#0f1710] font-sans touch-none">
            {/* 상단 검색창 */}
            <div className="absolute top-0 left-0 right-0 z-30 flex flex-col p-4 bg-linear-to-b from-white/90 via-white/60 to-transparent dark:from-[#1a241b]/90 dark:via-[#1a241b]/60 dark:to-transparent pointer-events-none">
                <div className="flex items-center bg-white dark:bg-[#1a241b] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-100 dark:border-gray-800 p-3 pointer-events-auto mb-3">
                    <div className="pl-1 pr-3 text-emerald-500 dark:text-emerald-400">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="w-6 h-6"
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
                        className="flex-1 bg-transparent focus:outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-base font-medium"
                    />
                </div>

                <div className="flex items-center justify-between pointer-events-auto pl-1 w-full max-w-md mx-auto">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                        <button
                            onClick={() => {
                                setActiveTab("places");
                                setSelectedPlace(null);
                                setPanelState("default");
                            }}
                            className={`px-4 py-2 rounded-full text-sm font-bold shadow-sm border transition-all ${
                                activeTab === "places"
                                    ? "bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-600 dark:border-emerald-700 shadow-md"
                                    : "bg-white dark:bg-[#1a241b] text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                            }`}
                        >
                            주변 장소
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab("courses");
                                setPanelState("default");
                            }}
                            className={`px-4 py-2 rounded-full text-sm font-bold shadow-sm border transition-all ${
                                activeTab === "courses"
                                    ? "bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-600 dark:border-emerald-700 shadow-md"
                                    : "bg-white dark:bg-[#1a241b] text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                            }`}
                        >
                            추천 코스
                        </button>
                    </div>
                    <button
                        onClick={handleMapSearch}
                        className="flex items-center gap-1 px-3 py-2 rounded-full text-xs font-bold shadow-sm border border-emerald-500 dark:border-emerald-600 bg-white dark:bg-[#1a241b] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all ml-2 whitespace-nowrap"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-4 h-4"
                        >
                            <path
                                fillRule="evenodd"
                                d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z"
                                clipRule="evenodd"
                            />
                        </svg>
                        현 지도 검색
                    </button>
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

                        {(selectedPlace ? [selectedPlace] : places)
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
                    <div className="px-6 pb-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-end">
                        <div>
                            <h2 className="font-bold text-xl text-gray-900 dark:text-white leading-tight">
                                {activeTab === "places" ? "내 주변 장소 🔥" : "추천 데이트 코스 ❤️"}
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {activeTab === "places"
                                    ? `지도에 ${places.length}개의 장소가 있어요`
                                    : `엄선된 코스를 확인해보세요`}
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1a241b] scrollbar-hide">
                    {loading ? (
                        <LoadingSpinner text="정보를 불러오고 있어요..." />
                    ) : selectedPlace ? (
                        <div className="px-5 pb-8 pt-0 animate-fadeIn">
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
                            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1 leading-tight tracking-tight">
                                {selectedPlace.name}
                            </h2>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex items-start gap-1">
                                <span className="leading-snug">{selectedPlace.address}</span>
                            </div>
                            {/* ✅ 수정된 버튼 영역 (안전장치 추가됨) */}
                            <div className="flex gap-3 mb-6 h-14">
                                {/* 1. 전화하기 버튼 (작은 아이콘) */}
                                <button
                                    onClick={() =>
                                        selectedPlace?.phone
                                            ? (window.location.href = `tel:${selectedPlace.phone}`)
                                            : showToast("전화번호 정보가 없어요 🥲")
                                    }
                                    className="w-14 h-full flex items-center justify-center bg-white dark:bg-[#1a241b] text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 rounded-xl hover:text-emerald-500 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 active:scale-95 transition-all"
                                    aria-label="전화하기"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="w-6 h-6"
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
                                    onClick={() => handleFindWay(selectedPlace?.name || "")}
                                    className="flex-1 h-full flex items-center justify-center gap-2 bg-emerald-500 text-white rounded-xl font-bold shadow-md hover:bg-emerald-600 active:scale-95 transition-all"
                                >
                                    <span className="text-lg">길찾기</span>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="w-5 h-5"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </button>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                                <h4 className="font-bold text-gray-800 dark:text-white mb-2 text-sm">💡 장소 설명</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                    {selectedPlace.description || "이곳은 많은 사람들이 찾는 인기 장소입니다."}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="px-5 pb-20 pt-1">
                            {(activeTab === "places" ? places : courses).length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center opacity-60">
                                    <div className="text-4xl mb-2">🤔</div>
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                                        이 근처에는 아직 정보가 없어요.
                                        <br />
                                        지도를 조금만 이동해볼까요?
                                    </p>
                                </div>
                            ) : (
                                (activeTab === "places" ? places : courses).map((item: any) => (
                                    // ✅ 여기도 key가 중복되면 에러가 납니다. c-*, k-*, db-*로 처리되어 안전합니다.
                                    <div
                                        key={item.id}
                                        onClick={() => {
                                            activeTab === "courses" ? handleCourseClick(item) : handlePlaceClick(item);
                                        }}
                                        className="group bg-white dark:bg-[#1a241b] p-4 mb-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm active:scale-[0.98] transition-all cursor-pointer hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span
                                                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                                                            activeTab === "courses"
                                                                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/50"
                                                                : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50"
                                                        }`}
                                                    >
                                                        {activeTab === "courses"
                                                            ? "추천 코스"
                                                            : item.category || "장소"}
                                                    </span>
                                                </div>
                                                <h4 className="text-lg font-bold text-gray-800 dark:text-white leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                                    {item.name || item.title}
                                                </h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                                                    {activeTab === "courses" ? item.description : item.address}
                                                </p>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors ml-2">
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
                                    </div>
                                ))
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
