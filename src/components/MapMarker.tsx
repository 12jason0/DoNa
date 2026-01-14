"use client";

import { useEffect, useRef, memo } from "react"; // 🟢 memo 추가

interface MapMarkerProps {
    map: any;
    position: { lat: number; lng: number };
    icon: any;
    zIndex?: number;
    onClick?: () => void;
}

// 🟢 [수정 1] memo로 감싸서 '팁' 클릭 시 발생하는 불필요한 재렌더링 방지
export const MapMarker = memo(({ map, position, icon, zIndex = 100, onClick }: MapMarkerProps) => {
    const markerRef = useRef<any>(null);
    const onClickRef = useRef(onClick);
    const clickListenerRef = useRef<any>(null);

    // 🟢 onClick 변경 시 ref 업데이트 (항상 최신 함수 참조)
    useEffect(() => {
        onClickRef.current = onClick;
    }, [onClick]);

    // 🟢 마커 생성 및 위치/아이콘 업데이트 (onClick 제외)
    useEffect(() => {
        if (!map || !window.naver) return;
        const naver = (window as any).naver;
        const pos = new naver.maps.LatLng(position.lat, position.lng);

        if (!markerRef.current) {
            markerRef.current = new naver.maps.Marker({
                position: pos,
                map,
                icon,
                zIndex,
            });
        } else {
            markerRef.current.setPosition(pos);
            markerRef.current.setIcon(icon);
            markerRef.current.setZIndex(zIndex);
        }

        return () => {
            // 🟢 [Critical] 에러 발생 지점(40번 줄) 방어 코드
            if (markerRef.current) {
                try {
                    const currentMarker = markerRef.current;
                    if (currentMarker && typeof currentMarker.setMap === "function") {
                        // SDK 내부 참조 오류(capitalize)가 발생해도 앱 크래시 방지
                        currentMarker.setMap(null);
                    }
                } catch (error) {
                    console.debug("Naver Map Marker Cleanup Ignored:", error);
                } finally {
                    markerRef.current = null;
                }
            }
        };
    }, [map, position.lat, position.lng, icon, zIndex]); // onClick 제외

    // 🟢 onClick 이벤트 리스너만 별도로 관리 (onClick 변경 시에만 업데이트)
    useEffect(() => {
        if (!markerRef.current || !window.naver) return;
        const naver = (window as any).naver;

        // 기존 리스너 제거
        if (clickListenerRef.current) {
            naver.maps.Event.removeListener(clickListenerRef.current);
            clickListenerRef.current = null;
        }

        // 새 리스너 추가 (최신 onClickRef.current 사용)
        if (onClickRef.current) {
            const handler = () => {
                if (onClickRef.current) {
                    onClickRef.current();
                }
            };
            clickListenerRef.current = naver.maps.Event.addListener(markerRef.current, "click", handler);
        }

        return () => {
            // 리스너 정리
            if (clickListenerRef.current) {
                try {
                    naver.maps.Event.removeListener(clickListenerRef.current);
                } catch (error) {
                    console.debug("Naver Map Event Listener Cleanup Ignored:", error);
                }
                clickListenerRef.current = null;
            }
        };
    }, [onClick]); // onClick 변경 시에만 실행

    return null;
});

// 디버깅을 위한 컴포넌트 이름 설정
MapMarker.displayName = "MapMarker";
