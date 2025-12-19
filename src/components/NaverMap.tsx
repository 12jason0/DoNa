"use client";

import { useEffect, useRef, useState } from "react";
import type { MapProps, Place } from "@/types/map";

export default function NaverMapComponent({
    places,
    userLocation,
    selectedPlace,
    onPlaceClick,
    className = "",
    style = {},
    drawPath,
    routeMode = "walking", // 기본을 walking으로 고정
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
}: MapProps) {
    const mapElementRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const polylineRef = useRef<any>(null);
    const routeAbortRef = useRef<AbortController | null>(null);
    const routeCacheRef = useRef<Map<string, Array<[number, number]>>>(new Map());
    const prevRouteKeyRef = useRef<string | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [showNearFallback, setShowNearFallback] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [currentHeading, setCurrentHeading] = useState<number | null>(null);
    const shownFallbackRef = useRef(false);

    const triggerNearFallback = () => {
        if (suppressNearFallback) return;
        try {
            if (nearFallbackStorageKey && typeof window !== "undefined") {
                if (sessionStorage.getItem(nearFallbackStorageKey)) return;
                sessionStorage.setItem(nearFallbackStorageKey, "1");
            }
        } catch {}
        if (shownFallbackRef.current) return;
        shownFallbackRef.current = true;
        setShowNearFallback(true);
        try {
            onNearFallbackShown?.();
        } catch {}
    };

    const isFiniteNum = (v: any) => Number.isFinite(Number(v));
    const isValidLatLng = (lat?: any, lng?: any) => isFiniteNum(lat) && isFiniteNum(lng);
    const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        try {
            const R = 6371e3;
            const toRad = (v: number) => (v * Math.PI) / 180;
            const dLat = toRad(lat2 - lat1);
            const dLng = toRad(lng2 - lng1);
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        } catch {
            return Infinity;
        }
    };

    const pickCenter = (): { lat: number; lng: number } => {
        if (selectedPlace && isValidLatLng(selectedPlace.latitude, selectedPlace.longitude)) {
            return { lat: Number(selectedPlace.latitude), lng: Number(selectedPlace.longitude) };
        }
        const first = (places || []).find((p) => isValidLatLng(p?.latitude, p?.longitude));
        if (first) return { lat: Number(first.latitude), lng: Number(first.longitude) };
        if (userLocation && isValidLatLng(userLocation.lat, userLocation.lng)) {
            return { lat: Number(userLocation.lat), lng: Number(userLocation.lng) };
        }
        return { lat: 37.5665, lng: 126.978 };
    };

    // 나침반 감지 (선택사항)
    useEffect(() => {
        if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
        const handleOrientation = (event: DeviceOrientationEvent) => {
            if (event.alpha !== null) setCurrentHeading(event.alpha);
        };
        window.addEventListener("deviceorientation", handleOrientation);
        return () => window.removeEventListener("deviceorientation", handleOrientation);
    }, []);

    // 현재 위치로 이동
    const handleGoToMyLocation = () => {
        if (!mapRef.current || !userLocation) return;
        if (!isValidLatLng(userLocation.lat, userLocation.lng)) return;
        setIsLocating(true);
        const naver = (window as any).naver;
        const targetPos = new naver.maps.LatLng(Number(userLocation.lat), Number(userLocation.lng));
        try {
            mapRef.current.panTo(targetPos, { duration: 500, easing: "easeOutCubic" });
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                try {
                    (navigator as any).vibrate?.(50);
                } catch {}
            }
        } catch (e) {
            console.error("위치 이동 실패:", e);
        } finally {
            setTimeout(() => setIsLocating(false), 500);
        }
    };

    const handleZoomIn = () => {
        if (!mapRef.current) return;
        try {
            const currentZoom = mapRef.current.getZoom();
            mapRef.current.setZoom(currentZoom + 1, true);
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                try {
                    (navigator as any).vibrate?.(30);
                } catch {}
            }
        } catch (e) {
            console.error("줌 인 실패:", e);
        }
    };

    const handleZoomOut = () => {
        if (!mapRef.current) return;
        try {
            const currentZoom = mapRef.current.getZoom();
            mapRef.current.setZoom(currentZoom - 1, true);
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                try {
                    (navigator as any).vibrate?.(30);
                } catch {}
            }
        } catch (e) {
            console.error("줌 아웃 실패:", e);
        }
    };

    const handleResetHeading = () => {
        if (!mapRef.current) return;
        try {
            mapRef.current.setOptions({ bearing: 0 });
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                try {
                    (navigator as any).vibrate?.(30);
                } catch {}
            }
        } catch (e) {
            console.error("방향 리셋 실패:", e);
        }
    };

    // 네이버 지도 스크립트 로더
    const loadNaverMapsScript = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            // 이미 로드됨
            if ((window as any).naver?.maps?.LatLng) {
                console.log("✅ 네이버 지도 이미 로드됨");
                return resolve();
            }

            // 기존 스크립트 체크
            const anyExisting = Array.from(document.getElementsByTagName("script")).find((s) =>
                (s as HTMLScriptElement).src.includes("oapi.map.naver.com")
            ) as HTMLScriptElement | undefined;

            if (anyExisting) {
                console.log("⏳ 기존 스크립트 대기 중...");
                anyExisting.addEventListener(
                    "load",
                    () => {
                        console.log("✅ 기존 스크립트 로드 완료");
                        resolve();
                    },
                    { once: true }
                );
                anyExisting.addEventListener(
                    "error",
                    (e) => {
                        console.error("❌ 기존 스크립트 로드 실패:", e);
                        reject(e);
                    },
                    { once: true }
                );
                return;
            }

            // Client ID 가져오기 (여러 키 이름 지원)
            const clientId =
                process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ||
                process.env.NEXT_PUBLIC_NAVER_MAP_API_KEY_ID ||
                process.env.NEXT_PUBLIC_NAVER_CLIENT_ID ||
                "";

            if (!clientId) {
                console.error("❌ Naver Maps Client ID 환경 변수가 설정되지 않았습니다.");
                reject(new Error("Client ID missing"));
                return;
            }

            // 최신 가이드(ncpKeyId) 우선, 구버전(ncpClientId) 폴백
            const tryParams = ["ncpKeyId", "ncpClientId"] as const;

            const loadWithParam = (param: (typeof tryParams)[number]) =>
                new Promise<void>((res, rej) => {
                    try {
                        const prev = document.getElementById("naver-maps-script");
                        prev?.parentElement?.removeChild(prev);
                    } catch {}

                    const authFailHandler = () => {
                        (window as any).navermap_authFailure = undefined;
                        rej(new Error("AUTH_FAILURE"));
                    };
                    (window as any).navermap_authFailure = authFailHandler;

                    const script = document.createElement("script");
                    script.id = "naver-maps-script";
                    // oapi 도메인을 공식 가이드로 사용
                    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?${param}=${encodeURIComponent(
                        clientId
                    )}`;
                    script.async = true;
                    script.defer = true;

                    script.onload = async () => {
                        try {
                            let retries = 0;
                            const maxRetries = 50;
                            while (retries < maxRetries) {
                                if ((window as any).naver?.maps?.LatLng) {
                                    (window as any).navermap_authFailure = undefined;
                                    return res();
                                }
                                await new Promise((r) => setTimeout(r, 100));
                                retries++;
                            }
                            (window as any).navermap_authFailure = undefined;
                            rej(new Error("SDK_TIMEOUT"));
                        } catch (e) {
                            (window as any).navermap_authFailure = undefined;
                            rej(e as any);
                        }
                    };
                    script.onerror = (e) => {
                        (window as any).navermap_authFailure = undefined;
                        rej(e as any);
                    };

                    document.head.appendChild(script);
                });

            (async () => {
                for (const p of tryParams) {
                    try {
                        await loadWithParam(p);
                        return resolve();
                    } catch (e) {
                        console.warn("지도 스크립트 로드 재시도:", p, e);
                    }
                }
                reject(new Error("Naver Maps SDK load failed (all params)"));
            })();
        });
    };

    // 지도 초기화
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                if (!(window as any).naver?.maps) {
                    await loadNaverMapsScript();
                }
            } catch (e) {
                console.error("Naver Maps SDK 로드 실패:", e);
            }
            if (cancelled || !(window as any).naver?.maps || !mapElementRef.current) return;
            const naver = (window as any).naver;
            const c = center ?? pickCenter();
            try {
                // 이미 지도가 있으면 초기화하지 않음 (React StrictMode 등 대응)
                if (!mapRef.current) {
                    mapRef.current = new naver.maps.Map(mapElementRef.current, {
                        center: new naver.maps.LatLng(c.lat, c.lng),
                        zoom: 15,
                        zoomControl: false,
                        mapTypeControl: false,
                        scaleControl: false,
                        logoControl: false,
                    });
                    setMapReady(true);

                    // 지도 준비 완료 시 bounds 가져오는 함수 제공
                    if (onMapReady) {
                        onMapReady(() => {
                            if (!mapRef.current) return null;
                            try {
                                const bounds = mapRef.current.getBounds();
                                const sw = bounds.getSW();
                                const ne = bounds.getNE();
                                return {
                                    minLat: sw.lat(),
                                    maxLat: ne.lat(),
                                    minLng: sw.lng(),
                                    maxLng: ne.lng(),
                                };
                            } catch {
                                return null;
                            }
                        });
                    }

                    // 지도 이동/줌 변경 시 bounds 콜백
                    if (onBoundsChanged) {
                        const updateBounds = () => {
                            if (!mapRef.current) return;
                            try {
                                const bounds = mapRef.current.getBounds();
                                const sw = bounds.getSW();
                                const ne = bounds.getNE();
                                onBoundsChanged({
                                    minLat: sw.lat(),
                                    maxLat: ne.lat(),
                                    minLng: sw.lng(),
                                    maxLng: ne.lng(),
                                });
                            } catch {}
                        };

                        naver.maps.Event.addListener(mapRef.current, "idle", updateBounds);
                    }
                }
            } catch (e) {
                console.error("지도 인스턴스 생성 실패:", e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // 마커 + 경로
    useEffect(() => {
        const naver = (window as any).naver;
        if (!naver?.maps || !mapRef.current) return;

        console.log("=== NaverMap 렌더링 시작 ===");
        console.log("📦 Props 확인:");
        console.log("  - drawPath:", drawPath);
        console.log("  - userLocation:", userLocation);
        console.log("  - places:", places);
        console.log("  - selectedPlace:", selectedPlace);

        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];
        // 이전 경로 제거 (전 장소의 경로가 남지 않도록)
        if (polylineRef.current) {
            try {
                polylineRef.current.setMap(null);
            } catch {}
            polylineRef.current = null;
        }

        const map = mapRef.current;
        const bounds = new naver.maps.LatLngBounds();
        let didExtend = false;

        const createUserLocationContent = () => {
            const size = 40;
            return `
                <div style="position: relative; width: ${size}px; height: ${size + 10}px;">
                    <div style="
                        width: ${size}px; 
                        height: ${size}px; 
                        background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                        border: 3px solid white; 
                        border-radius: 50%;
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
                        font-size: 20px;
                    ">📍</div>
                    <div style="
                        position: absolute;
                        bottom: 0;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 0;
                        height: 0;
                        border-left: 8px solid transparent;
                        border-right: 8px solid transparent;
                        border-top: 10px solid #059669;
                    "></div>
                </div>`;
        };

        // 사용자 위치
        let userPos: any = null;
        if (userLocation && isValidLatLng(userLocation.lat, userLocation.lng)) {
            userPos = new naver.maps.LatLng(Number(userLocation.lat), Number(userLocation.lng));
            const me = new naver.maps.Marker({
                position: userPos,
                map,
                zIndex: 20,
                title: "현재 위치",
                icon: {
                    content: createUserLocationContent(),
                    anchor: new naver.maps.Point(18, 46),
                },
            });
            markersRef.current.push(me);
            bounds.extend(userPos);
            didExtend = true;
            console.log("✅ 사용자 마커 생성:", {
                lat: userLocation.lat,
                lng: userLocation.lng,
            });
        }

        // 장소 마커
        const valid: Place[] = (places || []).filter((p) => isValidLatLng(p?.latitude, p?.longitude)) as Place[];
        console.log("📍 유효한 장소:", valid.length, "개");

        // 카테고리별 색상 및 아이콘 가져오기
        const getCategoryStyle = (category?: string) => {
            const cat = (category || "").toLowerCase();
            if (cat.includes("카페") || cat.includes("cafe") || cat.includes("커피") || cat.includes("coffee")) {
                return { color: "#059669", icon: "☕", name: "카페" };
            } else if (
                cat.includes("음식") ||
                cat.includes("식당") ||
                cat.includes("맛집") ||
                cat.includes("restaurant") ||
                cat.includes("food")
            ) {
                return { color: "#EA580C", icon: "🍽️", name: "음식점" };
            } else if (cat.includes("관광") || cat.includes("명소") || cat.includes("tour")) {
                return { color: "#7C3AED", icon: "📷", name: "관광" };
            } else if (cat.includes("데이트") || cat.includes("date") || cat.includes("데이팅")) {
                return { color: "#EC4899", icon: "💕", name: "데이트" };
            } else if (cat.includes("카페") || cat.includes("cafe")) {
                return { color: "#059669", icon: "☕", name: "카페" };
            }
            // 기본값
            return { color: "#10B981", icon: "📍", name: "기타" };
        };

        const createNumberContent = (orderIndex: number, categoryColor: string) => {
            const size = 36;
            return `
                <div style="position: relative; width: ${size}px; height: ${size + 10}px;">
                    <div style="
                        width: ${size}px; height: ${size}px; background: ${categoryColor};
                        border: 2px solid white; border-radius: 50%;
                        display: flex; align-items: center; justify-content: center;
                        color: white; font-weight: bold; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,.25);
                    ">${orderIndex}</div>
                    <div style="position:absolute;left:50%;bottom:0;transform:translate(-50%,0);width:0;height:0;
                        border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${categoryColor};"></div>
                </div>`;
        };

        const createCategoryMarker = (categoryStyle: { color: string; icon: string }, isSelected: boolean = false) => {
            const baseSize = isSelected ? 52 : 42;
            const iconSize = isSelected ? 26 : 20;
            return `
                <div style="
                    width: ${baseSize}px; height: ${baseSize}px;
                    position: relative;
                    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.25));
                    transition: transform 0.2s;
                    ${isSelected ? "transform: translateY(-10px) scale(1.1);" : ""}
                ">
                    <div style="
                        width: 100%; height: 100%;
                        background: ${categoryStyle.color};
                        border: 3px solid white;
                        border-radius: 50% 50% 50% 0;
                        transform: rotate(-45deg);
                        display: flex; align-items: center; justify-content: center;
                    ">
                        <div style="transform: rotate(45deg); font-size: ${iconSize}px; line-height: 1; color: white;">
                            ${categoryStyle.icon}
                        </div>
                    </div>
                </div>`;
        };

        // (moved) createUserLocationContent는 상단으로 이동
        valid.forEach((p, idx) => {
            const pos = new naver.maps.LatLng(Number(p.latitude), Number(p.longitude));
            const isSelected = selectedPlace?.id === p.id;
            const orderIndex = (p as any).orderIndex;
            const categoryStyle = getCategoryStyle(p.category);

            const markerInit: any = {
                position: pos,
                map,
                title: p.name,
                zIndex: isSelected ? 1000 : 100,
            };

            // 번호가 있는 경우 (코스 순서)
            if (numberedMarkers && Number.isFinite(orderIndex)) {
                markerInit.icon = {
                    content: createNumberContent(Number(orderIndex), categoryStyle.color),
                    anchor: new naver.maps.Point(18, 46),
                };
            } else {
                // 번호가 없는 경우 카테고리별 아이콘
                markerInit.icon = {
                    content: createCategoryMarker(categoryStyle, isSelected),
                    anchor: new naver.maps.Point(isSelected ? 26 : 21, isSelected ? 52 : 42),
                };
            }

            const marker = new naver.maps.Marker(markerInit);

            naver.maps.Event.addListener(marker, "click", () => {
                onPlaceClick(p);
                if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                    try {
                        (navigator as any).vibrate?.(50);
                    } catch {}
                }
            });

            markersRef.current.push(marker);
            bounds.extend(pos);
            didExtend = true;
            console.log(`  [${orderIndex}] ${p.name}:`, {
                lat: p.latitude,
                lng: p.longitude,
                selected: isSelected,
                category: p.category,
            });
        });

        if (didExtend) {
            map.fitBounds(bounds);
        }

        // 경로 그리기
        // pathPlaces가 있으면 그것으로 경로를 그림, 없으면 valid(places)로 그림
        const placesForPath =
            pathPlaces && pathPlaces.length > 0
                ? pathPlaces
                      .filter((p) => isValidLatLng(p?.latitude, p?.longitude))
                      .sort((a, b) => {
                          // orderIndex로 정렬 (있으면)
                          const aOrder = (a as any).orderIndex ?? 999;
                          const bOrder = (b as any).orderIndex ?? 999;
                          return aOrder - bOrder;
                      })
                : valid;

        // 선택만 바뀐 경우에는 경로 재계산을 건너뜀
        const placesKey = placesForPath
            .map((p) => `${Number(p.latitude).toFixed(6)},${Number(p.longitude).toFixed(6)}`)
            .join("|");
        const userKey = userPos
            ? `${Number(userLocation!.lat).toFixed(6)},${Number(userLocation!.lng).toFixed(6)}`
            : "";
        const currentRouteKey = `${placesKey}__${userKey}`;
        const routeUnchanged = prevRouteKeyRef.current === currentRouteKey;
        prevRouteKeyRef.current = currentRouteKey;

        const buildRoute = async () => {
            // SDK 가드: 지도 API가 준비되지 않았으면 중단
            const naver = (window as any).naver;
            if (!naver?.maps?.LatLng) {
                console.error("❌ Naver Maps API가 아직 로드되지 않았습니다");
                return;
            }

            // ✅ [추가] 외부에서 주입된 경로가 있으면 우선 사용
            if (pathCoordinates && pathCoordinates.length > 0) {
                console.log("📥 외부 주입 경로 사용:", pathCoordinates.length, "포인트");
                const latlngs = pathCoordinates.map(([lng, lat]) => new naver.maps.LatLng(lat, lng));

                polylineRef.current = new naver.maps.Polyline({
                    map: mapRef.current,
                    path: latlngs,
                    strokeWeight: 4,
                    strokeColor: "var(--brand-green-dark, #5f8d57)",
                    strokeOpacity: 0.95,
                    strokeStyle: "solid",
                    strokeLineCap: "round",
                    strokeLineJoin: "round",
                });
                return;
            }

            if (routeUnchanged && polylineRef.current) {
                console.log("⏭ 경로 키 변경 없음 - 기존 경로 유지");
                return;
            }
            if (routeUnchanged && !polylineRef.current) {
                console.log("🔁 경로 키 동일하지만 기존 경로 없음 → 강제 재계산");
            }
            if (!drawPath) {
                console.log("⚠️ drawPath가 false - 경로 그리기 건너뜀");
                return;
            }

            // ⚡️ [성능 최적화] 즉시 실행하지 않고 약간의 지연을 주어 UI 렌더링 우선권 부여
            await new Promise((r) => setTimeout(r, 100));

            console.log("🚀 경로 그리기 시작");

            // ✅ Case 1: start 페이지 (현재 위치 + 장소 1개)
            if (userPos && placesForPath.length === 1) {
                const uLng = Number(userLocation?.lng ?? 0);
                const uLat = Number(userLocation?.lat ?? 0);

                console.log("📍 Case 1: 사용자 위치 → 장소 1개");
                console.log("  출발:", { lat: uLat, lng: uLng });
                console.log("  도착:", {
                    name: placesForPath[0].name,
                    lat: placesForPath[0].latitude,
                    lng: placesForPath[0].longitude,
                });

                // 🔴 같은 좌표 체크
                if (
                    Math.abs(uLat - placesForPath[0].latitude) < 0.00001 &&
                    Math.abs(uLng - placesForPath[0].longitude) < 0.00001
                ) {
                    console.error("❌ 출발지와 도착지가 동일합니다!");
                    return;
                }

                const fetchPath = async () => {
                    const coords = `${uLng},${uLat};${placesForPath[0].longitude},${placesForPath[0].latitude}`;
                    console.log("🌐 API 요청 좌표:", coords);
                    const samplePath = (path: Array<[number, number]>, maxPoints = 200): Array<[number, number]> => {
                        if (!Array.isArray(path) || path.length <= maxPoints) return path;
                        const step = Math.ceil(path.length / maxPoints);
                        const out: Array<[number, number]> = [];
                        for (let i = 0; i < path.length; i += step) out.push(path[i]);
                        const last = path[path.length - 1];
                        const tail = out[out.length - 1];
                        if (!tail || tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
                        return out;
                    };

                    // 도보 우선 시도
                    try {
                        const ck = `walking:${coords}`;
                        const cached = routeCacheRef.current.get(ck);
                        if (cached) return cached;
                        const url = `/api/directions?coords=${encodeURIComponent(coords)}&mode=walking`;
                        const res1 = await fetch(url, { cache: "no-store" });
                        if (res1.ok) {
                            const data = await res1.json();
                            console.log("🚶 도보 응답:", data);
                            if (data?.fallback && String(data?.reason || "").includes("TOO_CLOSE")) {
                                triggerNearFallback();
                            }
                            if (Array.isArray(data?.coordinates) && data.coordinates.length > 0) {
                                const simplified = samplePath(data.coordinates);
                                routeCacheRef.current.set(ck, simplified);
                                return simplified;
                            }
                        }
                    } catch (error) {
                        console.error("도보 경로 요청 실패:", error);
                    }

                    // 도보 실패 시 운전 경로 시도
                    try {
                        const ck = `driving:${coords}`;
                        const cached = routeCacheRef.current.get(ck);
                        if (cached) return cached;
                        const url = `/api/directions?coords=${encodeURIComponent(coords)}&mode=driving`;
                        const res2 = await fetch(url, { cache: "no-store" });
                        if (res2.ok) {
                            const data = await res2.json();
                            console.log("🚗 운전 응답:", data);
                            if (data?.fallback && String(data?.reason || "").includes("TOO_CLOSE")) {
                                triggerNearFallback();
                            }
                            if (Array.isArray(data?.coordinates) && data.coordinates.length > 0) {
                                const simplified = samplePath(data.coordinates);
                                routeCacheRef.current.set(ck, simplified);
                                return simplified;
                            }
                        }
                    } catch (error) {
                        console.error("운전 경로 요청 실패:", error);
                    }

                    return null;
                };

                try {
                    const coordsPath = await fetchPath();

                    if (coordsPath && coordsPath.length > 0) {
                        const latlngs = coordsPath.map(
                            ([lng, lat]: [number, number]) => new naver.maps.LatLng(lat, lng)
                        );

                        console.log("✅ Polyline 생성:", latlngs.length, "개 포인트");
                        polylineRef.current = new naver.maps.Polyline({
                            map,
                            path: latlngs,
                            strokeWeight: 4,
                            strokeColor: "var(--brand-green-dark, #5f8d57)",
                            strokeOpacity: 0.95,
                            strokeStyle: "solid",
                            strokeLineCap: "round",
                            strokeLineJoin: "round",
                        });
                    } else {
                        console.warn("⚠️ 경로 데이터가 없습니다 - 직선 폴백 사용");
                        const fallback = [
                            [uLng, uLat],
                            [placesForPath[0].longitude, placesForPath[0].latitude],
                        ] as Array<[number, number]>;
                        const latlngs = fallback.map(([lng, lat]) => new naver.maps.LatLng(lat, lng));
                        polylineRef.current = new naver.maps.Polyline({
                            map,
                            path: latlngs,
                            strokeWeight: 4,
                            strokeColor: "var(--brand-green-dark, #5f8d57)",
                            strokeOpacity: 0.95,
                            strokeStyle: "solid",
                            strokeLineCap: "round",
                            strokeLineJoin: "round",
                        });
                        triggerNearFallback();
                    }
                } catch (error) {
                    console.error("❌ 경로 생성 중 에러:", error);
                }
                return;
            }

            // ✅ Case 2: courses/[id] (장소 여러 개 연결)
            if (valid.length >= 2) {
                console.log("📍 Case 2: 장소 여러 개 연결", valid.length);
                const allLatLngs: any[] = [];

                const tryFetchSegment = async (
                    start: { latitude: number; longitude: number },
                    end: { latitude: number; longitude: number },
                    primary: "walking" | "driving"
                ): Promise<Array<[number, number]> | null> => {
                    const coords = `${start.longitude},${start.latitude};${end.longitude},${end.latitude}`;
                    console.log(`🌐 세그먼트 요청 (${primary}):`, coords);
                    const samplePath = (path: Array<[number, number]>, maxPoints = 200): Array<[number, number]> => {
                        if (!Array.isArray(path) || path.length <= maxPoints) return path;
                        const step = Math.ceil(path.length / maxPoints);
                        const out: Array<[number, number]> = [];
                        for (let i = 0; i < path.length; i += step) out.push(path[i]);
                        const last = path[path.length - 1];
                        const tail = out[out.length - 1];
                        if (!tail || tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
                        return out;
                    };
                    try {
                        const ck1 = `${primary}:${coords}`;
                        const cached1 = routeCacheRef.current.get(ck1);
                        if (cached1) return cached1;
                        const r1 = await fetch(`/api/directions?coords=${encodeURIComponent(coords)}&mode=${primary}`, {
                            cache: "no-store",
                        });
                        if (r1.ok) {
                            const d1 = await r1.json();
                            if (Array.isArray(d1?.coordinates) && d1.coordinates.length > 0) {
                                const simplified = samplePath(d1.coordinates);
                                routeCacheRef.current.set(ck1, simplified);
                                console.log(`✅ ${primary} 경로 성공:`, simplified.length, "포인트");
                                return simplified;
                            }
                            if (
                                d1?.fallback &&
                                String(d1?.reason || "").includes("TOO_CLOSE") &&
                                !shownFallbackRef.current
                            ) {
                                shownFallbackRef.current = true;
                                setShowNearFallback(true);
                            }
                        }

                        const secondary = primary === "walking" ? "driving" : "walking";
                        const ck2 = `${secondary}:${coords}`;
                        const cached2 = routeCacheRef.current.get(ck2);
                        if (cached2) return cached2;
                        const r2 = await fetch(
                            `/api/directions?coords=${encodeURIComponent(coords)}&mode=${secondary}`,
                            { cache: "no-store" }
                        );
                        if (r2.ok) {
                            const d2 = await r2.json();
                            if (Array.isArray(d2?.coordinates) && d2.coordinates.length > 0) {
                                const simplified = samplePath(d2.coordinates);
                                routeCacheRef.current.set(ck2, simplified);
                                console.log(`✅ ${secondary} 경로 성공:`, simplified.length, "포인트");
                                return simplified;
                            }
                            if (
                                d2?.fallback &&
                                String(d2?.reason || "").includes("TOO_CLOSE") &&
                                !shownFallbackRef.current
                            ) {
                                shownFallbackRef.current = true;
                                setShowNearFallback(true);
                            }
                        }
                    } catch (error) {
                        console.error("세그먼트 요청 실패:", error);
                    }
                    // 최종 실패 시 직선 폴백 제공
                    triggerNearFallback();
                    return [
                        [start.longitude, start.latitude],
                        [end.longitude, end.latitude],
                    ];
                };

                // 병렬로 모든 세그먼트 요청 (성능 최적화를 위해 청크 처리 고려 가능하나, 일단 예외 처리 강화)
                const tasks: Array<Promise<Array<[number, number]> | null>> = [];
                for (let i = 0; i < placesForPath.length - 1; i++) {
                    const a = placesForPath[i];
                    const b = placesForPath[i + 1];
                    const d = distanceMeters(a.latitude, a.longitude, b.latitude, b.longitude);
                    // 요청: 도보 우선. 실패 시 운전으로 자동 백업은 tryFetchSegment 내부에서 수행됨
                    const primary: "walking" | "driving" =
                        routeMode === "walking" || routeMode === "foot"
                            ? "walking"
                            : d <= 1_500
                            ? "walking"
                            : "driving";
                    console.log(`🔗 세그먼트 ${i}:`, a.name, "→", b.name, `(${d.toFixed(0)}m, ${primary})`);
                    // 각 요청이 실패해도 전체 프로세스가 죽지 않도록 개별 catch 처리
                    tasks.push(tryFetchSegment(a as any, b as any, primary).catch(() => null));
                }

                // 모든 요청이 끝날 때까지 기다림 (Promise.allSettled와 유사하게 동작하도록 위에서 catch함)
                const results = await Promise.all(tasks);

                results.forEach((coordsPath, idx) => {
                    if (coordsPath && coordsPath.length > 0) {
                        try {
                            // ✅ 컴포넌트 상단에서 선언한 naver 변수 사용
                            const naverSdk = (window as any).naver;
                            if (!naverSdk?.maps?.LatLng) {
                                console.warn("⚠️ 네이버 SDK 대기 중... 건너뜀");
                                return; // 에러 대신 조용히 건너뜀
                            }
                            let segment = coordsPath.map(([lng, lat]) => new naverSdk.maps.LatLng(lat, lng));
                            if (allLatLngs.length > 0) segment.shift();
                            allLatLngs.push(...segment);
                        } catch (error) {
                            console.error(`❌ 세그먼트 ${idx} 변환 실패:`, error);
                        }
                    }
                });

                console.log("📊 전체 경로 포인트:", allLatLngs.length);
                if (allLatLngs.length > 1) {
                    polylineRef.current = new naver.maps.Polyline({
                        map,
                        path: allLatLngs,
                        strokeWeight: 4,
                        strokeColor: "var(--brand-green-dark, #5f8d57)",
                        strokeOpacity: 0.95,
                        strokeStyle: "solid",
                        strokeLineCap: "round",
                        strokeLineJoin: "round",
                    });
                    console.log("✅ Polyline 생성 완료");
                } else {
                    console.warn("⚠️ 경로 포인트가 부족합니다");
                }
            }
        };

        buildRoute().catch((error) => {
            console.error("❌ buildRoute 에러:", error);
        });
    }, [places, userLocation, selectedPlace, drawPath, routeMode, mapReady, pathCoordinates]);

    // 선택된 장소로 부드럽게 이동
    useEffect(() => {
        const naver = (window as any).naver;
        if (!naver?.maps || !mapRef.current || !selectedPlace) return;
        if (!isValidLatLng(selectedPlace.latitude, selectedPlace.longitude)) return;

        const targetPos = new naver.maps.LatLng(Number(selectedPlace.latitude), Number(selectedPlace.longitude));
        try {
            mapRef.current.panTo(targetPos, { duration: 500, easing: "easeOutCubic" });
            console.log("🗺️ 지도 중심 이동:", selectedPlace.name);
        } catch {}
    }, [selectedPlace]);

    return (
        <div className={className} style={{ ...style, width: "100%", height: "100%", position: "relative" }}>
            <div ref={mapElementRef} style={{ width: "100%", height: "100%" }} />

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
                    {userLocation && (
                        <button
                            onClick={handleGoToMyLocation}
                            disabled={isLocating}
                            aria-label="현재 위치로 이동"
                            style={{
                                width: "48px",
                                height: "48px",
                                borderRadius: "50%",
                                border: "none",
                                backgroundColor: "white",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                                cursor: isLocating ? "default" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.2s ease",
                                opacity: isLocating ? 0.7 : 1,
                            }}
                        >
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                style={{ animation: isLocating ? "spin 1s linear infinite" : "none" }}
                            >
                                <circle cx="12" cy="12" r="3" fill="#10B981" />
                                <circle cx="12" cy="12" r="8" stroke="#10B981" strokeWidth="2" fill="none" />
                            </svg>
                        </button>
                    )}
                    {currentHeading !== null && (
                        <button
                            onClick={handleResetHeading}
                            aria-label="북쪽으로 회전"
                            style={{
                                width: "48px",
                                height: "48px",
                                borderRadius: "50%",
                                border: "none",
                                backgroundColor: "white",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.2s ease",
                            }}
                        >
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                style={{ transform: `rotate(${currentHeading}deg)`, transition: "transform 0.3s ease" }}
                            >
                                <path d="M12 2L15 10H9L12 2Z" fill="#EF4444" />
                                <path d="M12 22L9 14H15L12 22Z" fill="#6B7280" />
                            </svg>
                        </button>
                    )}
                    <div
                        style={{
                            backgroundColor: "white",
                            borderRadius: "24px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            overflow: "hidden",
                        }}
                    >
                        <button
                            onClick={handleZoomIn}
                            aria-label="확대"
                            style={{
                                width: "48px",
                                height: "48px",
                                border: "none",
                                borderBottom: "1px solid #E5E7EB",
                                backgroundColor: "transparent",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "24px",
                                fontWeight: 400,
                                color: "#374151",
                                transition: "all 0.2s ease",
                            }}
                        >
                            +
                        </button>
                        <button
                            onClick={handleZoomOut}
                            aria-label="축소"
                            style={{
                                width: "48px",
                                height: "48px",
                                border: "none",
                                backgroundColor: "transparent",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "24px",
                                fontWeight: 400,
                                color: "#374151",
                                transition: "all 0.2s ease",
                            }}
                        >
                            −
                        </button>
                    </div>
                </div>
            )}
            {showNearFallback && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-50">
                    <div className="bg-white/90 rounded-2xl p-5 text-center shadow-md w-[250px]">
                        <p className="text-gray-800 text-sm mb-3 leading-relaxed">
                            일부 지점은 도보 경로 정보가 없어
                            <br />
                            직선으로 표시됩니다.
                            <br />
                            양해 부탁드립니다.
                        </p>
                        <button
                            className="px-4 py-1.5 bg-[#99C08E] text-white text-sm rounded-lg"
                            onClick={() => setShowNearFallback(false)}
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}

            {selectedPlace && showPlaceOverlay && (
                <div
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-4 z-40"
                    style={{ maxWidth: 360 }}
                >
                    <div className="pointer-events-auto bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 px-4 py-3">
                        <div className="font-semibold text-gray-900 text-sm line-clamp-1">{selectedPlace.name}</div>
                        {selectedPlace.address && (
                            <div className="text-xs text-gray-600 line-clamp-1">{selectedPlace.address}</div>
                        )}
                    </div>
                </div>
            )}
            <style jsx>{`
                @keyframes spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }
                button:active {
                    transform: scale(0.95);
                }
            `}</style>
        </div>
    );
}
