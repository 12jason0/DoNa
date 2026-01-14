"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { MapProps, Place } from "@/types/map";
import { MapMarker } from "./MapMarker";

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
    onBoundsChanged,
    onMapReady,
    currentStep,
    onNextStep,
}: MapProps) {
    const mapElementRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const polylineRef = useRef<any>(null);
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
            if (!mapElementRef.current || mapRef.current || !isMounted) return;

            // 1단계: window 및 전역 객체 존재 여부 통합 검증
            if (typeof window === "undefined" || !(window as any).naver || !(window as any).naver.maps) {
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
                console.error("Naver Maps SDK가 완전히 로드되지 않았습니다.");
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
                            console.error("지도 bounds 가져오기 실패:", error);
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
                console.error("지도 초기화 실패:", error);
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
                    console.warn("지도 정리 중 오류:", error);
                }
            }
        };
    }, []);

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
            console.warn("Bounds 자동 조정 실패:", error);
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
                const d = distanceMeters(start, end);
                const sC = getCoords(start);
                const eC = getCoords(end);

                if (d < 200 || d > 500) {
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
            console.warn("경로 렌더링 실패:", error);
        });
    }, [places, pathPlaces, userLocation, drawPath, mapReady]);

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
                content: `<div style="width:40px;height:40px;background:#10B981;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;">📍</div>`,
                anchor: new maps.Point(20, 20),
            };
        } catch (error) {
            // 3단계: 에러 발생 시 앱이 죽지 않도록 null 반환
            console.warn("Naver Maps Point 생성 실패:", error);
            return null;
        }
    }, [mapReady]);

    const getPlaceIcon = useCallback(
        (isSelected: boolean) => {
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
                    content: `<div style="width:${isSelected ? 52 : 42}px;height:${isSelected ? 52 : 42}px;background:${
                        isSelected ? "#5347AA" : "#10B981"
                    };border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;"><div style="transform:rotate(45deg);font-size:20px;">📍</div></div>`,
                    anchor: new maps.Point(21, 42),
                };
            } catch (error) {
                // 3단계: 에러 발생 시 앱이 죽지 않도록 null 반환
                console.warn("Naver Maps Point 생성 실패:", error);
                return null;
            }
        },
        [mapReady]
    );

    return (
        <div className={className} style={{ ...style, width: "100%", height: "100%", position: "relative" }}>
            <div
                ref={mapElementRef}
                data-naver-map="true"
                style={{
                    width: "100%",
                    height: "100%",
                    touchAction: "pan-x pan-y pinch-zoom",
                    overscrollBehavior: "none",
                    willChange: "transform",
                    transform: "translateZ(0)",
                    overflow: "hidden",
                }}
            />

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
                            icon={getPlaceIcon(selectedPlace?.id === p.id)}
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
                                console.warn("지도 이동 실패:", error);
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
