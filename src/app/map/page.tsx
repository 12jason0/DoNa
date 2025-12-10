"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
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

// [수정됨] BoundsBox 타입을 최상단으로 이동
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
    const numberSize = isSelected ? 13 : 11;
    const numberBox = isSelected ? 24 : 20;

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
                ${
                    orderIndex
                        ? `<div style="
                        position: absolute; top: -6px; right: -6px; background: ${color};
                        border: 2px solid white; border-radius: 50%;
                        min-width: 20px; height: 20px; padding: 0 4px;
                        display: flex; align-items: center; justify-content: center;
                        font-size: 11px; font-weight: bold; color: white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    ">${orderIndex}</div>`
                        : ""
                }
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
    // [수정] navermaps 객체 안전하게 가져오기
    const navermaps =
        typeof window !== "undefined" && (window as any).naver && (window as any).naver.maps
            ? (window as any).naver.maps
            : null;
    const mapRef = useRef<any>(null);
    const suppressSearchButtonRef = useRef<boolean>(false);

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

        // [중요 수정] ncpClientId -> ncpKeyId 로 변경
        // script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
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

        // 인증 실패 시 처리
        (window as any).navermap_authFailure = function () {
            console.error("네이버 지도 인증 실패: Client ID를 확인해주세요.");
        };

        document.head.appendChild(script);
    }, []);

    // [중요] 스크롤 방지 및 모바일 화면 높이 보정 (100dvh)
    useEffect(() => {
        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.width = "100%";
        document.body.style.height = "100%";
        return () => {
            document.body.style.overflow = "";
            document.body.style.position = "";
            document.body.style.width = "";
            document.body.style.height = "";
        };
    }, []);

    // --- 상태 관리 ---
    const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 37.5665, lng: 126.978 });
    const [zoom, setZoom] = useState(15);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [places, setPlaces] = useState<Place[]>([]);
    const [viewBounds, setViewBounds] = useState<BoundsBox | null>(null);
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [searchInput, setSearchInput] = useState("");
    const [activeTab, setActiveTab] = useState<"places" | "courses">("places");
    const [loading, setLoading] = useState(true);
    const [panelState, setPanelState] = useState<"minimized" | "default" | "expanded">("default");
    const [showMapSearchButton, setShowMapSearchButton] = useState(false);

    const dragStartY = useRef<number>(0);
    const fetchAbortRef = useRef<AbortController | null>(null);

    const triggerMapResize = useCallback(() => {
        try {
            if (navermaps && mapRef.current) navermaps.Event.trigger(mapRef.current, "resize");
            else window.dispatchEvent(new Event("resize"));
        } catch {}
    }, [navermaps]);

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

    // --- 데이터 fetching ---
    type FetchOptions = { bounds?: BoundsBox; skipCourses?: boolean; limit?: number; injectPlace?: Place };

    const fetchPlacesAndCourses = useCallback(
        async (location: { lat: number; lng: number }, keyword?: string, opts?: FetchOptions) => {
            setLoading(true);

            try {
                try {
                    fetchAbortRef.current?.abort();
                } catch {}
                const aborter = new AbortController();
                fetchAbortRef.current = aborter;

                let placesUrl = `/api/places/search-kakao?lat=${location.lat}&lng=${location.lng}`;
                if (keyword && keyword.trim()) placesUrl += `&keyword=${encodeURIComponent(keyword)}`;
                if (opts?.bounds) {
                    const radius = 2000;
                    placesUrl += `&radius=${radius}`;
                }

                const keywordParam = keyword && keyword.trim() ? `&keyword=${encodeURIComponent(keyword.trim())}` : "";

                const placesRes = await fetch(placesUrl, { signal: aborter.signal });
                let fetchedPlaces: Place[] = [];
                if (placesRes.ok) {
                    const data = await placesRes.json();
                    if (data.success) {
                        fetchedPlaces = data.places.map((p: any) => ({
                            ...p,
                            latitude: parseFloat(p.latitude),
                            longitude: parseFloat(p.longitude),
                        }));
                    }
                }

                let fetchedCourses: Course[] = [];
                if (!opts?.skipCourses) {
                    try {
                        const coursesRes = await fetch(
                            `/api/courses/nearby?lat=${location.lat}&lng=${location.lng}${keywordParam}`,
                            { signal: aborter.signal }
                        );
                        const cData = await coursesRes.json();
                        if (cData.success) fetchedCourses = cData.courses;
                    } catch {}
                }

                setPlaces(fetchedPlaces);
                setCourses(fetchedCourses);

                if (keyword && fetchedCourses.length > 0) setActiveTab("courses");
            } catch (e: any) {
                if (e?.name !== "AbortError") console.error(e);
            } finally {
                setLoading(false);
            }
        },
        []
    );

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

                await fetchPlacesAndCourses(loc, searchInput, { limit: 50 });
                setPanelState("default");
                setShowMapSearchButton(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [searchInput, fetchPlacesAndCourses]);

    const handleMapSearch = () => {
        fetchPlacesAndCourses(center, undefined, { limit: 50 });
        setShowMapSearchButton(false);
        setPanelState("default");
    };

    useEffect(() => {
        if (!mapsReady) return;
        (async () => {
            try {
                const loc = await getQuickLocation();
                setUserLocation(loc);
                setCenter(loc);
                fetchPlacesAndCourses(loc, undefined, { limit: 50 });
            } catch {}
        })();
    }, [mapsReady]);

    const getQuickLocation = () =>
        new Promise<{ lat: number; lng: number }>((resolve, reject) => {
            if (!navigator.geolocation) return reject();
            navigator.geolocation.getCurrentPosition(
                (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
                reject
            );
        });

    const handlePlaceClick = (place: Place) => {
        setSelectedPlace(place);
        setCenter({ lat: place.latitude, lng: place.longitude });
        setZoom(17);
        setActiveTab("places");
        setPanelState("default");
    };

    const formatDistance = (p: Place) => {
        if (!userLocation) return "";
        return "350m";
    };

    useEffect(() => {
        if (!navermaps || !mapRef.current) return;
        const map = mapRef.current;

        // [수정] 이벤트 리스너 추가 시 map 객체가 유효한지 재확인
        if (!map) return;

        const clickListener = navermaps.Event.addListener(map, "click", () => {
            if (selectedPlace) {
                setSelectedPlace(null);
                setPanelState("default");
            } else setPanelState("default");
        });
        const dragStartListener = navermaps.Event.addListener(map, "dragstart", () => setShowMapSearchButton(true));

        return () => {
            try {
                navermaps.Event.removeListener(clickListener);
                navermaps.Event.removeListener(dragStartListener);
            } catch {}
        };
    }, [navermaps, selectedPlace]);

    const getPanelHeightClass = () => {
        if (panelState === "expanded") return "h-[90vh]";
        if (panelState === "minimized") return "h-[120px]";
        return "h-[50vh]";
    };

    // [중요 수정] mapsReady가 true여도 navermaps 객체가 없으면 로딩 표시
    if (!mapsReady || !navermaps)
        return (
            <div className="h-screen flex items-center justify-center">
                <LoadingSpinner />
            </div>
        );

    return (
        <div className="relative w-full h-[100dvh] overflow-hidden bg-gray-100">
            {/* 1. 상단 검색창 + 탭 */}
            <div className="absolute top-0 left-0 right-0 z-50 flex flex-col p-4 bg-gradient-to-b from-white/90 via-white/50 to-transparent pointer-events-none">
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

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pointer-events-auto pl-1 pb-2">
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
                    <button
                        onClick={handleMapSearch}
                        className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold shadow-md border border-emerald-500 bg-white text-emerald-600 whitespace-nowrap hover:bg-emerald-50 active:scale-95 transition-transform"
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

            {/* 2. 지도 */}
            <div className="absolute inset-0 z-0 w-full h-full">
                <MapDiv style={{ width: "100%", height: "100%" }}>
                    <NaverMap
                        ref={mapRef}
                        center={new navermaps.LatLng(center.lat, center.lng)}
                        zoom={zoom}
                        onCenterChanged={(c) => {
                            setCenter({ lat: c.y, lng: c.x });
                        }}
                    >
                        {userLocation && (
                            <Marker
                                position={new navermaps.LatLng(userLocation.lat, userLocation.lng)}
                                icon={{
                                    content: `<div style="width:18px;height:18px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.3);"></div>`,
                                }}
                            />
                        )}
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
            </div>

            {/* 3. 하단 패널 */}
            <div
                className={`z-40 absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-[0_-5px_20px_rgba(0,0,0,0.2)] transition-all duration-300 ease-out flex flex-col ${getPanelHeightClass()}`}
            >
                <div
                    className="w-full flex justify-center pt-3 pb-2 cursor-pointer touch-none"
                    onClick={() => setPanelState((p) => (p === "expanded" ? "default" : "expanded"))}
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
                                    selectedPlace.phone && (window.location.href = `tel:${selectedPlace.phone}`)
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
                                    else {
                                        handlePlaceClick(item);
                                    }
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
