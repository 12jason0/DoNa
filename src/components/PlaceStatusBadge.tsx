"use client";

import { getPlaceStatus, PlaceStatusInfo } from "@/lib/placeStatus";

interface PlaceClosedDay {
    day_of_week: number | null;
    specific_date: Date | string | null;
    note?: string | null;
}

interface Place {
    opening_hours: string | null;
    closed_days?: PlaceClosedDay[];
}

interface PlaceStatusBadgeProps {
    place: Place;
    closedDays?: PlaceClosedDay[];
    showHours?: boolean;
    size?: "sm" | "md" | "lg";
}

/**
 * 장소 영업 상태 배지 컴포넌트
 */
export default function PlaceStatusBadge({
    place,
    closedDays = [],
    showHours = true,
    size = "md",
}: PlaceStatusBadgeProps) {
    const statusInfo: PlaceStatusInfo = getPlaceStatus(place.opening_hours, closedDays || place.closed_days || []);

    // 크기별 스타일
    const sizeClasses = {
        sm: "text-xs px-2 py-1",
        md: "text-sm px-3 py-1.5",
        lg: "text-base px-4 py-2",
    };

    // 상태별 스타일
    const statusStyles: Record<PlaceStatusInfo["status"], { bg: string; text: string; dot: string }> = {
        영업중: {
            bg: "bg-green-100",
            text: "text-green-800",
            dot: "bg-green-500",
        },
        "곧 마감": {
            bg: "bg-orange-100",
            text: "text-orange-800",
            dot: "bg-orange-500",
        },
        "곧 브레이크": {
            bg: "bg-amber-100",
            text: "text-amber-800",
            dot: "bg-amber-500",
        },
        "브레이크 중": {
            bg: "bg-amber-100",
            text: "text-amber-800",
            dot: "bg-amber-500",
        },
        "오픈 준비중": {
            bg: "bg-blue-100",
            text: "text-blue-800",
            dot: "bg-blue-500",
        },
        휴무: {
            bg: "bg-gray-100",
            text: "text-gray-800",
            dot: "bg-gray-500",
        },
        영업종료: {
            bg: "bg-red-100",
            text: "text-red-800",
            dot: "bg-red-500",
        },
        "정보 없음": {
            bg: "bg-gray-100",
            text: "text-gray-600",
            dot: "bg-gray-400",
        },
    };

    const style = statusStyles[statusInfo.status];

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {/* 상태 배지 */}
            <div
                className={`inline-flex items-center gap-2 ${sizeClasses[size]} ${style.bg} ${style.text} rounded-full font-medium`}
            >
                <span className={`w-2 h-2 rounded-full ${style.dot} animate-pulse`}></span>
                <span>{statusInfo.status}</span>
            </div>

            {/* 영업시간 정보 */}
            {showHours && statusInfo.message && (
                <span className={`${sizeClasses[size]} text-gray-600`}>{statusInfo.message}</span>
            )}
        </div>
    );
}

/**
 * 간단한 상태 표시만 필요한 경우 사용하는 컴포넌트
 */
export function PlaceStatusDot({ place, closedDays = [] }: { place: Place; closedDays?: PlaceClosedDay[] }) {
    const statusInfo = getPlaceStatus(place.opening_hours, closedDays || place.closed_days || []);

    const dotColors: Record<PlaceStatusInfo["status"], string> = {
        영업중: "bg-green-500",
        "곧 마감": "bg-orange-500",
        "곧 브레이크": "bg-amber-500",
        "브레이크 중": "bg-amber-500",
        "오픈 준비중": "bg-blue-500",
        휴무: "bg-gray-500",
        영업종료: "bg-red-500",
        "정보 없음": "bg-gray-400",
    };

    return (
        <span
            className={`w-3 h-3 rounded-full ${dotColors[statusInfo.status]} inline-block`}
            title={statusInfo.message}
        ></span>
    );
}

