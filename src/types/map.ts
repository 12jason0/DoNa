export interface Place {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    address?: string;
    category?: string;
    imageUrl?: string;
    description?: string;
    iconUrl?: string; // 커스텀 마커 아이콘 (고대 룬 등)
    orderIndex?: number; // 타임라인 순서를 지도에 표시
}

export interface UserLocation {
    lat: number;
    lng: number;
}

export interface MapProps {
    places: Place[];
    userLocation: UserLocation | null;
    selectedPlace: Place | null;
    onPlaceClick: (place: Place) => void;
    className?: string;
    style?: React.CSSProperties;
    draggable?: boolean;
    drawPath?: boolean; // 경로 표시 여부 (기본 false)
    routeMode?: "simple" | "walking" | "foot" | "driving"; // 경로 모드 (기본 simple)
    ancientStyle?: boolean; // 고대 유물 스타일 오버레이
    highlightPlaceId?: number; // 강조 효과를 줄 place id
    center?: UserLocation; // 초기 중심점(옵션)
    numberedMarkers?: boolean; // 순번 뱃지를 핀에 표시
    // 근거리 직선 폴백 안내 모달을 세션 전역 1회만 띄우기 위한 키 (예: start-fallback-코스ID)
    nearFallbackStorageKey?: string;
    // 외부에서 모달 노출을 막고 싶을 때
    suppressNearFallback?: boolean;
    // 모달이 처음 표시될 때 알림용 콜백
    onNearFallbackShown?: () => void;
    // 컨트롤 표시 여부 (줌/현재위치/나침반)
    showControls?: boolean;
    // 선택된 장소 하단 오버레이 표시 여부
    showPlaceOverlay?: boolean;
    // 외부에서 주입된 경로 좌표 배열 (있으면 자체 계산 대신 이걸 그림)
    pathCoordinates?: number[][];
}

// 과거 호환용 타입 별칭 (점진적 마이그레이션용)
export type KakaoMapProps = MapProps;
