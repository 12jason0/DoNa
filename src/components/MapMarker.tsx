"use client";

import { useEffect, useRef } from "react";

interface MapMarkerProps {
    map: any;
    position: { lat: number; lng: number };
    icon: any;
    zIndex?: number;
    onClick?: () => void;
}

export const MapMarker = ({ map, position, icon, zIndex = 100, onClick }: MapMarkerProps) => {
    const markerRef = useRef<any>(null);

    useEffect(() => {
        if (!map || !window.naver) return;
        const naver = (window as any).naver;
        const pos = new naver.maps.LatLng(position.lat, position.lng);

        if (!markerRef.current) {
            // 마커 최초 생성
            markerRef.current = new naver.maps.Marker({
                position: pos,
                map,
                icon,
                zIndex,
            });
            if (onClick) naver.maps.Event.addListener(markerRef.current, "click", onClick);
        } else {
            // 기존 객체 속성만 업데이트 (성능 최적화 핵심)
            markerRef.current.setPosition(pos);
            markerRef.current.setIcon(icon);
            markerRef.current.setZIndex(zIndex);
        }

        return () => {
            if (markerRef.current) {
                markerRef.current.setMap(null);
                markerRef.current = null;
            }
        };
    }, [map, position.lat, position.lng, icon, zIndex]);

    return null;
};
