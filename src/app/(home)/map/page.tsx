"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Container as MapDiv, NaverMap, Marker } from "react-naver-maps";

// --- 타입 정의 ---
interface Place {
    id: number | string;
    name: string;
    category: string;
    distance?: string;
    address: string;
    description?: string;
    rating?: number;
    phone?: string;
    website?: string;
    imageUrl?: string;
    latitude: number;
    longitude: number;
    courseId?: number;
}

interface Course {
    id: number;
    title: string;
    description: string;
    distance: number;
    start_place_name?: string;
}

type BoundsBox = {
    sw: { lat: number; lng: number };
    ne: { lat: number; lng: number };
};

// --- 클래식 핀 마커 (Green 테마) ---
function createReactNaverMapIcon(category: string, orderIndex?: number, isSelected: boolean = false) {
    const cat = category?.toLowerCase() || "";
    let color = "#10B981"; // 기본 Emerald
    let icon = "📍";

    if (cat.includes("카페") || cat.includes("cafe")) {
        color = "#059669";
        icon = "☕";
    } else if (cat.includes("음식") || cat.includes("식당") || cat.includes("맛집")) {
        color = "#EA580C"; // Orange
        icon = "🍽️";
    } else if (cat.includes("관광") || cat.includes("명소")) {
        color = "#0D9488"; // Teal
        icon = "📷";
    }

    const width = isSelected ? 44 : 36;
    const height = isSelected ? 54 : 46;
    const iconSize = isSelected ? 22 : 18;

    return {
        content: `
            <div style="position: relative; width: ${width}px; height: ${height}px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.25)); transition: all 0.2s;">
                <div style="
                    width: ${width}px; height: ${width}px; background: ${color};
                    border: 3px solid white; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: ${iconSize}px; z-index: 10;
                ">${icon}</div>
                <div style="
                    position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
                    width: 0; height: 0; border-left: 8px solid transparent;
                    border-right: 8px solid transparent; border-top: 12px solid ${color};
                "></div>
            </div>
        `,
        size: { width, height },
        anchor: { x: width / 2, y: height },
    };
}

// --- 로딩 스피너 ---
const LoadingSpinner = ({ text = "로딩 중..." }: { text?: string }) => (
    <div className="flex flex-col justify-center items-center h-full gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-emerald-100 border-t-emerald-600" />
        <p className="text-sm text-gray-500 font-medium">{text}</p>
    </div>
);

