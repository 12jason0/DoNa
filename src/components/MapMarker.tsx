"use client";

import { useEffect, useRef, memo } from "react";

interface MapMarkerProps {
    map: any;
    position: { lat: number; lng: number };
    icon: any;
    zIndex?: number;
    onClick?: () => void;
}

export const MapMarker = memo(({ map, position, icon, zIndex = 100, onClick }: MapMarkerProps) => {
    const markerRef = useRef<any>(null);
    const onClickRef = useRef(onClick);
    const clickListenerRef = useRef<any>(null);

    // onClick 최신화
    useEffect(() => {
        onClickRef.current = onClick;
    }, [onClick]);

    // 🟢 [수정]: 마커 생성 및 위치 업데이트 로직 강화
    useEffect(() => {
        // 🔴 [핵심 방어]: window.naver.maps 자체가 완벽히 로드될 때까지 변수 할당조차 시도하지 않음
        const naver = (window as any)?.naver;
        const maps = naver?.maps;

        // LatLng과 Marker 생성자가 모두 '함수'로 준비되었는지 정밀 검사
        if (!map || !maps || typeof maps.LatLng !== "function" || typeof maps.Marker !== "function") {
            return;
        }

        try {
            // 이제 maps.LatLng은 절대 null/undefined가 아님을 보장함
            const pos = new maps.LatLng(position.lat, position.lng);

            if (!markerRef.current) {
                markerRef.current = new maps.Marker({
                    position: pos,
                    map: map,
                    icon: icon,
                    zIndex: zIndex,
                });
            } else {
                markerRef.current.setPosition(pos);
                markerRef.current.setIcon(icon);
                markerRef.current.setZIndex(zIndex);
            }
        } catch (error) {
            console.error("[MapMarker] 마커 처리 중 예외 발생:", error);
        }

        return () => {
            if (markerRef.current) {
                try {
                    const currentMarker = markerRef.current;
                    // 제거 시에도 setMap 함수 존재 여부 확인
                    if (currentMarker && typeof currentMarker.setMap === "function") {
                        currentMarker.setMap(null);
                    }
                } catch (error) {
                    console.debug("Naver Map Marker Cleanup Ignored:", error);
                } finally {
                    markerRef.current = null;
                }
            }
        };
    }, [map, position.lat, position.lng, icon, zIndex]);

    // 🟢 [수정]: 이벤트 리스너 관리 로직 강화
    useEffect(() => {
        const naver = (window as any)?.naver;
        const maps = naver?.maps;

        // 마커나 이벤트 시스템이 준비되지 않았다면 중단
        if (!markerRef.current || !maps?.Event || typeof maps.Event.addListener !== "function") {
            return;
        }

        // 기존 리스너 안전하게 제거
        if (clickListenerRef.current) {
            try {
                maps.Event.removeListener(clickListenerRef.current);
            } catch (e) {}
            clickListenerRef.current = null;
        }

        // 새 리스너 등록
        if (onClickRef.current) {
            const handler = () => {
                if (onClickRef.current) onClickRef.current();
            };
            clickListenerRef.current = maps.Event.addListener(markerRef.current, "click", handler);
        }

        return () => {
            if (clickListenerRef.current && maps?.Event?.removeListener) {
                try {
                    maps.Event.removeListener(clickListenerRef.current);
                } catch (e) {}
                clickListenerRef.current = null;
            }
        };
    }, [onClick]);

    return null;
});

MapMarker.displayName = "MapMarker";
