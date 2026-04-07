import type { PlaceStatus as CoursePlaceOpenStatus } from "../../../../src/lib/placeStatus";

export const MAP_PURPLE = "#5347AA";
export const NAVER_BTN_GRAY = "#9ca3af";

// --- 코스 지도 핀 (iOS 안정성 위해 PNG 이미지 마커로 사용: 1~5) ---
export const STEP_PIN_IMAGES: Record<number, { normal: number; selected: number }> = {
    1: {
        normal: require("../../../assets/map-markers/marker-play-step-1.png"),
        selected: require("../../../assets/map-markers/marker-play-step-1-selected.png"),
    },
    2: {
        normal: require("../../../assets/map-markers/marker-play-step-2.png"),
        selected: require("../../../assets/map-markers/marker-play-step-2-selected.png"),
    },
    3: {
        normal: require("../../../assets/map-markers/marker-play-step-3.png"),
        selected: require("../../../assets/map-markers/marker-play-step-3-selected.png"),
    },
    4: {
        normal: require("../../../assets/map-markers/marker-play-step-4.png"),
        selected: require("../../../assets/map-markers/marker-play-step-4-selected.png"),
    },
    5: {
        normal: require("../../../assets/map-markers/marker-play-step-5.png"),
        selected: require("../../../assets/map-markers/marker-play-step-5-selected.png"),
    },
};

export const GRADE_META: Record<string, { bg: string; text: string }> = {
    FREE: { bg: "#dcfce7", text: "#16a34a" },
    BASIC: { bg: "#dbeafe", text: "#1d4ed8" },
    PREMIUM: { bg: "#fef3c7", text: "#d97706" },
};

export const SEGMENT_ORDER = ["brunch", "lunch", "dinner", "bar", "cafe"];
export const SEGMENT_ICONS: Record<string, string> = { brunch: "🥐", lunch: "🍱", dinner: "🍽️", bar: "🍷", cafe: "☕" };

export const PLACE_OPEN_BADGE_RN: Record<CoursePlaceOpenStatus, { bg: string; text: string }> = {
    영업중: { bg: "#dcfce7", text: "#166534" },
    "곧 마감": { bg: "#ffedd5", text: "#c2410c" },
    "곧 브레이크": { bg: "#fef3c7", text: "#b45309" },
    "브레이크 중": { bg: "#fef3c7", text: "#b45309" },
    "오픈 준비중": { bg: "#dbeafe", text: "#1d4ed8" },
    휴무: { bg: "#f3f4f6", text: "#4b5563" },
    영업종료: { bg: "#fee2e2", text: "#b91c1c" },
    "정보 없음": { bg: "#f3f4f6", text: "#6b7280" },
};