// --- 메인 지도 페이지 ---
function MapPageInner() {
    const router = useRouter();
    const [mapsReady, setMapsReady] = useState(false);
    const navermaps =
        typeof window !== "undefined" && (window as any).naver && (window as any).naver.maps
            ? (window as any).naver.maps
            : null;
    const mapRef = useRef<any>(null);

    // --- 상태 관리 ---
    const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 37.5665, lng: 126.978 }); // 서울시청 기본
    const [zoom, setZoom] = useState(15);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [places, setPlaces] = useState<Place[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [searchInput, setSearchInput] = useState("");
    const [activeTab, setActiveTab] = useState<"places" | "courses">("places");
    const [loading, setLoading] = useState(false); // 초기 로딩 상태 조정
    const [panelState, setPanelState] = useState<"minimized" | "default" | "expanded">("default");
    const [showMapSearchButton, setShowMapSearchButton] = useState(false);

    const dragStartY = useRef<number>(0);
    const fetchAbortRef = useRef<AbortController | null>(null);

    // 네이버 지도 SDK 로드
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

    // 스크롤 방지
    useEffect(() => {
        document.documentElement.style.setProperty("overflow", "hidden", "important");
        document.body.style.setProperty("overflow", "hidden", "important");
        document.body.style.setProperty("position", "fixed", "important");
        document.body.style.setProperty("width", "100%", "important");
        document.body.style.setProperty("height", "100%", "important");
        document.body.style.setProperty("touch-action", "none", "important");
        return () => {
            document.documentElement.style.overflow = "";
            document.body.style.overflow = "";
            document.body.style.position = "";
            document.body.style.width = "";
            document.body.style.height = "";
            document.body.style.touchAction = "";
        };
    }, []);

    // 데이터 Fetching
    const fetchPlacesAndCourses = useCallback(async (location: { lat: number; lng: number }, keyword?: string) => {
        setLoading(true);
        try {
            try {
                fetchAbortRef.current?.abort();
            } catch {}
            const aborter = new AbortController();
            fetchAbortRef.current = aborter;

            // 카카오 검색 API 사용
            let placesUrl = `/api/places/search-kakao?lat=${location.lat}&lng=${location.lng}`;
            if (keyword && keyword.trim()) placesUrl += `&keyword=${encodeURIComponent(keyword)}`;

            const res = await fetch(placesUrl, { signal: aborter.signal });
            let fetchedPlaces: Place[] = [];
            let fetchedCourses: Course[] = [];

            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    fetchedPlaces = data.places.map((p: any) => ({
                        ...p,
                        id: p.id,
                        latitude: parseFloat(p.latitude),
                        longitude: parseFloat(p.longitude),
                    }));
                    if (Array.isArray(data.relatedCourses)) {
                        fetchedCourses = data.relatedCourses.map((c: any) => ({
                            id: c.id,
                            title: c.title,
                            description: c.description || "",
                            distance: 0,
                            start_place_name: c.region || "",
                        }));
                    }
                }
            }
            setPlaces(fetchedPlaces);
            setCourses(fetchedCourses);
            if (keyword && fetchedCourses.length > 0) setActiveTab("courses");
        } catch (e: any) {
            if (e?.name !== "AbortError") console.error("Fetch error:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    // [중요] 내 위치 찾기 및 주변 검색 실행
    const moveToCurrentLocation = useCallback(async () => {
        if (!navigator.geolocation) {
            alert("위치 정보를 사용할 수 없습니다.");
            return;
        }
        setLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (p) => {
                console.log("위치 찾기 성공:", p.coords); // 성공 로그
                const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
                setUserLocation(loc);
                setCenter(loc);
                setZoom(16);
                await fetchPlacesAndCourses(loc, undefined);
                setLoading(false);
            },
            (err) => {
                // [수정] 에러 상세 분석
                let errMsg = "";
                switch (err.code) {
                    case 1:
                        errMsg = "권한 거부됨 (브라우저 설정 확인)";
                        break; // PERMISSION_DENIED
                    case 2:
                        errMsg = "위치 확인 불가 (GPS 신호 약함)";
                        break; // POSITION_UNAVAILABLE
                    case 3:
                        errMsg = "시간 초과 (Timeout)";
                        break; // TIMEOUT
                    default:
                        errMsg = "알 수 없는 오류";
                        break;
                }
                console.error(`위치 에러(${err.code}): ${err.message}`);
                alert(`위치를 가져올 수 없습니다: ${errMsg}`);

                setLoading(false);
                // 실패 시 기본 위치 유지
                fetchPlacesAndCourses(center, undefined);
            },
            // [수정] 타임아웃 10초로 증가
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
        );
    }, [fetchPlacesAndCourses, center]); // center 의존성 추가 (실패 시 사용)

    // [수정] 지도 준비되면 내 위치 찾기 실행 (무한 루프 방지 적용)
    useEffect(() => {
        if (mapsReady) {
            moveToCurrentLocation();
        }
        // 🚨 아래 주석이 있어야 무한 재실행을 막습니다!
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapsReady]);

    const handleSearch = useCallback(async () => {
        if (!searchInput.trim()) return;
        setLoading(true);
        setSelectedPlace(null);
        try {
            // 단일 장소 검색 (좌표 얻기용)
            const res = await fetch(`/api/places/search-single?query=${encodeURIComponent(searchInput)}`);
            const data = await res.json();
            if (data.success && data.place) {
                const loc = { lat: parseFloat(data.place.lat), lng: parseFloat(data.place.lng) };
                setCenter(loc);
                await fetchPlacesAndCourses(loc, searchInput);
                setPanelState("default");
                setShowMapSearchButton(false);
                setSearchInput(""); // [추가] 검색 완료 후 검색창 초기화
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [searchInput, fetchPlacesAndCourses]);

    const handleMapSearch = () => {
        fetchPlacesAndCourses(center, undefined);
        setShowMapSearchButton(false);
        setPanelState("default");
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
        } else if (Math.abs(diff) < 10) {
            setPanelState((prev) => (prev === "expanded" ? "default" : "expanded"));
        }
    };

    const getPanelHeightClass = () => {
        if (panelState === "expanded") return "h-[90vh]";
        if (panelState === "minimized") return "h-[120px]";
        return "h-[50vh]";
    };

    if (!mapsReady || !navermaps)
        return (
            <div className="h-screen flex items-center justify-center">
                <LoadingSpinner />
            </div>
        );
    // [추가] 리스트 아이템 클릭 핸들러
    const handlePlaceClick = (place: Place) => {
        setSelectedPlace(place);
        setCenter({ lat: place.latitude, lng: place.longitude });
        setZoom(17);
        setPanelState("default");
        setShowMapSearchButton(false);
    };

    return (
        <div className="relative w-full h-full overflow-hidden bg-gray-100">
            {/* 상단 검색창 */}
            <div className="absolute top-0 left-0 right-0 z-30 flex flex-col p-4 bg-gradient-to-b from-white/90 via-white/50 to-transparent pointer-events-none">
                <div className="flex items-center bg-white rounded-xl shadow-lg border border-gray-200 p-2 transition-all pointer-events-auto mb-3">
                    <div className="pl-2 pr-2 text-emerald-600">
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
                        className="flex-1 bg-transparent focus:outline-none text-gray-800 placeholder:text-gray-400 text-base"
                    />
                </div>
                {/* 탭 버튼들 */}
                <div className="flex items-center justify-between pointer-events-auto pl-1 pb-2 w-full max-w-md mx-auto">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => {
                                setActiveTab("places");
                                setSelectedPlace(null);
                                setPanelState("default");
                            }}
                            className={`px-4 py-2 rounded-full text-sm font-bold shadow-md border whitespace-nowrap transition-all ${
                                activeTab === "places"
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-white text-gray-600 border-gray-200"
                            }`}
                        >
                            주변 장소
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab("courses");
                                setPanelState("default");
                            }}
                            className={`px-4 py-2 rounded-full text-sm font-bold shadow-md border whitespace-nowrap transition-all ${
                                activeTab === "courses"
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-white text-gray-600 border-gray-200"
                            }`}
                        >
                            추천 코스
                        </button>
                    </div>
                    <button
                        onClick={handleMapSearch}
                        className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold shadow-md border border-emerald-500 bg-white text-emerald-600 whitespace-nowrap hover:bg-emerald-50 active:scale-95 transition-transform ml-2"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-4 h-4"
                        >
                            <path
                                fillRule="evenodd"
                                d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0v2.433l-.31-.31a7 7 0 0 0-11.712 3.138.75.75 0 0 0 1.449.39 5.5 5.5 0 0 1 9.201-2.466l.312.312h-2.433a.75.75 0 0 0 0 1.5h4.242Z"
                                clipRule="evenodd"
                            />
                        </svg>
                        현 지도 검색
                    </button>
                </div>
            </div>

            {/* 지도 */}
            <div className="absolute inset-0 z-0 w-full h-full">
                <MapDiv style={{ width: "100%", height: "100%" }}>
                    <NaverMap
                        ref={mapRef}
                        center={new navermaps.LatLng(center.lat, center.lng)}
                        zoom={zoom}
                        // [수정] 중괄호 { } 확인하세요
                        onCenterChanged={(c) => {
                            setCenter({ lat: c.y, lng: c.x });
                            setShowMapSearchButton(true);
                        }}
                        // [수정] 아래 주석을 onClick 바로 윗줄에 붙여넣으세요!
                        // @ts-ignore
                        onClick={() => {
                            if (selectedPlace || panelState !== "minimized") {
                                setSelectedPlace(null);
                                setPanelState("minimized");
                            }
                        }}
                    >
                        {/* [수정] 내 위치 마커 디자인 개선 */}
                        {userLocation && (
                            <Marker
                                position={new navermaps.LatLng(userLocation.lat, userLocation.lng)}
                                icon={{
                                    content: `
                                        <div style="position: relative;">
                                            <div style="position: absolute; width: 40px; height: 40px; background: rgba(59, 130, 246, 0.2); border-radius: 50%; top: -20px; left: -20px; animation: pulse 2s infinite;"></div>
                                            <div style="width: 16px; height: 16px; background: #3B82F6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transform: translate(-50%, -50%);"></div>
                                        </div>
                                        <style>
                                            @keyframes pulse {
                                                0% { transform: scale(0.5); opacity: 0; }
                                                50% { opacity: 0.5; }
                                                100% { transform: scale(1.5); opacity: 0; }
                                            }
                                        </style>
                                    `,
                                }}
                                zIndex={200}
                            />
                        )}

                        {/* 장소 마커들 */}
                        {(selectedPlace ? [selectedPlace] : places).map((place) => (
                            <Marker
                                key={place.id}
                                position={new navermaps.LatLng(place.latitude, place.longitude)}
                                icon={createReactNaverMapIcon(
                                    place.category,
                                    undefined,
                                    selectedPlace?.id === place.id
                                )}
                                onClick={() => {
                                    setSelectedPlace(place);
                                    setCenter({ lat: place.latitude, lng: place.longitude });
                                    setZoom(17);
                                    setPanelState("default");
                                }}
                                zIndex={selectedPlace?.id === place.id ? 100 : 10}
                            />
                        ))}
                    </NaverMap>
                </MapDiv>

                {/* [추가] 내 위치 찾기 버튼 */}
                <button
                    onClick={moveToCurrentLocation}
                    className="absolute bottom-32 right-5 z-20 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-50 active:scale-95 transition-all border border-gray-200"
                    aria-label="내 위치 찾기"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-6 h-6 text-blue-500"
                    >
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
                className={`z-40 absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-[0_-5px_20px_rgba(0,0,0,0.2)] transition-all duration-300 ease-out flex flex-col ${getPanelHeightClass()}`}
            >
                <div
                    className="w-full flex justify-center pt-3 pb-2 cursor-pointer touch-none active:bg-gray-50 transition-colors"
                    onClick={() =>
                        setPanelState((prev) =>
                            prev === "expanded" ? "default" : prev === "default" ? "minimized" : "default"
                        )
                    }
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
                </div>
                <div className="px-5 pb-3 border-b flex justify-between items-center bg-white">
                    <h2 className="font-bold text-lg text-gray-800">
                        {selectedPlace
                            ? selectedPlace.name
                            : activeTab === "places"
                            ? `주변 장소 ${places.length}`
                            : `추천 코스 ${courses.length}`}
                    </h2>
                    {selectedPlace && (
                        <button
                            onClick={() => setSelectedPlace(null)}
                            className="text-gray-500 text-xs border px-2 py-1 rounded"
                        >
                            목록 보기
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 pb-20">
                    {loading ? (
                        <LoadingSpinner />
                    ) : selectedPlace ? (
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-50">
                            <h3 className="text-xl font-bold mb-2">{selectedPlace.name}</h3>
                            <p className="text-gray-600 text-sm mb-4">{selectedPlace.address}</p>
                            <button
                                className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold"
                                onClick={() =>
                                    selectedPlace?.phone && (window.location.href = `tel:${selectedPlace.phone}`)
                                }
                            >
                                전화하기
                            </button>
                        </div>
                    ) : (
                        (activeTab === "places" ? places : courses).map((item: any) => (
                            <div
                                key={item.id}
                                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-3 cursor-pointer hover:bg-gray-50"
                                onClick={() => {
                                    if (activeTab === "courses") router.push(`/courses/${item.id}`);
                                    else handlePlaceClick(item);
                                }}
                            >
                                <h4 className="font-bold text-gray-800">{item.name || item.title}</h4>
                                <div className="text-xs text-gray-500 mt-1">{item.address || item.description}</div>
                                {activeTab === "courses" && (
                                    <div className="text-[10px] text-emerald-600 mt-2 font-bold">
                                        코스 상세 보기 &gt;
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default function MapPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <MapPageInner />
        </Suspense>
    );
}
