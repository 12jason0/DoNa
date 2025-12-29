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
        (async () => {
            if (!(window as any).naver?.maps) await loadNaverMapsScript();
            if (!mapElementRef.current || mapRef.current) return;
            const naver = (window as any).naver;
            const startPos = center || (selectedPlace ? getCoords(selectedPlace) : { lat: 37.5665, lng: 126.978 });

            const mapElement = mapElementRef.current;

            // 🟢 [Fix] 지도 초기화 전에 passive: false 리스너를 먼저 등록하여 SDK의 preventDefault 허용
            // Naver Maps SDK가 등록하는 이벤트 리스너가 passive로 강제되지 않도록 함
            const ensureNonPassive = () => {};
            ["touchstart", "touchmove", "wheel", "mousewheel"].forEach((eventType) => {
                mapElement.addEventListener(eventType, ensureNonPassive, { passive: false, capture: true });
            });

            mapRef.current = new naver.maps.Map(mapElement, {
                center: new naver.maps.LatLng(startPos.lat, startPos.lng),
                zoom: 15,
                zoomControl: false,
                logoControl: false,
                scrollWheel: true,
            });

            setMapReady(true);
            if (onMapReady) onMapReady(mapRef.current);

            // 지도 초기화 후 생성되는 Canvas 요소에도 passive: false 리스너 등록
            setTimeout(() => {
                const canvas = mapElement.querySelector?.("canvas");
                if (canvas instanceof HTMLElement) {
                    ["touchstart", "touchmove", "wheel", "mousewheel"].forEach((eventType) => {
                        canvas.addEventListener(eventType, ensureNonPassive, { passive: false, capture: true });
                    });
                }
            }, 200);
        })();
    }, []);

    // 🟢 [기능 유지] Bounds 자동 조정
    useEffect(() => {
        if (!mapReady || !mapRef.current || !places.length) return;
        const naver = (window as any).naver;
        const bounds = new naver.maps.LatLngBounds();
        places.filter(isValidLatLng).forEach((p) => {
            const coords = getCoords(p);
            bounds.extend(new naver.maps.LatLng(coords.lat, coords.lng));
        });
        if (userLocation && isValidLatLng(userLocation)) {
            const u = getCoords(userLocation);
            bounds.extend(new naver.maps.LatLng(u.lat, u.lng));
        }
        requestAnimationFrame(() => {
            mapRef.current.fitBounds(bounds);
        });
    }, [places.length, mapReady]);

    // 🟢 [기능 유지] 경로 렌더링
    useEffect(() => {
        const naver = (window as any).naver;
        if (!naver?.maps || !mapRef.current) return;

        const valid = (places || []).filter(isValidLatLng);
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
                    totalPath.push(new naver.maps.LatLng(sC.lat, sC.lng), new naver.maps.LatLng(eC.lat, eC.lng));
                } else {
                    try {
                        const res = await fetch(
                            `/api/directions?coords=${sC.lng},${sC.lat};${eC.lng},${eC.lat}&mode=driving`
                        );
                        const data = await res.json();
                        if (data.coordinates) {
                            totalPath.push(
                                ...data.coordinates.map(([lng, lat]: any) => new naver.maps.LatLng(lat, lng))
                            );
                        }
                    } catch {
                        /* ignore */
                    }
                }
            }
            if (polylineRef.current) polylineRef.current.setMap(null);
            polylineRef.current = new naver.maps.Polyline({
                map: mapRef.current,
                path: totalPath,
                strokeColor: "#5347AA",
                strokeWeight: 6,
                strokeOpacity: 0.8,
                strokeLineCap: "round",
                strokeLineJoin: "round",
            });
        };
        buildRoute();
    }, [places, userLocation, drawPath]);

    // 🟢 [오류 해결] 마커 아이콘 정의 - 옵셔널 체이닝 제거 및 naver 객체 직접 참조
    const userIcon = useMemo(() => {
        if (typeof window === "undefined" || !(window as any).naver) return null;
        const naver = (window as any).naver;
        return {
            content: `<div style="width:40px;height:40px;background:#10B981;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;">📍</div>`,
            anchor: new naver.maps.Point(20, 20),
        };
    }, [mapReady]);

    const getPlaceIcon = useCallback(
        (isSelected: boolean) => {
            if (typeof window === "undefined" || !(window as any).naver) return null;
            const naver = (window as any).naver;
            return {
                content: `<div style="width:${isSelected ? 52 : 42}px;height:${isSelected ? 52 : 42}px;background:${
                    isSelected ? "#5347AA" : "#10B981"
                };border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;"><div style="transform:rotate(45deg);font-size:20px;">📍</div></div>`,
                anchor: new naver.maps.Point(21, 42),
            };
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
                        onClick={() =>
                            mapRef.current?.panTo(
                                new (window as any).naver.maps.LatLng(userLocation?.lat, userLocation?.lng)
                            )
                        }
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
