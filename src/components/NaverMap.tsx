"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { MapProps, Place } from "@/types/map";
import { MapMarker } from "./MapMarker";
import { useLocale } from "@/context/LocaleContext";

export default function NaverMapComponent({
    places,
    userLocation,
    selectedPlace,
    onPlaceClick,
    className = "",
    style = {},
    drawPath,
    routeMode = "walking",
    center,
    numberedMarkers,
    nearFallbackStorageKey,
    suppressNearFallback,
    onNearFallbackShown,
    showControls = true,
    showPlaceOverlay = true,
    pathCoordinates,
    pathPlaces,
    dottedPathSegments,
    pathStraightOnly,
    onBoundsChanged,
    onMapReady,
    currentStep,
    onNextStep,
    onMapClick,
}: MapProps) {
    const { t } = useLocale();
    const mapElementRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const polylineRef = useRef<any>(null);
    const dottedPolylinesRef = useRef<any[]>([]);
    const [mapReady, setMapReady] = useState(false);
    const [currentHeading, setCurrentHeading] = useState<number | null>(null);

    // 🟢 속성 이름 통일 함수
    const getCoords = (p: any) => ({
        lat: Number(p.latitude ?? p.lat),
        lng: Number(p.longitude ?? p.lng),
    });

    const isValidLatLng = (p: any) => {
        const { lat, lng } = getCoords(p);
        return Number.isFinite(lat) && Number.isFinite(lng);
    };

    const distanceMeters = (p1: any, p2: any) => {
        const c1 = getCoords(p1);
        const c2 = getCoords(p2);
        const R = 6371e3;
        const toRad = (v: number) => (v * Math.PI) / 180;
        const dLat = toRad(c2.lat - c1.lat);
        const dLng = toRad(c2.lng - c1.lng);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(c1.lat)) * Math.cos(toRad(c2.lat)) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // 🟢 [컴포넌트 언마운트 시 cleanup] - 페이지 이동 시 참조 차단
    useEffect(() => {
        return () => {
            // 페이지를 떠날 때 지도 로딩 상태를 강제로 false로 변경하여
            // 하위 마커들이 더 이상 naver 객체를 참조하지 않게 함
            setMapReady(false);
        };
    }, []);

    // 🟢 [기능 유지] 나침반 감지
    useEffect(() => {
        if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
        const handleOrientation = (event: DeviceOrientationEvent) => {
            if (event.alpha !== null) setCurrentHeading(event.alpha);
        };
        window.addEventListener("deviceorientation", handleOrientation);
        return () => window.removeEventListener("deviceorientation", handleOrientation);
    }, []);

    // 🟢 [기능 유지] 50m 도착 알림 및 자동 전환
    useEffect(() => {
        if (!userLocation || !places || !mapReady || typeof currentStep === "undefined" || !onNextStep) return;
        const targetPlace = places.find((p: any) => (p.orderIndex ?? p.order_index) === currentStep);
        if (!targetPlace) return;

        const dist = distanceMeters(userLocation, targetPlace);
        if (dist < 50) {
            if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
            onNextStep();
        }
    }, [userLocation, currentStep, places, mapReady]);

    const loadNaverMapsScript = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            if ((window as any).naver?.maps?.LatLng) return resolve();
            const script = document.createElement("script");
            script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}`;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // 🟢 [기능 유지] 지도 초기화 및 Passive 리스너 (Forced Reflow 방지)
    useEffect(() => {
        let isMounted = true;
        let canvasTimeout: ReturnType<typeof setTimeout> | null = null;

        (async () => {
            if (!(window as any).naver?.maps) await loadNaverMapsScript();
            if (!mapElementRef.current || !isMounted) return;

            // 🟢 [Fix]: 이미 지도가 초기화되어 있으면 재초기화하지 않음
            if (mapRef.current) {
                setMapReady(true);
                return;
            }

            // 1단계: window 및 전역 객체 존재 여부 통합 검증
            if (typeof window === "undefined" || !(window as any).naver || !(window as any).naver.maps) {
                console.warn("[NaverMap] Naver Maps SDK is not loaded.");
                return;
            }

            const naver = (window as any).naver;
            const startPos = center || (selectedPlace ? getCoords(selectedPlace) : { lat: 37.5665, lng: 126.978 });

            const mapElement = mapElementRef.current;

            // 🟢 [Fix] 지도 초기화 전에 passive: false 리스너를 먼저 등록하여 SDK의 preventDefault 허용
            // Naver Maps SDK가 등록하는 이벤트 리스너가 passive로 강제되지 않도록 함
            const ensureNonPassive = () => {};
            ["touchstart", "touchmove", "wheel", "mousewheel"].forEach((eventType) => {
                mapElement.addEventListener(eventType, ensureNonPassive, { passive: false, capture: true });
            });

            // 2단계: 필요한 생성자 함수 확인
            if (!naver.maps || typeof naver.maps.Map !== "function" || typeof naver.maps.LatLng !== "function") {
                console.error("Naver Maps SDK is not fully loaded.");
                return;
            }

            try {
                mapRef.current = new naver.maps.Map(mapElement, {
                    center: new naver.maps.LatLng(startPos.lat, startPos.lng),
                    zoom: 15,
                    zoomControl: false,
                    logoControl: false,
                    scrollWheel: true,
                });

                // 🟢 [Fix]: 지도 생성 성공 후에만 mapReady 설정 (컴포넌트가 마운트된 상태일 때만)
                if (isMounted && mapRef.current && naver && naver.maps) {
                    setMapReady(true);
                }
                // 🟢 onMapReady에 bounds를 반환하는 함수 전달
                if (onMapReady && isMounted) {
                    onMapReady(() => {
                        if (!mapRef.current || !isMounted) return null;
                        try {
                            const bounds = mapRef.current.getBounds();
                            if (!bounds) return null;
                            const sw = bounds.getSW(); // 남서쪽 모서리
                            const ne = bounds.getNE(); // 북동쪽 모서리
                            return {
                                minLat: sw.lat(),
                                maxLat: ne.lat(),
                                minLng: sw.lng(),
                                maxLng: ne.lng(),
                            };
                        } catch (error) {
                            console.error("Failed to get map bounds:", error);
                            return null;
                        }
                    });
                }

                // 지도 초기화 후 생성되는 Canvas 요소에도 passive: false 리스너 등록
                canvasTimeout = setTimeout(() => {
                    if (!isMounted) return;
                    const canvas = mapElement.querySelector?.("canvas");
                    if (canvas instanceof HTMLElement) {
                        ["touchstart", "touchmove", "wheel", "mousewheel"].forEach((eventType) => {
                            canvas.addEventListener(eventType, ensureNonPassive, { passive: false, capture: true });
                        });
                    }
                }, 200);
            } catch (error) {
                // 3단계: 에러 발생 시 앱이 죽지 않도록 로그만 남김
                console.error("Map initialization failed:", error);
            }
        })();

        return () => {
            // cleanup: 컴포넌트 언마운트 시 상태 초기화
            isMounted = false;
            if (canvasTimeout) clearTimeout(canvasTimeout);
            setMapReady(false);
            // 지도 인스턴스 정리
            if (mapRef.current) {
                try {
                    mapRef.current = null;
                } catch (error) {
                    console.warn("Error while cleaning map instance:", error);
                }
            }
        };
    }, []);

    // 🟢 [Fix]: center나 selectedPlace가 변경되면 지도 중심점 업데이트 (재초기화 없이)
    useEffect(() => {
        if (!mapReady || !mapRef.current || typeof window === "undefined" || !(window as any).naver?.maps) return;
        
        try {
            const maps = (window as any).naver.maps;
            const newCenter = center || (selectedPlace ? getCoords(selectedPlace) : null);
            if (newCenter && isValidLatLng(newCenter)) {
                const coords = getCoords(newCenter);
                mapRef.current.setCenter(new maps.LatLng(coords.lat, coords.lng));
            }
        } catch (error) {
            console.warn("Failed to update map center:", error);
        }
    }, [mapReady, center?.lat, center?.lng, selectedPlace?.latitude, selectedPlace?.longitude]);

    // 🟢 지도 배경(핀 외 영역) 클릭 시 콜백
    useEffect(() => {
        if (!mapReady || !mapRef.current || !onMapClick) return;
        const naver = (window as any).naver;
        if (!naver?.maps?.Event?.addListener) return;
        const listener = naver.maps.Event.addListener(mapRef.current, "click", () => {
            onMapClick?.();
        });
        return () => {
            naver.maps.Event.removeListener(listener);
        };
    }, [mapReady, onMapClick]);

    // 🟢 [기능 유지] Bounds 자동 조정 - 안전한 접근 제어
    useEffect(() => {
        if (!mapReady || !mapRef.current || !places.length) return;

        // 1단계: window 및 전역 객체 존재 여부 통합 검증
        if (typeof window === "undefined" || !(window as any).naver || !(window as any).naver.maps) {
            return;
        }

        try {
            // 2단계: 필요한 생성자 함수 확인
            const maps = (window as any).naver.maps;
            if (typeof maps.LatLngBounds !== "function" || typeof maps.LatLng !== "function") {
                return;
            }

            const bounds = new maps.LatLngBounds();
            places.filter(isValidLatLng).forEach((p) => {
                const coords = getCoords(p);
                bounds.extend(new maps.LatLng(coords.lat, coords.lng));
            });
            if (userLocation && isValidLatLng(userLocation)) {
                const u = getCoords(userLocation);
                bounds.extend(new maps.LatLng(u.lat, u.lng));
            }
            requestAnimationFrame(() => {
                if (mapRef.current && mapReady) {
                    mapRef.current.fitBounds(bounds);
                }
            });
        } catch (error) {
            // 3단계: 에러 발생 시 앱이 죽지 않도록 로그만 남김
            console.warn("Failed to auto-fit bounds:", error);
        }
    }, [places.length, mapReady, userLocation]);

    // 🟢 [기능 유지] 경로 렌더링 - 안전한 접근 제어
    useEffect(() => {
        // 1단계: window 및 전역 객체 존재 여부 통합 검증
        if (
            typeof window === "undefined" ||
            !(window as any).naver ||
            !(window as any).naver.maps ||
            !mapRef.current ||
            !mapReady
        ) {
            return;
        }

        const maps = (window as any).naver.maps;

        // 2단계: 필요한 생성자 함수 확인
        if (typeof maps.LatLng !== "function" || typeof maps.Polyline !== "function") {
            return;
        }

        // 🟢 pathPlaces가 있으면 경로는 pathPlaces만 사용 (코스에 포함된 장소만 연결)
        // places는 모든 장소의 핀을 표시하는 데 사용
        const placesForPath = pathPlaces && pathPlaces.length > 0 ? pathPlaces : places;
        const valid = (placesForPath || []).filter(isValidLatLng);
        const pts = userLocation ? [userLocation, ...valid] : valid;
        if (!drawPath || pts.length < 2) {
            polylineRef.current?.setMap(null);
            return;
        }

        const buildRoute = async () => {
            let totalPath: any[] = [];
            for (let i = 0; i < pts.length - 1; i++) {
                const start = pts[i];
                const end = pts[i + 1];
                const sC = getCoords(start);
                const eC = getCoords(end);

                if (pathStraightOnly) {
                    totalPath.push(new maps.LatLng(sC.lat, sC.lng), new maps.LatLng(eC.lat, eC.lng));
                } else {
                    const d = distanceMeters(start, end);
                    if (d < 150) {
                        totalPath.push(new maps.LatLng(sC.lat, sC.lng), new maps.LatLng(eC.lat, eC.lng));
                    } else {
                        try {
                            const res = await fetch(
                                `/api/directions?coords=${sC.lng},${sC.lat};${eC.lng},${eC.lat}&mode=driving`
                            );
                            const data = await res.json();
                            if (data.coordinates) {
                                totalPath.push(...data.coordinates.map(([lng, lat]: any) => new maps.LatLng(lat, lng)));
                            }
                        } catch {
                            /* ignore */
                        }
                    }
                }
            }
            if (polylineRef.current) polylineRef.current.setMap(null);
            if (!mapRef.current || !mapReady) return;
            polylineRef.current = new maps.Polyline({
                map: mapRef.current,
                path: totalPath,
                strokeColor: "#5347AA",
                strokeWeight: 6,
                strokeOpacity: 0.8,
                strokeLineCap: "round",
                strokeLineJoin: "round",
            });
        };
        buildRoute().catch((error) => {
            // 3단계: 에러 발생 시 앱이 죽지 않도록 로그만 남김
            console.warn("Route rendering failed:", error);
        });
    }, [places, pathPlaces, userLocation, drawPath, mapReady, pathStraightOnly]);

    // 🟢 선택 모드: 미선택 후보 점선 경로 (직선, API 미호출 → 즉시 렌더)
    useEffect(() => {
        const segments = dottedPathSegments ?? [];
        if (!mapRef.current || !mapReady || segments.length === 0) {
            dottedPolylinesRef.current.forEach((p) => p?.setMap(null));
            dottedPolylinesRef.current = [];
            return;
        }
        const maps = (window as any)?.naver?.maps;
        if (!maps?.LatLng || typeof maps.Polyline !== "function") return;

        const valid = segments.filter((s) => isValidLatLng(s.from) && isValidLatLng(s.to));
        const newPolys = valid.map((s) => {
            const from = getCoords(s.from);
            const to = getCoords(s.to);
            return new maps.Polyline({
                map: mapRef.current,
                path: [new maps.LatLng(from.lat, from.lng), new maps.LatLng(to.lat, to.lng)],
                strokeColor: "#9ca3af",
                strokeWeight: 4,
                strokeOpacity: 0.5,
                strokeLineCap: "round",
                strokeLineJoin: "round",
                strokeStyle: "shortdash",
            });
        });

        dottedPolylinesRef.current.forEach((p) => p?.setMap(null));
        dottedPolylinesRef.current = newPolys;
        return () => {
            newPolys.forEach((p) => p?.setMap(null));
            dottedPolylinesRef.current = [];
        };
    }, [dottedPathSegments, mapReady]);

    // 🟢 [Triple-Layer Guard] 마커 아이콘 정의 - 3단계 방어 로직
    const userIcon = useMemo(() => {
        // 1단계: window 및 전역 객체 존재 여부 통합 검증
        if (!mapReady || typeof window === "undefined" || !(window as any).naver || !(window as any).naver.maps) {
            return null;
        }

        try {
            // 2단계: 필요한 생성자(Point)가 함수인지 최종 확인
            const maps = (window as any).naver.maps;
            if (typeof maps.Point !== "function") {
                return null;
            }

            return {
                content: `<div style="width:40px;height:40px;background:#99c08e;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;">📍</div>`,
                anchor: new maps.Point(20, 20),
            };
        } catch (error) {
            // 3단계: 에러 발생 시 앱이 죽지 않도록 null 반환
            console.warn("Failed to create Naver Maps Point:", error);
            return null;
        }
    }, [mapReady]);

    const getPlaceIcon = useCallback(
        (p: Place, isSelected: boolean) => {
            if (!mapReady || typeof window === "undefined" || !(window as any).naver || !(window as any).naver.maps) {
                return null;
            }

            try {
                const maps = (window as any).naver.maps;
                if (typeof maps.Point !== "function") return null;

                const variant = p.markerVariant ?? "confirmed";
                const isFaded = variant === "candidate";
                const bg = isSelected ? "#5347AA" : isFaded ? "rgba(107,114,128,0.6)" : "#99c08e";
                const size = 42;

                const ord = p.orderIndex ?? (p as { order_index?: number }).order_index;
                const showNum = !isFaded && numberedMarkers && ord != null;
                const label = isFaded
                    ? (numberedMarkers && ord != null ? `${ord + 1}B` : "?")
                    : showNum
                      ? String(ord + 1)
                      : "📍";
                const fontSize = isFaded ? (label.length > 1 ? 12 : 16) : showNum ? 14 : 20;

                return {
                    content: `<div style="width:${size}px;height:${size}px;background:${bg};border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;opacity:${isFaded ? 0.7 : 1}"><div style="transform:rotate(45deg);font-size:${fontSize}px;font-weight:700;color:white;${showNum || (isFaded && label !== "?") ? "text-shadow:0 1px 2px rgba(0,0,0,0.3);" : ""}">${label}</div></div>`,
                    anchor: new maps.Point(size / 2, size),
                };
            } catch (error) {
                console.warn("Failed to create Naver Maps Point:", error);
                return null;
            }
        },
        [mapReady, numberedMarkers]
    );

    return (
        <div className={className} style={{ ...style, width: "100%", height: "100%", position: "relative", minHeight: "320px" }}>
            <div
                ref={mapElementRef}
                data-naver-map="true"
                style={{
                    width: "100%",
                    height: "100%",
                    minHeight: "320px",
                    touchAction: "pan-x pan-y pinch-zoom",
                    overscrollBehavior: "none",
                    willChange: "transform",
                    transform: "translateZ(0)",
                    overflow: "hidden",
                    backgroundColor: "#f3f4f6", // 🟢 지도 로딩 중 배경색
                }}
            />
            {/* 🟢 지도 로딩 중 표시 */}
            {!mapReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#99c08e] mx-auto mb-2"></div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{t("courseDetail.mapLoading")}</p>
                    </div>
                </div>
            )}

            {/* 🟢 마커 분리 렌더링 - 모든 기존 기능 유지 */}
            {mapReady && (
                <>
                    {userLocation && isValidLatLng(userLocation) && userIcon && (
                        <MapMarker
                            map={mapRef.current}
                            position={getCoords(userLocation)}
                            icon={userIcon}
                            zIndex={20}
                        />
                    )}
                    {places.filter(isValidLatLng).map((p) => (
                        <MapMarker
                            key={p.id}
                            map={mapRef.current}
                            position={getCoords(p)}
                            icon={getPlaceIcon(p, selectedPlace?.id === p.id)}
                            zIndex={selectedPlace?.id === p.id ? 1000 : 100}
                            onClick={() => onPlaceClick(p)}
                        />
                    ))}
                </>
            )}

            {/* 🟢 [기능 유지] 모든 컨트롤 버튼 UI */}
            {mapReady && showControls && (
                <div
                    style={{
                        position: "absolute",
                        top: "80px",
                        right: "16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        zIndex: 100,
                    }}
                >
                    <button
                        onClick={() => {
                            // 1단계: window 및 전역 객체 존재 여부 통합 검증
                            if (
                                typeof window === "undefined" ||
                                !(window as any).naver ||
                                !(window as any).naver.maps ||
                                !mapRef.current
                            ) {
                                return;
                            }
                            try {
                                // 2단계: 필요한 생성자 함수 확인
                                const maps = (window as any).naver.maps;
                                if (typeof maps.LatLng !== "function") {
                                    return;
                                }
                                // 3단계: 안전하게 실행
                                if (userLocation?.lat && userLocation?.lng) {
                                    mapRef.current.panTo(new maps.LatLng(userLocation.lat, userLocation.lng));
                                }
                            } catch (error) {
                                console.warn("Failed to pan map:", error);
                            }
                        }}
                        style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "50%",
                            background: "white",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        📍
                    </button>
                    <div
                        style={{
                            background: "white",
                            borderRadius: "24px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            overflow: "hidden",
                        }}
                    >
                        <button
                            onClick={() => mapRef.current?.setZoom(mapRef.current.getZoom() + 1)}
                            style={{
                                width: "48px",
                                height: "48px",
                                border: "none",
                                background: "none",
                                fontSize: "24px",
                            }}
                        >
                            +
                        </button>
                        <button
                            onClick={() => mapRef.current?.setZoom(mapRef.current.getZoom() - 1)}
                            style={{
                                width: "48px",
                                height: "48px",
                                border: "none",
                                background: "none",
                                fontSize: "24px",
                                borderTop: "1px solid #eee",
                            }}
                        >
                            −
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
