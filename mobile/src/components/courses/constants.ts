import type { PlaceStatus as CoursePlaceOpenStatus } from "../../../../src/lib/placeStatus";

export const MAP_PURPLE = "#5347AA";
export const NAVER_BTN_GRAY = "#9ca3af";

// --- 코스 지도 핀 (iOS 안정성 위해 PNG 이미지 마커로 사용: 1~9, 10번째부터는 9) ---
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
    6: {
        normal: require("../../../assets/map-markers/marker-play-step-6.png"),
        selected: require("../../../assets/map-markers/marker-play-step-6-selected.png"),
    },
    7: {
        normal: require("../../../assets/map-markers/marker-play-step-7.png"),
        selected: require("../../../assets/map-markers/marker-play-step-7-selected.png"),
    },
    8: {
        normal: require("../../../assets/map-markers/marker-play-step-8.png"),
        selected: require("../../../assets/map-markers/marker-play-step-8-selected.png"),
    },
    9: {
        normal: require("../../../assets/map-markers/marker-play-step-9.png"),
        selected: require("../../../assets/map-markers/marker-play-step-9-selected.png"),
    },
};

// --- 선택형 코스 후보 핀 "1A"~"9B" (일반/선택/선택 안 된 후보 회색) ---
export const CHOICE_PIN_IMAGES: Record<string, { normal: number; selected: number; alt: number }> = {
    "1A": {
        normal: require("../../../assets/map-markers/marker-choice-1A.png"),
        selected: require("../../../assets/map-markers/marker-choice-1A-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-1A-alt.png"),
    },
    "1B": {
        normal: require("../../../assets/map-markers/marker-choice-1B.png"),
        selected: require("../../../assets/map-markers/marker-choice-1B-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-1B-alt.png"),
    },
    "2A": {
        normal: require("../../../assets/map-markers/marker-choice-2A.png"),
        selected: require("../../../assets/map-markers/marker-choice-2A-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-2A-alt.png"),
    },
    "2B": {
        normal: require("../../../assets/map-markers/marker-choice-2B.png"),
        selected: require("../../../assets/map-markers/marker-choice-2B-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-2B-alt.png"),
    },
    "3A": {
        normal: require("../../../assets/map-markers/marker-choice-3A.png"),
        selected: require("../../../assets/map-markers/marker-choice-3A-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-3A-alt.png"),
    },
    "3B": {
        normal: require("../../../assets/map-markers/marker-choice-3B.png"),
        selected: require("../../../assets/map-markers/marker-choice-3B-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-3B-alt.png"),
    },
    "4A": {
        normal: require("../../../assets/map-markers/marker-choice-4A.png"),
        selected: require("../../../assets/map-markers/marker-choice-4A-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-4A-alt.png"),
    },
    "4B": {
        normal: require("../../../assets/map-markers/marker-choice-4B.png"),
        selected: require("../../../assets/map-markers/marker-choice-4B-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-4B-alt.png"),
    },
    "5A": {
        normal: require("../../../assets/map-markers/marker-choice-5A.png"),
        selected: require("../../../assets/map-markers/marker-choice-5A-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-5A-alt.png"),
    },
    "5B": {
        normal: require("../../../assets/map-markers/marker-choice-5B.png"),
        selected: require("../../../assets/map-markers/marker-choice-5B-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-5B-alt.png"),
    },
    "6A": {
        normal: require("../../../assets/map-markers/marker-choice-6A.png"),
        selected: require("../../../assets/map-markers/marker-choice-6A-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-6A-alt.png"),
    },
    "6B": {
        normal: require("../../../assets/map-markers/marker-choice-6B.png"),
        selected: require("../../../assets/map-markers/marker-choice-6B-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-6B-alt.png"),
    },
    "7A": {
        normal: require("../../../assets/map-markers/marker-choice-7A.png"),
        selected: require("../../../assets/map-markers/marker-choice-7A-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-7A-alt.png"),
    },
    "7B": {
        normal: require("../../../assets/map-markers/marker-choice-7B.png"),
        selected: require("../../../assets/map-markers/marker-choice-7B-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-7B-alt.png"),
    },
    "8A": {
        normal: require("../../../assets/map-markers/marker-choice-8A.png"),
        selected: require("../../../assets/map-markers/marker-choice-8A-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-8A-alt.png"),
    },
    "8B": {
        normal: require("../../../assets/map-markers/marker-choice-8B.png"),
        selected: require("../../../assets/map-markers/marker-choice-8B-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-8B-alt.png"),
    },
    "9A": {
        normal: require("../../../assets/map-markers/marker-choice-9A.png"),
        selected: require("../../../assets/map-markers/marker-choice-9A-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-9A-alt.png"),
    },
    "9B": {
        normal: require("../../../assets/map-markers/marker-choice-9B.png"),
        selected: require("../../../assets/map-markers/marker-choice-9B-selected.png"),
        alt: require("../../../assets/map-markers/marker-choice-9B-alt.png"),
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
