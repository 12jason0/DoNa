import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Share,
    Linking,
    Modal,
    Pressable,
    Animated,
    PanResponder,
    TextInput,
    Dimensions,
    Platform,
    KeyboardAvoidingView,
    BackHandler,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import Svg, { Path, Line, Circle } from "react-native-svg";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, endpoints, BASE_URL } from "../../../src/lib/api";
import { useAuth } from "../../../src/hooks/useAuth";
import { Colors } from "../../../src/constants/theme";
import { resolveImageUrl } from "../../../src/lib/imageUrl";
import type { PlaceStatus } from "../../../src/lib/placeStatus";
import { getPlaceOpenStatus, STATUS_COLOR, STATUS_BG } from "../../../src/lib/placeStatus";
import { useThemeColors } from "../../../src/hooks/useThemeColors";
import { useLocale } from "../../../src/lib/useLocale";
import PageLoadingOverlay from "../../../src/components/PageLoadingOverlay";
import LoginModal from "../../../src/components/LoginModal";
import TicketPlansSheet from "../../../src/components/TicketPlansSheet";
import AppHeaderWithModals from "../../../src/components/AppHeaderWithModals";
import { MODAL_ANDROID_PROPS } from "../../../src/constants/modalAndroidProps";
import { floatingTabBarBottomReserve } from "../../../src/constants/floatingTabBarInset";
import type { Course, UserProfile, ActiveCourse } from "../../../src/types/api";
import { parseTipsFromDbForLocale, type CoursePlaceTipsRow } from "../../../../src/types/tip";
import {
    translateCourseFreeformKoText,
    localizeParsedTipsForUi,
    type CourseUiLocale,
} from "../../../../src/lib/courseTranslate";

const MAP_PURPLE = "#5347AA";
const NAVER_BTN_GRAY = "#9ca3af";

// --- 코스 지도 핀 (iOS 안정성 위해 PNG 이미지 마커로 사용: 1~5) ---
const STEP_PIN_IMAGES: Record<number, { normal: number; selected: number }> = {
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

// 네이버 지도 네이티브 — Expo Go 미지원, 동적 require
let NaverMapView: any = null;
let NaverMapMarkerOverlay: any = null;
let NaverMapPolylineOverlay: any = null;
try {
    const NaverMap = require("@mj-studio/react-native-naver-map");
    NaverMapView = NaverMap.NaverMapView;
    NaverMapMarkerOverlay = NaverMap.NaverMapMarkerOverlay;
    NaverMapPolylineOverlay = NaverMap.NaverMapPolylineOverlay;
} catch {}

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface PlaceData {
    id?: number;
    name?: string;
    imageUrl?: string | null;
    image_url?: string | null;
    category?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    description?: string;
    opening_hours?: string | null;
    avg_cost_range?: string;
    phone?: string;
    parking_available?: boolean;
    reservation_required?: boolean;
    reservationUrl?: string | null;
    reservation_url?: string | null;
    maps_link?: string | null;
    mapUrl?: string | null;
}

interface CoursePlace {
    id?: number;
    place_id?: number;
    order_index?: number;
    order_in_segment?: number | null;
    estimated_duration?: number;
    recommended_time?: string;
    segment?: string | null;
    tips?: string | null;
    tips_en?: string | null;
    tips_ja?: string | null;
    tips_zh?: string | null;
    place?: PlaceData;
}

function coursePlaceToTipsRow(cp?: CoursePlace | null): CoursePlaceTipsRow {
    if (!cp) return { tips: null };
    return {
        tips: cp.tips ?? null,
        tips_en: cp.tips_en ?? null,
        tips_ja: cp.tips_ja ?? null,
        tips_zh: cp.tips_zh ?? null,
    };
}

interface CourseDetail extends Course {
    isSelectionType?: boolean;
    description?: string | null;
    coursePlaces?: CoursePlace[];
    sub_title?: string | null;
    target_situation?: string | null;
    budget_range?: string | null;
    transportation?: string;
    recommended_start_time?: string;
    highlights?: any[];
}

interface CourseReview {
    id: number;
    rating: number;
    content: string;
    createdAt: string;
    userName: string;
    profileImageUrl: string;
    imageUrls?: string[];
}

const GRADE_META: Record<string, { bg: string; text: string }> = {
    FREE: { bg: "#dcfce7", text: "#16a34a" },
    BASIC: { bg: "#dbeafe", text: "#1d4ed8" },
    PREMIUM: { bg: "#fef3c7", text: "#d97706" },
};

const SEGMENT_ORDER = ["brunch", "lunch", "dinner", "bar", "cafe"];
const SEGMENT_ICONS: Record<string, string> = { brunch: "🥐", lunch: "🍱", dinner: "🍽️", bar: "🍷", cafe: "☕" };

function placeOpenStatusLabel(i18n: (key: string) => string, status: PlaceStatus): string {
    if (status === "open") return i18n("courseDetail.placeStatusOpen");
    if (status === "closingSoon") return i18n("courseDetail.placeStatusClosingSoon");
    if (status === "closed") return i18n("courseDetail.placeStatusClosedToday");
    return "";
}

// ─── 도보 시간 계산 ────────────────────────────────────────────────────────────

function getWalkingMinutes(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const distM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.max(1, Math.round((distM * 1.4) / 80));
}

function getPlaceImageUrl(place?: PlaceData): string | undefined {
    if (!place) return undefined;
    const raw = place.imageUrl ?? place.image_url;
    return resolveImageUrl(raw);
}

function getPlaceLatLng(place?: PlaceData): { lat: number; lng: number } | null {
    if (!place) return null;
    const lat = Number(place.latitude ?? place.lat);
    const lng = Number(place.longitude ?? place.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

function getPlaceReservationUrl(place?: PlaceData): string | undefined {
    if (!place) return undefined;
    return place.reservationUrl ?? place.reservation_url ?? undefined;
}

function getPlaceMapUrl(place?: PlaceData): string {
    if (!place) return "https://map.naver.com";
    const direct = place.maps_link ?? place.mapUrl;
    if (direct) return direct;
    const coords = getPlaceLatLng(place);
    if (coords) return `https://map.naver.com/v5/search/${coords.lng},${coords.lat}`;
    const query = encodeURIComponent(place.name || place.address || "");
    return `https://map.naver.com/v5/search/${query}`;
}

function getRouteMapUrl(from?: PlaceData, to?: PlaceData, routeNames?: { origin: string; dest: string }): string {
    if (!from || !to) return getPlaceMapUrl(to ?? from);
    const f = getPlaceLatLng(from);
    const t = getPlaceLatLng(to);
    const fromName = encodeURIComponent(from.name || routeNames?.origin || "");
    const toName = encodeURIComponent(to.name || routeNames?.dest || "");
    if (f && t) {
        return `https://map.naver.com/index.nhn?slng=${f.lng}&slat=${f.lat}&stext=${fromName}&elng=${t.lng}&elat=${t.lat}&etext=${toName}&menu=route`;
    }
    return getPlaceMapUrl(to);
}

const TIP_ICON_SIZE = 18;
const TIP_ICON_COLOR = "#4b5563"; // gray-600, 실제 color prop으로 override됨

function TipCategoryIcon({ category, color }: { category: string; color: string }) {
    const s = TIP_ICON_SIZE;
    switch (category) {
        case "PARKING":
        case "PARKING_LOT":
            return <Svg width={s} height={s} viewBox="0 0 24 24" fill={color}><Path d="M6 3H13C16.3137 3 19 5.68629 19 9C19 12.3137 16.3137 15 13 15H8V21H6V3ZM8 5V13H13C15.2091 13 17 11.2091 17 9C17 6.79086 15.2091 5 13 5H8Z" /></Svg>;
        case "WALKING":
            return <Svg width={s} height={s} viewBox="0 0 24 24" fill={color}><Path d="M7.61713 8.71233L10.8222 6.38373C11.174 6.12735 11.6087 5.98543 12.065 6.0008C13.1764 6.02813 14.1524 6.75668 14.4919 7.82036C14.6782 8.40431 14.8481 8.79836 15.0017 9.0025C15.914 10.2155 17.3655 11 19.0002 11V13C16.8255 13 14.8825 12.0083 13.5986 10.4526L12.901 14.4085L14.9621 16.138L17.1853 22.246L15.3059 22.93L13.266 17.3256L9.87576 14.4808C9.32821 14.0382 9.03139 13.3192 9.16231 12.5767L9.67091 9.6923L8.99407 10.1841L6.86706 13.1116L5.24902 11.9361L7.60016 8.7L7.61713 8.71233ZM13.5002 5.5C12.3956 5.5 11.5002 4.60457 11.5002 3.5C11.5002 2.39543 12.3956 1.5 13.5002 1.5C14.6047 1.5 15.5002 2.39543 15.5002 3.5C15.5002 4.60457 14.6047 5.5 13.5002 5.5ZM10.5286 18.6813L7.31465 22.5116L5.78257 21.226L8.75774 17.6803L9.50426 15.5L11.2954 17L10.5286 18.6813Z" /></Svg>;
        case "SIGNATURE_MENU":
            return <Svg width={s} height={s} viewBox="0 0 24 24" fill={color}><Path d="M14.2683 12.1466L13.4147 13.0002L20.4858 20.0712L19.0716 21.4854L12.0005 14.4144L4.92946 21.4854L3.51525 20.0712L12.854 10.7324C12.2664 9.27549 12.8738 7.17715 14.4754 5.57554C16.428 3.62292 19.119 3.14805 20.4858 4.51488C21.8526 5.88172 21.3778 8.57267 19.4251 10.5253C17.8235 12.1269 15.7252 12.7343 14.2683 12.1466ZM4.22235 3.80777L10.9399 10.5253L8.11144 13.3537L4.22235 9.46463C2.66026 7.90253 2.66026 5.36987 4.22235 3.80777ZM18.0109 9.11107C19.2682 7.85386 19.5274 6.38488 19.0716 5.92909C18.6158 5.47331 17.1468 5.73254 15.8896 6.98975C14.6324 8.24697 14.3732 9.71595 14.829 10.1717C15.2847 10.6275 16.7537 10.3683 18.0109 9.11107Z" /></Svg>;
        case "RESTROOM":
            return <Svg width={s} height={s} viewBox="0 0 256 256" fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round"><Path d="M64,112V40a8,8,0,0,1,8-8H184a8,8,0,0,1,8,8v72" /><Line x1="96" y1="64" x2="112" y2="64" /><Path d="M216,112a88,88,0,0,1-176,0Z" /><Path d="M92.42,192.51l-4.34,30.36A8,8,0,0,0,96,232h64a8,8,0,0,0,7.92-9.13l-4.34-30.36" /></Svg>;
        case "WAITING":
            return <Svg width={s} height={s} viewBox="0 0 256 256" fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round"><Path d="M128,128,67.2,82.4A8,8,0,0,1,64,76V40a8,8,0,0,1,8-8H184a8,8,0,0,1,8,8V75.64A8,8,0,0,1,188.82,82L128,128h0" /><Path d="M128,128,67.2,173.6A8,8,0,0,0,64,180v36a8,8,0,0,0,8,8H184a8,8,0,0,0,8-8V180.36a8,8,0,0,0-3.18-6.38L128,128h0" /><Line x1="128" y1="168" x2="128" y2="128" /><Line x1="74.67" y1="88" x2="180.92" y2="88" /></Svg>;
        case "PHOTO_ZONE":
            return <Svg width={s} height={s} viewBox="0 0 256 256" fill={color}><Path d="M208,56H180.28L166.65,35.56A8,8,0,0,0,160,32H96a8,8,0,0,0-6.65,3.56L75.71,56H48A24,24,0,0,0,24,80V192a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V80A24,24,0,0,0,208,56Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8H80a8,8,0,0,0,6.66-3.56L100.28,48h55.43l13.63,20.44A8,8,0,0,0,176,72h32a8,8,0,0,1,8,8ZM128,88a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,88Zm0,72a28,28,0,1,1,28-28A28,28,0,0,1,128,160Z" /></Svg>;
        case "BEST_SPOT":
            return <Svg width={s} height={s} viewBox="0 0 256 256" fill={color}><Path d="M239.18,97.26A16.38,16.38,0,0,0,224.92,86l-59-4.76L143.14,26.15a16.36,16.36,0,0,0-30.27,0L90.11,81.23,31.08,86a16.46,16.46,0,0,0-9.37,28.86l45,38.83L53,211.75a16.38,16.38,0,0,0,24.5,17.82L128,198.49l50.53,31.08A16.4,16.4,0,0,0,203,211.75l-13.76-58.07,45-38.83A16.43,16.43,0,0,0,239.18,97.26Zm-15.34,5.47-48.7,42a8,8,0,0,0-2.56,7.91l14.88,62.8a.37.37,0,0,1-.17.48c-.18.14-.23.11-.38,0l-54.72-33.65a8,8,0,0,0-8.38,0L69.09,215.94c-.15.09-.19.12-.38,0a.37.37,0,0,1-.17-.48l14.88-62.8a8,8,0,0,0-2.56-7.91l-48.7-42c-.12-.1-.23-.19-.13-.5s.18-.27.33-.29l63.92-5.16A8,8,0,0,0,103,91.86l24.62-59.61c.08-.17.11-.25.35-.25s.27.08.35.25L153,91.86a8,8,0,0,0,6.75,4.92l63.92,5.16c.15,0,.24,0,.33.29S224,102.63,223.84,102.73Z" /></Svg>;
        case "ROUTE":
            return <Svg width={s} height={s} viewBox="0 0 256 256" fill={color}><Path d="M200,168a32.06,32.06,0,0,0-31,24H72a32,32,0,0,1,0-64h96a40,40,0,0,0,0-80H72a8,8,0,0,0,0,16h96a24,24,0,0,1,0,48H72a48,48,0,0,0,0,96h97a32,32,0,1,0,31-40Zm0,48a16,16,0,1,1,16-16A16,16,0,0,1,200,216Z" /></Svg>;
        case "ATTIRE":
            return <Svg width={s} height={s} viewBox="0 0 256 256" fill={color}><Path d="M241.57,171.2,141.33,96l23.46-17.6A8,8,0,0,0,168,72a40,40,0,1,0-80,0,8,8,0,0,0,16,0,24,24,0,0,1,47.69-3.78L123.34,89.49l-.28.21L14.43,171.2A16,16,0,0,0,24,200H232a16,16,0,0,0,9.6-28.8ZM232,184H24l104-78,104,78Z" /></Svg>;
        case "CAUTION":
            return <Svg width={s} height={s} viewBox="0 0 256 256" fill={color}><Path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z" /></Svg>;
        case "VIBE_CHECK":
            return <Svg width={s} height={s} viewBox="0 0 256 256" fill={color}><Path d="M56,96v64a8,8,0,0,1-16,0V96a8,8,0,0,1,16,0ZM88,24a8,8,0,0,0-8,8V224a8,8,0,0,0,16,0V32A8,8,0,0,0,88,24Zm40,32a8,8,0,0,0-8,8V192a8,8,0,0,0,16,0V64A8,8,0,0,0,128,56Zm40,32a8,8,0,0,0-8,8v64a8,8,0,0,0,16,0V96A8,8,0,0,0,168,88Zm40-16a8,8,0,0,0-8,8v96a8,8,0,0,0,16,0V80A8,8,0,0,0,208,72Z" /></Svg>;
        default: // ETC + GOOD_TO_KNOW
            return <Svg width={s} height={s} viewBox="0 0 256 256" fill={color}><Path d="M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Zm-16,0a72,72,0,0,0-73.74-72c-39,.92-70.47,33.39-70.26,72.39a71.65,71.65,0,0,0,27.64,56.3A32,32,0,0,1,96,186v6h64v-6a32.15,32.15,0,0,1,12.47-25.35A71.65,71.65,0,0,0,200,104Zm-16.11-9.34a57.6,57.6,0,0,0-46.56-46.55,8,8,0,0,0-2.66,15.78c16.57,2.79,30.63,16.85,33.44,33.45A8,8,0,0,0,176,104a9,9,0,0,0,1.35-.11A8,8,0,0,0,183.89,94.66Z" /></Svg>;
    }
}

async function uploadImageViaPresign(
    uri: string,
    courseId: string,
    err: { presign: string; putFail: string },
): Promise<string> {
    const filename = uri.split("/").pop() ?? "photo.jpg";
    const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
    const contentType = ext === "png" ? "image/png" : "image/jpeg";

    // 서버 설정 차이를 고려해 review -> memory 순으로 fallback
    const requestPresign = async (type: "review" | "memory") =>
        api.post<{ success: boolean; uploads: { uploadUrl: string; publicUrl: string }[] }>(
            "/api/upload/presign",
            { type, courseId: String(courseId), files: [{ filename, contentType, size: 0 }] },
        );

    let presignRes: { success: boolean; uploads: { uploadUrl: string; publicUrl: string }[] };
    try {
        presignRes = await requestPresign("review");
    } catch {
        presignRes = await requestPresign("memory");
    }

    if (!presignRes.success || !presignRes.uploads?.[0]) {
        throw new Error(err.presign);
    }

    const { uploadUrl, publicUrl } = presignRes.uploads[0];
    const blobRes = await fetch(uri);
    const blob = await blobRes.blob();
    const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": contentType },
    });
    if (!putRes.ok) throw new Error(err.putFail);
    return publicUrl;
}

function getNaverAppRouteUrl(place?: PlaceData, destinationFallback?: string): string | null {
    if (!place) return null;
    const c = getPlaceLatLng(place);
    if (!c) return null;
    const dname = encodeURIComponent(place.name || destinationFallback || "");
    // 네이버 지도 앱 딥링크: 현재 위치 -> 목적지 빠른 길찾기
    return `nmap://route/public?dlat=${c.lat}&dlng=${c.lng}&dname=${dname}&appname=kr.io.dona`;
}

/** expo-linear-gradient 없이 동작 (네이티브 미포함 시 ViewManagerAdapter 오류 방지) */
function HeroGradientOverlay() {
    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.1)" }]} />
            <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 260 }}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0)" }} />
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.1)" }} />
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.18)" }} />
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.32)" }} />
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.48)" }} />
            </View>
        </View>
    );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, icon, onHide }: { message: string; icon: string; onHide: () => void }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(16)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start();

        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 16, duration: 200, useNativeDriver: true }),
            ]).start(onHide);
        }, 1500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <Animated.View style={[s.toast, { opacity, transform: [{ translateY }] }]}>
            <Text style={s.toastIcon}>{icon}</Text>
            <Text style={s.toastText}>{message}</Text>
        </Animated.View>
    );
}

// ─── 장소 상세 모달 ────────────────────────────────────────────────────────────

function PlaceDetailModal({
    place,
    tipsRow,
    onClose,
    isLoggedIn,
}: {
    place: PlaceData;
    tipsRow: CoursePlaceTipsRow;
    onClose: () => void;
    isLoggedIn: boolean;
}) {
    const t = useThemeColors();
    const insets = useSafeAreaInsets();
    const tabBarReserve = floatingTabBarBottomReserve(insets.bottom);
    const { t: i18n, locale } = useLocale();
    const [reservationWebUrl, setReservationWebUrl] = useState<string | null>(null);
    const imageUri = getPlaceImageUrl(place);
    const reservationUrl = getPlaceReservationUrl(place);
    const status = getPlaceOpenStatus(place.opening_hours);
    const tipItems = useMemo(() => {
        const base = parseTipsFromDbForLocale(tipsRow, locale as CourseUiLocale);
        return localizeParsedTipsForUi(base, locale as CourseUiLocale, i18n);
    }, [tipsRow, locale, i18n]);
    const hasTips = tipItems.length > 0;
    const screenH = Dimensions.get("window").height;
    const translateY = useRef(new Animated.Value(screenH)).current;

    useEffect(() => {
        translateY.setValue(screenH);
        Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 68,
            friction: 12,
        }).start();
    }, [place.id]);

    const dismissWithSwipe = useCallback(() => {
        Animated.timing(translateY, {
            toValue: screenH,
            duration: 220,
            useNativeDriver: true,
        }).start(() => {
                onClose();
        });
    }, [onClose, screenH, translateY]);

    const imagePanResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: (_, g) =>
                    g.dy > 8 && g.dy > Math.abs(g.dx),
                onPanResponderMove: (_, g) => {
                    if (g.dy > 0) {
                        translateY.setValue(g.dy);
                    }
                },
                onPanResponderRelease: (_, g) => {
                    if (g.dy > 110 || g.vy > 1.0) {
                        dismissWithSwipe();
                    } else {
                        Animated.spring(translateY, {
                            toValue: 0,
                            useNativeDriver: true,
                            friction: 9,
                            tension: 80,
                        }).start();
                    }
                },
                onPanResponderTerminate: () => {
                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        friction: 9,
                        tension: 80,
                    }).start();
                },
            }),
        [dismissWithSwipe, translateY],
    );

    return (
        <Modal visible transparent animationType="none" onRequestClose={onClose} {...MODAL_ANDROID_PROPS}>
            <View style={s.placeModalOverlay}>
                <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
                <Animated.View
                    style={[
                        s.placeModalSheet,
                        {
                            backgroundColor: t.card,
                            borderColor: t.isDark ? "#374151" : "#f3f4f6",
                            marginBottom: tabBarReserve,
                            height: Math.min(screenH * 0.85, screenH - tabBarReserve - 24),
                            transform: [{ translateY }],
                        },
                    ]}
                >
                    {/* 이미지·핸들 영역: 아래로 드래그 시 시트 닫기 · 텍스트는 ScrollView에서만 스크롤 */}
                    <View
                        style={[s.detailImgWrap, { flexShrink: 0 }]}
                        collapsable={false}
                        {...imagePanResponder.panHandlers}
                    >
                        {imageUri ? (
                            <Image source={{ uri: imageUri }} style={s.detailImgWeb} resizeMode="cover" />
                        ) : (
                            <View
                                style={[
                                    s.detailImgWeb,
                                    { backgroundColor: t.surface, alignItems: "center", justifyContent: "center" },
                                ]}
                            >
                                <Text style={{ fontSize: 40 }}>📍</Text>
                            </View>
                        )}
                        <View style={s.detailImgGradient} pointerEvents="none">
                            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0)" }} />
                            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.12)" }} />
                            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.28)" }} />
                            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} />
                        </View>
                        <View style={s.detailHandleOnImg}>
                            <View style={s.detailHandleBarWeb} />
                        </View>
                        <View style={s.detailImgOverlayWeb} pointerEvents="none">
                            <Text style={s.detailImgNameWeb} numberOfLines={2}>
                                {place.name}
                            </Text>
                        </View>
                    </View>

                    <ScrollView
                        style={{ flex: 1, flexGrow: 1, minHeight: 120 }}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 }}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                        bounces
                        keyboardShouldPersistTaps="handled"
                    >
                        <Text style={[s.detailScrollTitle, { color: t.text }]}>{place.name}</Text>

                        <View style={{ marginBottom: 10 }}>
                            {status !== "unknown" ? (
                                <View style={[s.detailStatusBadge, { backgroundColor: STATUS_BG[status] }]}>
                                    <Text style={[s.detailStatusText, { color: STATUS_COLOR[status] }]}>
                                        {placeOpenStatusLabel(i18n, status)}
                                    </Text>
                                </View>
                            ) : null}
                        </View>

                        {place.address ? (
                            <Text style={[s.detailAddressWeb, { color: t.textMuted }]} numberOfLines={2}>
                                {place.address}
                            </Text>
                        ) : null}

                        <Text style={[s.detailDescWeb, { color: t.isDark ? "#d1d5db" : "#4b5563" }]}>
                            {place.description?.trim() ? place.description : i18n("courseDetail.noDescription")}
                        </Text>

                        {isLoggedIn && hasTips ? (
                            <View
                                style={[
                                    s.placeTipSection,
                                    {
                                        backgroundColor: t.isDark ? "rgba(6,78,59,0.2)" : "#ecfdf5",
                                        borderColor: t.isDark ? "#065f46" : "#a7f3d0",
                                    },
                                ]}
                            >
                                {/* 헤더 */}
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 }}>
                                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={t.isDark ? "#6ee7b7" : "#047857"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </Svg>
                                    <Text style={[s.placeTipSectionLabel, { color: t.isDark ? "#6ee7b7" : "#047857", marginBottom: 0 }]}>
                                        Dona's Pick
                                    </Text>
                                </View>
                                {/* 팁 목록 */}
                                {tipItems.map((tip, i) => (
                                    <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: i < tipItems.length - 1 ? 8 : 0 }}>
                                        <View style={{ marginTop: 1 }}>
                                            <TipCategoryIcon category={tip.category} color={t.isDark ? "#9ca3af" : "#4b5563"} />
                                        </View>
                                        <Text style={[s.placeTipSectionBody, { color: t.text, flex: 1 }]}>{tip.content}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}

                        {!isLoggedIn ? (
                            <TouchableOpacity
                                style={[
                                    s.detailTipBanner,
                                    { borderColor: t.border, backgroundColor: t.surface, marginHorizontal: 0 },
                                ]}
                                onPress={() => {
                                    onClose();
                                    router.push("/(auth)/login" as any);
                                }}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="lock-closed-outline" size={20} color={t.textMuted} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.detailTipBannerTitle, { color: t.text }]}>
                                        {i18n("mobile.courseScreen.tipsLoginTitle")}
                                    </Text>
                                    <Text style={[s.detailTipBannerSub, { color: t.textMuted }]}>
                                        {i18n("mobile.courseScreen.tipsLoginSub")}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
                            </TouchableOpacity>
                        ) : null}

                        {reservationUrl ? (
                            <TouchableOpacity
                                style={s.detailReserveBtnWeb}
                                onPress={() => setReservationWebUrl(reservationUrl)}
                                activeOpacity={0.9}
                            >
                                <Ionicons name="open-outline" size={18} color="#fff" />
                                <Text style={s.detailReserveBtnWebText}>
                                    {status === "closed" ? i18n("explore.reserveOtherDay") : i18n("explore.reserve")}
                                </Text>
                            </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity style={s.detailCloseTextBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8 }}>
                            <Text style={[s.detailCloseTextWeb, { color: t.textMuted }]}>{i18n("courseDetail.justClose")}</Text>
                        </TouchableOpacity>
                    </ScrollView>

                    {/* 인앱 예약 WebView */}
                    {reservationWebUrl ? (
                        <View
                            style={[
                                StyleSheet.absoluteFillObject,
                                {
                                    backgroundColor: t.card,
                                    borderTopLeftRadius: 20,
                                    borderTopRightRadius: 20,
                                    overflow: "hidden",
                                },
                            ]}
                        >
                            <View style={[s.reserveWebHeader, { borderBottomColor: t.border, backgroundColor: t.card }]}>
                                <TouchableOpacity
                                    onPress={() => setReservationWebUrl(null)}
                                    hitSlop={10}
                                    style={s.reserveWebBackBtn}
                                >
                                    <Ionicons name="chevron-down" size={22} color={t.text} />
                                </TouchableOpacity>
                                <Text style={[s.reserveWebTitle, { color: t.text }]} numberOfLines={1}>
                                    {i18n("mobile.courseScreen.reserveWithName", { name: place.name || i18n("mobile.courseScreen.placeFallback") })}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => Linking.openURL(reservationWebUrl)}
                                    hitSlop={10}
                                    style={s.reserveWebBackBtn}
                                >
                                    <Ionicons name="open-outline" size={19} color={t.textMuted} />
                                </TouchableOpacity>
                            </View>
                            <WebView
                                source={{ uri: reservationWebUrl }}
                                style={{ flex: 1 }}
                                javaScriptEnabled
                                domStorageEnabled
                                allowsInlineMediaPlayback
                                startInLoadingState
                                renderLoading={() => (
                                    <View
                                        style={[
                                            StyleSheet.absoluteFillObject,
                                            { alignItems: "center", justifyContent: "center", backgroundColor: t.card },
                                        ]}
                                    >
                                        <ActivityIndicator color="#7aa06f" />
                                    </View>
                                )}
                            />
                        </View>
                    ) : null}
                </Animated.View>
            </View>
        </Modal>
    );
}

// ─── 네이버 지도 HTML 빌더 ──────────────────────────────────────────────────────

const NAVER_MAP_CLIENT_ID = "4gfc00t72p";

function buildNaverMapHtml(
    places: CoursePlace[],
    selectedIndex: number | null,
    routeMode: "full" | "segment",
    routeCoords: { lat: number; lng: number }[] | undefined,
    unnamedPlace: (index: number) => string,
): string {
    const placeData = places.map((cp, i) => {
        const p = cp.place;
        if (!p) return { idx: i, name: "", lat: null, lng: null };
        const lat = Number(p.latitude ?? p.lat);
        const lng = Number(p.longitude ?? p.lng);
        return {
            idx: i,
            name: p.name || unnamedPlace(i + 1),
            lat: Number.isFinite(lat) ? lat : null,
            lng: Number.isFinite(lng) ? lng : null,
        };
    });

    const placesJson = JSON.stringify(placeData);
    const selIdxStr = selectedIndex === null ? "null" : String(selectedIndex);
    const routeModeStr = JSON.stringify(routeMode);
    const routeCoordsJson = routeCoords ? JSON.stringify(routeCoords) : "null";

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; background:#e5e7eb; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var PLACES = ${placesJson};
    var SELECTED = ${selIdxStr};
    var ROUTE_MODE = ${routeModeStr};
    var ROUTE_COORDS = ${routeCoordsJson};

    function postMsg(msg) {
      try { window.ReactNativeWebView.postMessage(msg); } catch(e) {}
    }

    function initMap() {
      var nm = window.naver.maps;
      var validPlaces = PLACES.filter(function(p) { return p.lat !== null && p.lng !== null; });

      var center;
      if (SELECTED !== null && PLACES[SELECTED] && PLACES[SELECTED].lat !== null) {
        center = new nm.LatLng(PLACES[SELECTED].lat, PLACES[SELECTED].lng);
      } else if (validPlaces.length > 0) {
        var sLat = 0, sLng = 0;
        validPlaces.forEach(function(p) { sLat += p.lat; sLng += p.lng; });
        center = new nm.LatLng(sLat / validPlaces.length, sLng / validPlaces.length);
      } else {
        center = new nm.LatLng(37.5665, 126.978);
      }

      var map = new nm.Map('map', {
        center: center,
        zoom: 14,
        mapTypeControl: false,
        scaleControl: false,
        logoControl: true,
        mapDataControl: false,
        zoomControl: false,
      });

      nm.Event.addListener(map, 'click', function() { postMsg('mapClick'); });

      var showAll = ROUTE_MODE === 'full' || SELECTED === null || SELECTED === 0;
      PLACES.forEach(function(place, idx) {
        if (place.lat === null || place.lng === null) return;
        // 세그먼트 모드: 해당 구간 핀(prev, current)만 표시
        if (!showAll && idx !== SELECTED - 1 && idx !== SELECTED) return;
        var isSel = SELECTED !== null && idx === SELECTED;
        var bg = isSel ? '#5347AA' : '#99c08e';
        var sz = isSel ? '40px' : '30px';
        var fs = isSel ? '15px' : '13px';
        var border = isSel ? '3px solid #fff' : '2px solid rgba(255,255,255,0.6)';
        var anchor = isSel ? 20 : 15;

        var content = '<div style="width:' + sz + ';height:' + sz + ';border-radius:50%;background:' + bg + ';color:#fff;font-weight:700;font-size:' + fs + ';display:flex;align-items:center;justify-content:center;border:' + border + ';box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:pointer;">' + (idx + 1) + '</div>';

        var marker = new nm.Marker({
          position: new nm.LatLng(place.lat, place.lng),
          map: map,
          icon: { content: content, anchor: new nm.Point(anchor, anchor) },
          zIndex: isSel ? 100 : 10,
        });

        (function(i) {
          nm.Event.addListener(marker, 'click', function(e) {
            if (e && e.domEvent) try { e.domEvent.stopPropagation(); } catch(ex) {}
            postMsg('placeClick:' + i);
          });
        })(idx);
      });

      var pathPts = [];
      if (ROUTE_COORDS && ROUTE_COORDS.length >= 2) {
        pathPts = ROUTE_COORDS.map(function(c) { return new nm.LatLng(c.lat, c.lng); });
      } else if (ROUTE_MODE === 'full') {
        pathPts = validPlaces.map(function(p) { return new nm.LatLng(p.lat, p.lng); });
      } else if (SELECTED !== null && SELECTED > 0) {
        var from = PLACES[SELECTED - 1];
        var to = PLACES[SELECTED];
        if (from && from.lat !== null && to && to.lat !== null) {
          pathPts = [new nm.LatLng(from.lat, from.lng), new nm.LatLng(to.lat, to.lng)];
        }
      }

      if (pathPts.length >= 2) {
        new nm.Polyline({
          map: map,
          path: pathPts,
          strokeColor: '#99c08e',
          strokeWeight: 5,
          strokeOpacity: 0.9,
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
        });
      }

      // 뷰 맞추기
      if (ROUTE_MODE === 'full' && validPlaces.length > 1) {
        var bounds = new nm.LatLngBounds();
        validPlaces.forEach(function(p) { bounds.extend(new nm.LatLng(p.lat, p.lng)); });
        try { map.fitBounds(bounds, { top: 50, right: 40, bottom: 180, left: 40 }); } catch(e) {}
      } else if (ROUTE_MODE !== 'full' && pathPts.length >= 2) {
        var b2 = new nm.LatLngBounds();
        pathPts.forEach(function(pt) { b2.extend(pt); });
        try { map.fitBounds(b2, { top: 80, right: 60, bottom: 200, left: 60 }); } catch(e) {}
      } else if (SELECTED !== null && PLACES[SELECTED] && PLACES[SELECTED].lat !== null) {
        map.setCenter(new nm.LatLng(PLACES[SELECTED].lat, PLACES[SELECTED].lng));
        map.setZoom(16);
      }
    }

    var s = document.createElement('script');
    s.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_MAP_CLIENT_ID}';
    s.onload = initMap;
    document.head.appendChild(s);
  </script>
</body>
</html>`;
}

// ─── 코스 지도 모달 ─────────────────────────────────────────────────────────────

function CourseMapModal({
    visible,
    places,
    selectedIndex,
    routeMode,
    onSelectIndex,
    onResetRoute,
    onClose,
    onOpenDetail,
    onReserve,
}: {
    visible: boolean;
    places: CoursePlace[];
    selectedIndex: number | null;
    routeMode: "full" | "segment";
    onSelectIndex: (idx: number) => void;
    onResetRoute: () => void;
    onClose: () => void;
    onOpenDetail: (place: PlaceData, tipsRow: CoursePlaceTipsRow) => void;
    onReserve: (url: string) => void;
}) {
    const t = useThemeColors();
    const { t: i18n } = useLocale();
    const safeIndex =
        selectedIndex !== null ? Math.max(0, Math.min(selectedIndex, Math.max(0, places.length - 1))) : null;
    const current = safeIndex !== null ? places[safeIndex]?.place : null;
    const prev = safeIndex !== null && safeIndex > 0 ? places[safeIndex - 1]?.place : undefined;
    const effectiveRouteMode = safeIndex === null ? "full" : routeMode;
    const currentImage = getPlaceImageUrl(current ?? undefined);
    const routeLabel =
        effectiveRouteMode === "full"
            ? i18n("mobile.courseScreen.mapFullRoute")
            : prev && current
              ? (() => {
                    const a = getPlaceLatLng(prev);
                    const b = getPlaceLatLng(current);
                    if (!a || !b) return i18n("mobile.courseScreen.mapSegmentRoute");
                    const minutes = getWalkingMinutes(a.lat, a.lng, b.lat, b.lng);
                    return i18n("mobile.courseScreen.mapSegmentWalk", {
                        from: String(safeIndex),
                        to: String((safeIndex ?? 0) + 1),
                        minutes,
                    });
                })()
              : i18n("mobile.courseScreen.mapSegmentRoute");

    const sheetH = Math.round(Dimensions.get("window").height * 0.75);

    // 네이티브 지도 카메라 위치
    const mapCamera = useMemo(() => {
        // 세그먼트 모드: 이전 핀과 현재 핀 사이 중간점
        if (safeIndex !== null && safeIndex > 0) {
            const prevP = places[safeIndex - 1]?.place;
            const currP = places[safeIndex]?.place;
            const lat1 = Number(prevP?.latitude ?? prevP?.lat);
            const lng1 = Number(prevP?.longitude ?? prevP?.lng);
            const lat2 = Number(currP?.latitude ?? currP?.lat);
            const lng2 = Number(currP?.longitude ?? currP?.lng);
            if (Number.isFinite(lat1) && Number.isFinite(lng1) && Number.isFinite(lat2) && Number.isFinite(lng2)) {
                return { latitude: (lat1 + lat2) / 2, longitude: (lng1 + lng2) / 2, zoom: 14 };
            }
        }
        // 전체 경로 or 1번 핀: 모든 장소 평균 중심
        const valid = places.filter((cp) => {
            const lat = Number(cp.place?.latitude ?? cp.place?.lat);
            const lng = Number(cp.place?.longitude ?? cp.place?.lng);
            return Number.isFinite(lat) && Number.isFinite(lng);
        });
        if (valid.length > 0) {
            const avgLat = valid.reduce((s, cp) => s + Number(cp.place?.latitude ?? cp.place?.lat), 0) / valid.length;
            const avgLng = valid.reduce((s, cp) => s + Number(cp.place?.longitude ?? cp.place?.lng), 0) / valid.length;
            return { latitude: avgLat, longitude: avgLng, zoom: 13 };
        }
        return { latitude: 37.5665, longitude: 126.978, zoom: 12 };
    }, [safeIndex, places]);

    // 도로 경로 좌표 (directions API)
    const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
    const [routeCoordsRaw, setRouteCoordsRaw] = useState<{ lat: number; lng: number }[]>([]);

    useEffect(() => {
        if (!visible) return;

        const getPoints = () => {
            const toC = (p: any) => {
                const lat = Number(p?.latitude ?? p?.lat);
                const lng = Number(p?.longitude ?? p?.lng);
                return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
            };
            if (effectiveRouteMode === "full") {
                return places.map((cp) => toC(cp.place)).filter(Boolean) as { lat: number; lng: number }[];
            }
            if (safeIndex !== null && safeIndex > 0) {
                const from = toC(places[safeIndex - 1]?.place);
                const to = toC(places[safeIndex]?.place);
                if (from && to) return [from, to];
            }
            return [];
        };

        const points = getPoints();
        if (points.length < 2) { setRouteCoords([]); setRouteCoordsRaw([]); return; }

        const coordsParam = points.map((p) => `${p.lng},${p.lat}`).join(";");
        fetch(`${BASE_URL}/api/directions?coords=${coordsParam}&mode=driving`)
            .then((r) => r.json())
            .then((data) => {
                if (data?.coordinates?.length >= 2) {
                    const coords = data.coordinates.map(([lng, lat]: number[]) => ({ latitude: lat, longitude: lng }));
                    const raw = data.coordinates.map(([lng, lat]: number[]) => ({ lat, lng }));
                    setRouteCoords(coords);
                    setRouteCoordsRaw(raw);
                } else {
                    const fallback = points.map((p) => ({ latitude: p.lat, longitude: p.lng }));
                    setRouteCoords(fallback);
                    setRouteCoordsRaw(points);
                }
            })
            .catch(() => {
                const fallback = points.map((p) => ({ latitude: p.lat, longitude: p.lng }));
                setRouteCoords(fallback);
                setRouteCoordsRaw(points);
            });
    }, [visible, safeIndex, effectiveRouteMode, places]);

    // Android: Modal + NaverMapView/WebView(Surface) 조합에서 네이티브 크래시 가능 → 전체 화면 오버레이만 사용
    useEffect(() => {
        if (Platform.OS !== "android" || !visible) return;
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            onClose();
            return true;
        });
        return () => sub.remove();
    }, [visible, onClose]);

    const mapChrome = (
            <View style={[s.courseMapModalRoot, Platform.OS === "android" && { backgroundColor: "rgba(0,0,0,0.6)" }]}>
                <Pressable
                    style={s.courseMapBackdropWeb}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel={i18n("mobile.courseScreen.closeA11y")}
                />
                <View
                    style={[
                        s.courseMapSheetWeb,
                        { height: sheetH, backgroundColor: t.card, borderColor: t.isDark ? "#374151" : "#f3f4f6" },
                    ]}
                >
                    <View style={[s.courseMapGrabWeb, { backgroundColor: t.isDark ? "#4b5563" : "#d1d5db" }]} />
                    <View style={[s.courseMapHeader, { borderBottomColor: t.border }]}>
                        <View style={s.mapHeaderRow}>
                            {/* 전체 경로 버튼 */}
                            <View style={s.mapStepRow}>
                                {places.map((_, idx) => {
                                    const selected = selectedIndex !== null && idx === safeIndex;
                                    return (
                                        <View key={`step-${idx}`} style={s.mapStepItem}>
                                            <TouchableOpacity
                                                onPress={() => onSelectIndex(idx)}
                                                style={[
                                                    s.mapStepCircle,
                                                    selected ? s.mapStepCircleSelectedWeb : s.mapStepCircleIdleWeb,
                                                ]}
                                                activeOpacity={0.85}
                                            >
                                                <Text style={s.mapStepTextWeb}>{idx + 1}</Text>
                                            </TouchableOpacity>
                                            {idx < places.length - 1 ? <Text style={s.mapStepArrow}>→</Text> : null}
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    </View>

                    {/* 지도 + 하단 정보 오버레이 */}
                    <View style={{ flex: 1 }}>
                        {NaverMapView ? (
                            <NaverMapView
                                style={{ flex: 1 }}
                                camera={mapCamera}
                                isNightModeEnabled={t.isDark}
                                mapType="Basic"
                                isShowZoomControls={false}
                                onTapMap={onResetRoute}
                            >
                                {places.map((cp, idx) => {
                                    const p = cp.place;
                                    const lat = Number(p?.latitude ?? p?.lat);
                                    const lng = Number(p?.longitude ?? p?.lng);
                                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                                    // 세그먼트 모드: 해당 구간(prev, current)만 표시
                                    if (effectiveRouteMode === "segment" && safeIndex !== null && safeIndex > 0) {
                                        if (idx !== safeIndex - 1 && idx !== safeIndex) return null;
                                    }
                                    const isSel = safeIndex === idx;
                                    // 생성된 step 핀 PNG는 34/68/102 스케일(정사각) 기반
                                    const pinW = isSel ? 42 : 34;
                                    const pinH = isSel ? 42 : 34;
                                    const stepNo = idx + 1;
                                    const stepImgs = STEP_PIN_IMAGES[stepNo] ?? null;
                                    const markerImg = stepImgs ? (isSel ? stepImgs.selected : stepImgs.normal) : undefined;
                                    return (
                                        <NaverMapMarkerOverlay
                                            key={`m-${idx}-${isSel ? "1" : "0"}`}
                                            latitude={lat}
                                            longitude={lng}
                                            image={markerImg}
                                            width={pinW}
                                            height={pinH}
                                            anchor={{ x: 0.5, y: 1.0 }}
                                            onTap={() => onSelectIndex(idx)}
                                            zIndex={isSel ? 100 : 10}
                                        />
                                    );
                                })}
                                {routeCoords.length >= 2 && NaverMapPolylineOverlay && (
                                    <NaverMapPolylineOverlay
                                        coords={routeCoords}
                                        width={5}
                                        color="#5347AA"
                                        joinType={1}
                                        capType={1}
                                    />
                                )}
                            </NaverMapView>
                        ) : (
                            <WebView
                                key={safeIndex !== null ? `nmap-${safeIndex}-${effectiveRouteMode}` : "nmap-full"}
                                source={{
                                    html: buildNaverMapHtml(
                                        places,
                                        safeIndex,
                                        effectiveRouteMode,
                                        routeCoordsRaw.length >= 2 ? routeCoordsRaw : undefined,
                                        (n) => i18n("courseDetail.unnamedPlace", { n }),
                                    ),
                                    baseUrl: "https://dona.io.kr",
                                }}
                                style={s.courseMapWebView}
                                javaScriptEnabled
                                originWhitelist={["*"]}
                                onMessage={(event) => {
                                    const msg = event.nativeEvent.data;
                                    if (msg === "mapClick") {
                                        onResetRoute();
                                    } else if (msg.startsWith("placeClick:")) {
                                        const idx = parseInt(msg.split(":")[1], 10);
                                        if (!isNaN(idx) && idx >= 0 && idx < places.length) {
                                            onSelectIndex(idx);
                                        }
                                    }
                                }}
                            />
                        )}

                        {/* 하단 장소 정보 (지도 위 절대 오버레이, 웹과 동일) */}
                        {current ? (
                            <View style={[s.mapBottomSheet, { backgroundColor: t.card }]}>
                                <View style={s.mapBottomTop}>
                                    {currentImage ? (
                                        <Image source={{ uri: currentImage }} style={s.mapBottomThumb} />
                                    ) : (
                                        <View
                                            style={[
                                                s.mapBottomThumb,
                                                {
                                                    backgroundColor: t.surface,
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                },
                                            ]}
                                        >
                                            <Text>📍</Text>
                                        </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                        <Text style={[s.mapBottomTitle, { color: t.text }]} numberOfLines={1}>
                                            {current.name || i18n("mobile.courseScreen.placeFallback")}
                                        </Text>
                                        <Text style={[s.mapBottomSub, { color: t.textMuted }]} numberOfLines={1}>
                                            {routeLabel}
                                        </Text>
                                        <Text style={[s.mapBottomAddr, { color: t.textMuted }]} numberOfLines={1}>
                                            {current.address || ""}
                                        </Text>
                                    </View>
                                    {/* X 버튼: 전체 경로로 리셋 */}
                                    <TouchableOpacity
                                        onPress={onResetRoute}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="close" size={24} color={t.textSubtle} />
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    style={[s.mapPrimaryBtn, { backgroundColor: NAVER_BTN_GRAY }]}
                                    onPress={() => {
                                        const appRoute = getNaverAppRouteUrl(current, i18n("courseDetail.destinationFallback"));
                                        const webUrl = getPlaceMapUrl(current);
                                        if (appRoute) {
                                            Linking.openURL(appRoute).catch(() => Linking.openURL(webUrl));
                                            return;
                                        }
                                        Linking.openURL(webUrl);
                                    }}
                                    activeOpacity={0.88}
                                >
                                    <Ionicons name="map-outline" size={16} color="#fff" />
                                    <Text style={s.mapPrimaryBtnText}>{i18n("courseDetail.navigation")}</Text>
                                </TouchableOpacity>
                                <View style={s.mapActionRow}>
                                    <TouchableOpacity
                                        style={[s.mapDarkBtn, { flex: 1 }]}
                                        onPress={() =>
                                            onOpenDetail(
                                                current,
                                                safeIndex !== null
                                                    ? coursePlaceToTipsRow(places[safeIndex])
                                                    : { tips: null },
                                            )
                                        }
                                    >
                                        <Text style={s.mapDarkBtnText}>{i18n("courseDetail.viewDetail")}</Text>
                                    </TouchableOpacity>
                                    {getPlaceReservationUrl(current) ? (
                                        <TouchableOpacity
                                            style={[s.mapLightBtn, { flex: 1 }]}
                                            onPress={() => {
                                                const url = getPlaceReservationUrl(current);
                                                if (url) onReserve(url);
                                            }}
                                        >
                                            <Text style={s.mapLightBtnText}>{i18n("explore.reserve")}</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            </View>
                        ) : null}
                    </View>
                </View>
            </View>
    );

    if (Platform.OS === "android") {
        if (!visible) return null;
        return (
            <View
                style={[StyleSheet.absoluteFillObject, s.courseMapAndroidOverlay]}
                pointerEvents="box-none"
            >
                {mapChrome}
            </View>
        );
    }

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            {mapChrome}
        </Modal>
    );
}

// ─── 장소 카드 ─────────────────────────────────────────────────────────────────

function PlaceCard({
    cp,
    index,
    onPress,
    isSelected,
    onReserve,
}: {
    cp: CoursePlace;
    index: number;
    onPress: () => void;
    isSelected: boolean;
    onReserve: (url: string) => void;
}) {
    const t = useThemeColors();
    const { t: i18n, locale } = useLocale();
    const p = cp.place;
    if (!p) return null;

    const status = getPlaceOpenStatus(p.opening_hours);
    const imageUri = getPlaceImageUrl(p);
    const rec = cp.recommended_time?.trim();
    const subText = rec
        ? translateCourseFreeformKoText(rec, locale as CourseUiLocale, i18n)
        : p.address || null;
    const tipsRow: CoursePlaceTipsRow = {
        tips: cp.tips,
        tips_en: cp.tips_en,
        tips_ja: cp.tips_ja,
        tips_zh: cp.tips_zh,
    };
    const hasTips = parseTipsFromDbForLocale(tipsRow, locale as CourseUiLocale).length > 0;

    return (
        // 웹: [number circle (외부)] [flex-1 content]
        <View style={s.placeRow}>
            {/* 번호 (웹과 동일: 카드 바깥 왼쪽) */}
            <View style={s.placeNum}>
                <Text style={s.placeNumText}>{index + 1}</Text>
            </View>

            {/* 카드 (웹: bg-white/95 rounded-xl p-4 border) */}
            <TouchableOpacity
                style={[
                    s.placeCard,
                    {
                        borderColor: isSelected ? "#22c55e" : t.isDark ? "rgba(55,65,81,0.4)" : "rgba(255,255,255,0.4)",
                        borderWidth: isSelected ? 2 : 1,
                        backgroundColor: t.isDark ? "rgba(26,36,27,0.98)" : "rgba(255,255,255,0.95)",
                    },
                ]}
                onPress={onPress}
                activeOpacity={0.85}
            >
                <View style={s.placeCardRow}>
                    {/* 썸네일 (웹: w-20 h-20 = 80px) */}
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} style={s.placeThumb} resizeMode="cover" />
                    ) : (
                        <View
                            style={[
                                s.placeThumb,
                                { backgroundColor: t.surface, alignItems: "center", justifyContent: "center" },
                            ]}
                        >
                            <Text style={{ fontSize: 20 }}>📍</Text>
                        </View>
                    )}

                    <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
                        {/* 카테고리 · 영업 (웹: text-[10px] font-bold text-gray-400 uppercase) */}
                        <View style={s.placeBadgeRow}>
                            {p.category ? (
                                <Text style={[s.catText, { color: t.textMuted }]}>{p.category.toUpperCase()}</Text>
                            ) : null}
                            {status !== "unknown" && (
                                <View style={[s.statusBadge, { backgroundColor: STATUS_BG[status] }]}>
                                    <Text style={[s.statusBadgeText, { color: STATUS_COLOR[status] }]}>
                                        {placeOpenStatusLabel(i18n, status)}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* 이름 (웹: font-bold text-sm) */}
                        <Text style={[s.placeName, { color: t.text }]} numberOfLines={1}>
                            {p.name}
                        </Text>

                        {/* 주소 or 추천시간 (웹: text-xs text-gray-500) */}
                        {subText ? (
                            <Text style={[s.placeSubText, { color: t.textMuted }]} numberOfLines={1}>
                                {subText}
                            </Text>
                        ) : null}

                        {/* 예약 버튼 (웹: inline-flex bg-emerald-500 text-white text-[11px] px-3 py-1.5) */}
                        {getPlaceReservationUrl(p) ? (
                            <TouchableOpacity
                                style={s.reserveBtn}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    const url = getPlaceReservationUrl(p);
                                    if (url) onReserve(url);
                                }}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                                <View style={s.reserveBtnInner}>
                                    <Text style={s.reserveBtnText}>
                                        {status === "closed" ? i18n("explore.reserveInAdvance") : i18n("explore.reserve")}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                {/* 꿀팁 (웹: ✨ 꿀팁 헤더 + 카테고리 칩) */}
                {hasTips ? (
                    <View style={s.tipRow}>
                        <Text style={s.tipLabel}>{i18n("mobile.courseScreen.tipSectionLabel")}</Text>
                        <View style={s.tipChip}>
                            <Text style={s.tipChipText}>{i18n("mobile.courseScreen.tipViewInfo")}</Text>
                        </View>
                    </View>
                ) : null}
            </TouchableOpacity>
        </View>
    );
}

// ─── 도보 커넥터 ───────────────────────────────────────────────────────────────

function WalkingConnector({ minutes }: { minutes: number }) {
    const { t: i18n } = useLocale();
    return (
        <View style={s.walkConnector}>
            <View style={s.walkLine} />
            <View style={s.walkBadge}>
                <Ionicons name="walk-outline" size={11} color="#6b7280" />
                <Text style={s.walkText}>{i18n("courseDetail.walkingMinutes", { minutes })}</Text>
            </View>
            <View style={s.walkLine} />
        </View>
    );
}


// ─── 메인 화면 ────────────────────────────────────────────────────────────────

export default function CourseDetailScreen() {
    const t = useThemeColors();
    const { t: i18n, locale } = useLocale();
    const screenBg = t.isDark ? "#0f1710" : "#F8F9FA";
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams<{ id: string }>();
    const queryClient = useQueryClient();
    const { isAuthenticated } = useAuth();
    const [isFav, setIsFav] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [showMemoryLimitModal, setShowMemoryLimitModal] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState<{
        place: PlaceData;
        tipsRow: CoursePlaceTipsRow;
    } | null>(null);
    const [toast, setToast] = useState<{ message: string; icon: string; id: number } | null>(null);
    const toastIdRef = useRef(0);
    const showToast = useCallback((message: string, icon: string) => {
        toastIdRef.current += 1;
        setToast({ message, icon, id: toastIdRef.current });
    }, []);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewShowCount, setReviewShowCount] = useState(5);
    const [reviewPreviewImages, setReviewPreviewImages] = useState<string[]>([]);
    const [reviewPreviewIndex, setReviewPreviewIndex] = useState(0);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewContent, setReviewContent] = useState("");
    const [reviewImageLocalUri, setReviewImageLocalUri] = useState<string | null>(null);
    const [reviewImageUrl, setReviewImageUrl] = useState<string | null>(null);
    const [reviewUploadingImage, setReviewUploadingImage] = useState(false);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [showCourseMapModal, setShowCourseMapModal] = useState(false);
    const [mapSelectedIndex, setMapSelectedIndex] = useState<number | null>(null);
    const [screenReservationUrl, setScreenReservationUrl] = useState<string | null>(null);
    const [mapRouteMode, setMapRouteMode] = useState<"full" | "segment">("full");
    const [activePlaceIndex, setActivePlaceIndex] = useState<number | null>(null);
    // 선택형 코스
    const [mySelection, setMySelection] = useState<{
        id: string; templateCourseId: number; selectedPlaceIds: number[]; createdAt: string;
    } | null>(null);
    const [selectionLoading, setSelectionLoading] = useState(false);
    const [showSelectionUI, setShowSelectionUI] = useState(false);
    const [selectedBySegment, setSelectedBySegment] = useState<Record<string, number>>({});

    const { data: profile } = useQuery<UserProfile>({
        queryKey: ["profile"],
        queryFn: () => api.get<UserProfile>(endpoints.profile),
        retry: false,
    });

    const { data: activeCourse } = useQuery<ActiveCourse | null>({
        queryKey: ["users", "active-course"],
        queryFn: () => api.get<ActiveCourse | null>(endpoints.activeCourse).catch(() => null),
        enabled: isAuthenticated,
        staleTime: 1000 * 60 * 2,
    });

    const {
        data: course,
        isLoading,
        isError,
    } = useQuery<CourseDetail>({
        queryKey: ["course", id],
        queryFn: () => api.get<CourseDetail>(endpoints.course(id!)),
        enabled: !!id,
    });

    const { data: favList } = useQuery<any[]>({
        queryKey: ["favorites"],
        queryFn: () => api.get<any[]>(endpoints.favorites),
        retry: false,
    });

    const {
        data: reviews = [],
        isFetching: reviewsLoading,
        refetch: refetchReviews,
    } = useQuery<CourseReview[]>({
        queryKey: ["courseReviews", id],
        queryFn: async () => {
            const data = await api.get<any[]>(`/api/reviews?courseId=${id}`);
            if (!Array.isArray(data)) return [];
            return data.map((r: any) => ({
                id: Number(r.id),
                rating: Number(r.rating ?? 0),
                content: String(r.comment ?? ""),
                createdAt: String(r.createdAt ?? ""),
                userName: String(r.user?.nickname ?? ""),
                profileImageUrl: String(r.user?.profileImageUrl ?? ""),
            }));
        },
        enabled: !!id,
    });

    React.useEffect(() => {
        if (!favList) return;
        const ids = new Set(favList.map((f: any) => Number(f?.course?.id ?? f?.course_id ?? f?.courseId ?? f?.id)));
        setIsFav(ids.has(Number(id)));
    }, [favList, id]);

    // ── 선택형 코스 데이터 ──────────────────────────────────────────────────────
    const normalizedPlacesAll = useMemo(() => {
        const sorted = [...(course?.coursePlaces ?? [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        return sorted.map((cp) => {
            if (!cp.place) return cp;
            return {
                ...cp,
                place: {
                    ...cp.place,
                    imageUrl: cp.place.imageUrl ?? cp.place.image_url ?? null,
                    latitude: cp.place.latitude ?? cp.place.lat,
                    longitude: cp.place.longitude ?? cp.place.lng,
                    reservationUrl: cp.place.reservationUrl ?? cp.place.reservation_url ?? null,
                },
            };
        });
    }, [course?.coursePlaces]);

    const placesBySegment = useMemo(() => {
        const map: Record<string, CoursePlace[]> = {};
        for (const cp of normalizedPlacesAll) {
            const seg = cp.segment ?? "";
            if (!seg) continue;
            if (!map[seg]) map[seg] = [];
            map[seg].push(cp);
        }
        for (const seg of Object.keys(map)) {
            map[seg].sort((a, b) => (a.order_in_segment ?? 0) - (b.order_in_segment ?? 0));
        }
        return map;
    }, [normalizedPlacesAll]);

    const selectionOrderedSteps = useMemo(() => {
        if (!course?.isSelectionType) return [];
        const steps: ({ type: "fixed"; coursePlace: CoursePlace } | { type: "segment"; segment: string; options: CoursePlace[] })[] = [];
        const seenSeg = new Set<string>();
        for (const cp of normalizedPlacesAll) {
            const seg = cp.segment ?? "";
            if (!seg) {
                steps.push({ type: "fixed", coursePlace: cp });
            } else if (!seenSeg.has(seg)) {
                seenSeg.add(seg);
                steps.push({ type: "segment", segment: seg, options: placesBySegment[seg] ?? [] });
            }
        }
        return steps;
    }, [course?.isSelectionType, normalizedPlacesAll, placesBySegment]);

    // 저장된 선택이 있으면 해당 장소만 표시
    const displayPlaces = useMemo(() => {
        if (!course?.isSelectionType || !mySelection) return normalizedPlacesAll;
        return mySelection.selectedPlaceIds
            .map((pid) => normalizedPlacesAll.find((cp) => Number(cp.place_id) === Number(pid)))
            .filter(Boolean) as CoursePlace[];
    }, [course?.isSelectionType, mySelection, normalizedPlacesAll]);

    // 선택형 초기값 세팅
    useEffect(() => {
        if (!course?.isSelectionType || selectionOrderedSteps.length === 0) return;
        if (mySelection && showSelectionUI) {
            const next: Record<string, number> = {};
            selectionOrderedSteps.forEach((step, i) => {
                if (step.type === "segment") next[step.segment] = mySelection!.selectedPlaceIds[i] ?? step.options[0]?.place_id ?? 0;
            });
            setSelectedBySegment(next);
            return;
        }
        if (!mySelection) {
            const next: Record<string, number> = {};
            selectionOrderedSteps.forEach((step) => {
                if (step.type === "segment" && step.options[0]?.place_id) next[step.segment] = step.options[0].place_id;
            });
            setSelectedBySegment(next);
        }
    }, [course?.isSelectionType, showSelectionUI, mySelection, selectionOrderedSteps]);

    // 기존 선택 불러오기
    useEffect(() => {
        if (!isAuthenticated || !id || !course?.isSelectionType) return;
        let cancelled = false;
        api.get<{ selection: { id: string; templateCourseId: number; selectedPlaceIds: number[]; createdAt: string } | null }>(
            `/api/courses/${id}/my-selection`
        ).then((data) => {
            if (!cancelled && data?.selection) setMySelection(data.selection);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [isAuthenticated, id, course?.isSelectionType]);

    const favMutation = useMutation({
        mutationFn: async (adding: boolean) => {
            if (adding) await api.post(endpoints.favorites, { courseId: Number(id) });
            else await api.delete(`${endpoints.favorites}?courseId=${id}`);
        },
        onMutate: (adding) => setIsFav(adding),
        onError: (_err, adding) => setIsFav(!adding),
        onSuccess: (_data, adding) => {
            queryClient.invalidateQueries({ queryKey: ["favorites"] });
            queryClient.invalidateQueries({ queryKey: ["users", "favorites"] });
            queryClient.invalidateQueries({ queryKey: ["users", "favorites", "header-badge"] });
            showToast(adding ? i18n("mobile.courseScreen.favAdded") : i18n("mobile.courseScreen.favRemoved"), adding ? "❤️" : "✓");
        },
    });

    const shareInFlightRef = useRef(false);
    const handleShare = useCallback(async () => {
        if (!course || shareInFlightRef.current) return;
        shareInFlightRef.current = true;
        try {
            const message = i18n("mobile.courseScreen.shareMessage", {
                title: course.title,
                url: `${BASE_URL}/courses/${id}/view`,
            });
            // iOS에서 message + url 동시 전달 시 링크가 두 번 붙는 경우가 있어 단일 필드만 사용
            await Share.share(
                Platform.OS === "ios"
                    ? { message }
                    : { message, title: course.title },
            );
        } catch {
            // 사용자가 시트를 닫은 경우 등 — 무시
        } finally {
            setTimeout(() => {
                shareInFlightRef.current = false;
            }, 800);
        }
    }, [course, id, i18n]);

    const handleStartCourse = useCallback(async () => {
        if (!isAuthenticated) {
            setShowLoginModal(true);
            return;
        }
        if (!course) return;
        const userTier = profile?.subscriptionTier ?? (profile as any)?.subscription_tier ?? "FREE";
        const isLocked =
            (course.grade === "BASIC" && userTier === "FREE") || (course.grade === "PREMIUM" && userTier !== "PREMIUM");
        if (isLocked) {
            setShowTicketModal(true);
            return;
        }
        try {
            await api.post(endpoints.activeCourse, { courseId: Number(id) });
        } catch {
            Alert.alert(i18n("mobile.courseScreen.alertNotice"), i18n("mobile.courseScreen.startCourseFailed"));
            return;
        }
        await queryClient.invalidateQueries({ queryKey: ["users", "active-course"] });
        router.push("/(tabs)" as any);
    }, [isAuthenticated, course, id, profile, queryClient, i18n]);

    // 선택형 코스: 장소 선택 후 저장
    const handleStartSelectionCourse = useCallback(async () => {
        if (!isAuthenticated) { setShowLoginModal(true); return; }
        if (!course) return;
        const userTier = profile?.subscriptionTier ?? (profile as any)?.subscription_tier ?? "FREE";
        const isLocked = (course.grade === "BASIC" && userTier === "FREE") || (course.grade === "PREMIUM" && userTier !== "PREMIUM");
        if (isLocked) { setShowTicketModal(true); return; }
        const selectedPlaceIds = selectionOrderedSteps
            .map((step) => step.type === "fixed" ? step.coursePlace.place_id : selectedBySegment[step.segment])
            .filter((pid): pid is number => pid != null && pid > 0);
        if (selectedPlaceIds.length !== selectionOrderedSteps.length) {
            showToast(i18n("courseDetail.selectEachSegment"), "ℹ️");
            return;
        }
        setSelectionLoading(true);
        try {
            const data = await api.post<{ success?: boolean; selection?: { id: string; templateCourseId: number; selectedPlaceIds: number[] } }>(
                `/api/courses/${id}/my-selection`,
                { selectedPlaceIds }
            );
            if (data?.success && data?.selection) {
                setMySelection({ ...data.selection, createdAt: new Date().toISOString() });
                setShowSelectionUI(false);
                await api.post(endpoints.activeCourse, { courseId: Number(id) });
                await queryClient.invalidateQueries({ queryKey: ["users", "active-course"] });
                showToast(i18n("courseDetail.courseSavedToast"), "✅");
                router.push("/(tabs)" as any);
            } else {
                showToast(i18n("mobile.courseScreen.saveFailedToast"), "❌");
            }
        } catch {
            showToast(i18n("mobile.courseScreen.saveFailedToast"), "❌");
        } finally {
            setSelectionLoading(false);
        }
    }, [isAuthenticated, course, id, profile, selectionOrderedSteps, selectedBySegment, showToast, queryClient, i18n]);

    const handleMemoryRecord = useCallback(async () => {
        if (!isAuthenticated) { setShowLoginModal(true); return; }
        try {
            const data = await api.get<{ count: number; limit: number | null }>("/api/users/me/memory-count");
            if (data.limit !== null && data.count >= data.limit) {
                setShowMemoryLimitModal(true);
                return;
            }
        } catch {}
        router.push(`/courses/${id}/start` as any);
    }, [isAuthenticated, id]);

    const handleSwitchCourse = useCallback(() => {
        Alert.alert(
            i18n("mobile.courseScreen.switchCourseTitle"),
            i18n("mobile.courseScreen.switchCourseMessage"),
            [
                { text: i18n("mobile.courseScreen.cancel"), style: "cancel" },
                {
                    text: i18n("mobile.courseScreen.switchCourseConfirm"),
                    onPress: async () => {
                        try {
                            await api.post(endpoints.activeCourse, { courseId: Number(id) });
                        } catch {
                            Alert.alert(i18n("mobile.courseScreen.alertNotice"), i18n("mobile.courseScreen.switchCourseFailed"));
                            return;
                        }
                        await queryClient.invalidateQueries({ queryKey: ["users", "active-course"] });
                        router.push("/(tabs)" as any);
                    },
                },
            ],
        );
    }, [id, queryClient, i18n]);

    const handleSubmitReview = useCallback(async () => {
        if (!id) return;
        const content = reviewContent.trim();
        if (content.length < 5) {
            Alert.alert(i18n("mobile.courseScreen.alertNotice"), i18n("mobile.courseScreen.reviewMinLength"));
            return;
        }
        setReviewSubmitting(true);
        try {
            await api.post("/api/reviews", {
                courseId: Number(id),
                rating: reviewRating,
                content,
                isPublic: true,
                imageUrls: reviewImageUrl ? [reviewImageUrl] : [],
            });
            setShowReviewModal(false);
            setReviewContent("");
            setReviewRating(5);
            setReviewImageLocalUri(null);
            setReviewImageUrl(null);
            showToast(i18n("mobile.courseScreen.reviewPosted"), "✅");
            refetchReviews();
        } catch (e: any) {
            Alert.alert(i18n("mobile.courseScreen.reviewSubmitFailTitle"), e?.message ?? i18n("mobile.courseScreen.tryAgainLater"));
        } finally {
            setReviewSubmitting(false);
        }
    }, [id, reviewContent, reviewRating, reviewImageUrl, refetchReviews, showToast, i18n]);

    const handlePickReviewImage = useCallback(async () => {
        if (!id) return;
        try {
            const ImagePicker = require("expo-image-picker");
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert(i18n("mobile.courseScreen.permRequired"), i18n("mobile.courseScreen.permPhotos"));
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: false,
                quality: 0.85,
            });
            if (result.canceled || !result.assets?.[0]?.uri) return;

            const localUri = result.assets[0].uri;
            setReviewImageLocalUri(localUri);
            setReviewUploadingImage(true);
            try {
                const uploaded = await uploadImageViaPresign(localUri, String(id), {
                    presign: i18n("courseStart.presignUrlError"),
                    putFail: i18n("courseStart.imageUploadPutError"),
                });
                setReviewImageUrl(uploaded);
            } catch (e: any) {
                setReviewImageLocalUri(null);
                setReviewImageUrl(null);
                Alert.alert(i18n("mobile.courseScreen.imageUploadFailTitle"), e?.message ?? i18n("mobile.courseScreen.tryAgainLater"));
            } finally {
                setReviewUploadingImage(false);
            }
        } catch {
            Alert.alert(i18n("mobile.courseScreen.alertNotice"), i18n("mobile.courseScreen.imagePickerBuildOnly"));
        }
    }, [id, i18n]);

    if (isLoading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={["top"]}>
                <PageLoadingOverlay overlay={false} message={i18n("mobile.courseScreen.loadingCourse")} />
            </SafeAreaView>
        );
    }

    if (isError || !course) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={["top"]}>
                <TouchableOpacity style={{ marginTop: insets.top + 12, padding: 16 }} onPress={() => router.back()}>
                    <Text style={{ color: Colors.brandGreen, fontWeight: "500" }}>{i18n("mobile.courseScreen.backArrow")}</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: t.textMuted }}>{i18n("mobile.courseScreen.courseLoadError")}</Text>
                </View>
            </SafeAreaView>
        );
    }

    const grade = GRADE_META[course.grade] ?? GRADE_META.FREE;
    const normalizedPlaces = normalizedPlacesAll;
    const regionLabel = (course as any).location ?? course.region ?? i18n("explore.regionSeoul");
    const heroImage = resolveImageUrl(course.imageUrl) ?? getPlaceImageUrl(normalizedPlaces[0]?.place);
    const openMapForIndex = (idx: number) => {
        setActivePlaceIndex(idx);
        setMapSelectedIndex(idx);
        setMapRouteMode(idx === 0 ? "full" : "segment");
        setShowCourseMapModal(true);
    };
    const openFullRouteMap = () => {
        setActivePlaceIndex(0);
        setMapSelectedIndex(0);
        setMapRouteMode("full");
        setShowCourseMapModal(true);
    };
    /** 하단 CTA 바 위로 띄운 고정 FAB (대략: 패딩 + 버튼열 높이) */
    const mapFabBottom = insets.bottom + 88;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={["top"]}>
            <AppHeaderWithModals />
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* ── 히어로 (웹 CourseDetailClient: h-[450px], 그라데이션, 제목·메타는 히어로 하단) ── */}
                <View style={s.heroWrap}>
                    {heroImage ? (
                        <Image source={{ uri: heroImage }} style={s.heroImg} />
                    ) : (
                        <View style={[s.heroImg, { backgroundColor: "#e5e7eb" }]} />
                    )}
                    <HeroGradientOverlay />
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={[s.heroBackBtn, { top: 12, left: 14 }]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="chevron-back" size={28} color="#fff" style={s.heroBackIconShadow} />
                    </TouchableOpacity>

                    {/* 히어로 하단: 상황·예산 칩 + 제목 + 메타 칩 (웹과 동일 구조) */}
                    <View style={[s.heroFooter, { paddingBottom: 28 }]}>
                        <View style={s.heroChipRowTop}>
                            {course.target_situation ? (
                                <View style={s.heroChipDark}>
                                    <Text style={s.heroChipDarkText}>
                                        #{course.target_situation === "SOME" ? i18n("mobile.courseScreen.targetSome") : course.target_situation}
                                    </Text>
                                </View>
                            ) : null}
                            {course.budget_range ? (
                                <View style={s.heroChipDark}>
                                    <Text style={s.heroChipDarkText}>💸 {course.budget_range}</Text>
                                </View>
                            ) : null}
                        </View>

                        <Text style={s.heroTitle} numberOfLines={3}>
                            {course.title}
                        </Text>
                        {course.sub_title ? (
                            <Text style={s.heroSubTitle} numberOfLines={2}>
                                {course.sub_title}
                            </Text>
                        ) : null}

                        <View style={s.heroMetaRow}>
                            <View style={s.heroMetaPill}>
                                <Text style={s.heroMetaPillText}>📍 {regionLabel}</Text>
                            </View>
                            <View style={s.heroMetaPill}>
                                <Text style={s.heroMetaPillText}>
                                    {i18n("mobile.courseScreen.metaSpotsCount", { count: normalizedPlaces.length })}
                                </Text>
                            </View>
                            {course.duration ? (
                                <View style={s.heroMetaPill}>
                                    <Text style={s.heroMetaPillText}>⏳ {course.duration}</Text>
                                </View>
                            ) : null}
                            {course.rating != null && course.rating > 0 ? (
                                <View style={s.heroMetaPill}>
                                    <Text style={s.heroMetaPillText}>
                                        <Text style={{ color: "#facc15" }}>★</Text> {course.rating}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </View>

                {/* ── 메인 카드: 히어로와 겹침 (웹: rounded-2xl bg-white shadow-sm border) ── */}
                <View style={s.mainOuter}>
                    <View
                        style={[s.mainCard, { backgroundColor: t.card, borderColor: t.isDark ? "#374151" : "#f3f4f6" }]}
                    >
                        {/* ── 선택형 코스: 첫 방문 또는 "코스 수정" 시 ── */}
                        {course.isSelectionType && selectionOrderedSteps.length > 0 && (!mySelection || showSelectionUI) && (
                            <View style={{ gap: 16 }}>
                                {selectionOrderedSteps.map((step, stepIdx) => {
                                    // 이전 해결된 장소 좌표 계산
                                    const getPrevLatLng = (): { lat: number; lng: number } | null => {
                                        for (let i = stepIdx - 1; i >= 0; i--) {
                                            const s = selectionOrderedSteps[i];
                                            if (s.type === "fixed") {
                                                const c = getPlaceLatLng(s.coursePlace.place);
                                                if (c) return c;
                                            } else {
                                                const sel = s.options.find((o) => Number(o.place_id) === Number(selectedBySegment[s.segment]));
                                                const c = getPlaceLatLng(sel?.place);
                                                if (c) return c;
                                            }
                                        }
                                        return null;
                                    };
                                    const prev = getPrevLatLng();

                                    if (step.type === "fixed") {
                                        const cp = step.coursePlace;
                                        const prevCoords = prev;
                                        const curCoords = getPlaceLatLng(cp.place);
                                        const walkMins = prevCoords && curCoords
                                            ? getWalkingMinutes(prevCoords.lat, prevCoords.lng, curCoords.lat, curCoords.lng)
                                            : null;
                                        return (
                                            <View key={`fixed-${cp.id ?? stepIdx}`}>
                                                {walkMins != null && <WalkingConnector minutes={walkMins} />}
                                                <View style={s.selStepRow}>
                                                    <View style={s.selStepNum}>
                                                        <Text style={s.selStepNumText}>{stepIdx + 1}</Text>
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <PlaceCard
                                                            cp={cp}
                                                            index={stepIdx}
                                                            onPress={() => cp.place && setSelectedPlace({ place: cp.place, tipsRow: coursePlaceToTipsRow(cp) })}
                                                            isSelected={!!(selectedPlace?.place?.id === cp.place?.id)}
                                                            onReserve={(url) => setScreenReservationUrl(url)}
                                                        />
                                                        <View style={s.confirmedBadge}>
                                                            <Text style={s.confirmedBadgeText}>✓ {i18n("courseDetail.confirmed")}</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    }

                                    // 세그먼트 선택 카드
                                    const { segment: seg, options } = step;
                                    const selectedId = selectedBySegment[seg];
                                    const selectedOpt = options.find((o) => Number(o.place_id) === Number(selectedId));
                                    const walkMins = prev && getPlaceLatLng(selectedOpt?.place)
                                        ? getWalkingMinutes(prev.lat, prev.lng, getPlaceLatLng(selectedOpt!.place)!.lat, getPlaceLatLng(selectedOpt!.place)!.lng)
                                        : null;

                                    return (
                                        <View key={`seg-${seg}`}>
                                            {walkMins != null && <WalkingConnector minutes={walkMins} />}
                                            <View style={s.selStepRow}>
                                                <View style={[s.selStepNum, { backgroundColor: "#b5d5aa" }]}>
                                                    <Text style={s.selStepNumText}>{stepIdx + 1}</Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={s.selSegLabel}>
                                                        {i18n("mobile.courseScreen.segmentChoose", {
                                                            label: `${SEGMENT_ICONS[seg] ?? "📍"} ${i18n(`courseDetail.segment.${seg}`) || seg}`,
                                                        })}
                                                    </Text>
                                                    <Text style={[s.selSegPrompt, { color: t.textMuted }]}>
                                                        {i18n("courseDetail.selectSegmentPrompt")}
                                                    </Text>
                                                    {/* 가로 스크롤 후보 카드 */}
                                                    <ScrollView
                                                        horizontal
                                                        showsHorizontalScrollIndicator={false}
                                                        contentContainerStyle={s.selCandidateScroll}
                                                    >
                                                        {options.map((cp) => {
                                                            const isChosen = Number(cp.place_id) === Number(selectedId);
                                                            const imgUri = getPlaceImageUrl(cp.place);
                                                            return (
                                                                <TouchableOpacity
                                                                    key={cp.id ?? cp.place_id}
                                                                    onPress={() => setSelectedBySegment((prev) => ({ ...prev, [seg]: cp.place_id! }))}
                                                                    activeOpacity={0.85}
                                                                    style={[
                                                                        s.candidateCard,
                                                                        {
                                                                            borderColor: isChosen ? "#22c55e" : t.isDark ? "#374151" : "#d1d5db",
                                                                            borderWidth: isChosen ? 2 : 1,
                                                                            backgroundColor: t.isDark ? "#1a241b" : "#fff",
                                                                        },
                                                                    ]}
                                                                >
                                                                    {/* 썸네일 */}
                                                                    <View style={s.candidateImgWrap}>
                                                                        {imgUri ? (
                                                                            <Image source={{ uri: imgUri }} style={s.candidateImg} resizeMode="cover" />
                                                                        ) : (
                                                                            <View style={[s.candidateImg, { backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }]}>
                                                                                <Text style={{ fontSize: 22 }}>📍</Text>
                                                                            </View>
                                                                        )}
                                                                        {isChosen && (
                                                                            <View style={s.candidateCheckBadge}>
                                                                                <Text style={{ fontSize: 10, color: "#fff", fontWeight: "500" }}>✓</Text>
                                                                            </View>
                                                                        )}
                                                                    </View>
                                                                    {/* 텍스트 */}
                                                                    <View style={s.candidateInfo}>
                                                                        <Text style={[s.candidateName, { color: t.text }]} numberOfLines={2}>{cp.place?.name}</Text>
                                                                        <Text style={[s.candidateSub, { color: t.textMuted }]} numberOfLines={1}>
                                                                            {cp.recommended_time?.trim()
                                                                                ? translateCourseFreeformKoText(
                                                                                      cp.recommended_time,
                                                                                      locale as CourseUiLocale,
                                                                                      i18n,
                                                                                  )
                                                                                : cp.place?.address}
                                                                        </Text>
                                                                    </View>
                                                                    {/* 정보 버튼 */}
                                                                    <TouchableOpacity
                                                                        style={[s.candidateInfoBtn, { borderTopColor: t.isDark ? "#374151" : "#e5e7eb" }]}
                                                                        onPress={() => cp.place && setSelectedPlace({ place: cp.place, tipsRow: coursePlaceToTipsRow(cp) })}
                                                                        hitSlop={6}
                                                                    >
                                                                        <Text style={s.candidateInfoBtnText}>💡 {i18n("courseDetail.infoShort")}</Text>
                                                                    </TouchableOpacity>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </ScrollView>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {/* ── 장소 목록: 일반 코스 or 저장된 선택형 ── */}
                        {(!course.isSelectionType || selectionOrderedSteps.length === 0 || mySelection) && !showSelectionUI && (
                            <View style={{ gap: 8 }}>
                                {mySelection && course.isSelectionType && (
                                    <TouchableOpacity
                                        onPress={() => setShowSelectionUI(true)}
                                        style={s.editSelectionBtn}
                                    >
                                        <Text style={s.editSelectionBtnText}>{i18n("courseDetail.editCourse")}</Text>
                                    </TouchableOpacity>
                                )}
                                {displayPlaces.map((cp, i) => {
                                    const a = i > 0 ? displayPlaces[i - 1]?.place : null;
                                    const b = cp.place;
                                    const walkMins = a?.latitude && a?.longitude && b?.latitude && b?.longitude
                                        ? getWalkingMinutes(a.latitude, a.longitude, b.latitude, b.longitude)
                                        : null;
                                    return (
                                        <React.Fragment key={i}>
                                            {walkMins != null ? <WalkingConnector minutes={walkMins} /> : null}
                                            <PlaceCard
                                                cp={cp}
                                                index={i}
                                                onPress={() => cp.place && setSelectedPlace({ place: cp.place, tipsRow: coursePlaceToTipsRow(cp) })}
                                                isSelected={!!(selectedPlace && selectedPlace.place?.id === cp.place?.id)}
                                                onReserve={(url) => setScreenReservationUrl(url)}
                                            />
                                        </React.Fragment>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                </View>

                {/* ── 리뷰 섹션 (웹: rounded-2xl border p-6) ── */}
                <View
                    style={[
                        s.reviewSection,
                        {
                            backgroundColor: t.isDark ? "rgba(26,36,27,0.85)" : "#f9fafb",
                            borderColor: t.isDark ? "#374151" : "#e5e7eb",
                        },
                    ]}
                >
                    <View style={s.reviewHeader}>
                        <Text style={[s.reviewSectionTitle, { color: t.text }]}>
                            {i18n("mobile.courseScreen.reviewsHeading")}{" "}
                            {reviews.length > 0 ? (
                                <Text style={{ color: "#10b981" }}>{reviews.length}</Text>
                            ) : null}
                        </Text>
                        <TouchableOpacity style={s.reviewWriteBtn} onPress={() => setShowReviewModal(true)}>
                            <Text style={s.reviewWriteBtnText}>{i18n("mobile.courseScreen.reviewWrite")}</Text>
                        </TouchableOpacity>
                    </View>
                    {reviewsLoading ? (
                        <Text style={[s.reviewEmpty, { color: t.textMuted }]}>{i18n("mobile.courseScreen.reviewsLoading")}</Text>
                    ) : reviews.length === 0 ? null : (
                        <View style={{ gap: 12 }}>
                            {reviews.slice(0, reviewShowCount).map((item) => (
                                <View
                                    key={item.id}
                                    style={[s.reviewCard, { backgroundColor: t.isDark ? "rgba(26,36,27,0.5)" : "#f9fafb" }]}
                                >
                                    <View style={s.reviewTop}>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                            <Image
                                                source={{ uri: item.profileImageUrl || "https://d13xx6k6chk2in.cloudfront.net/profileLogo.png" }}
                                                style={s.reviewAvatar}
                                            />
                                            <Text style={[s.reviewUser, { color: t.text }]}>
                                                {item.userName.trim() ? item.userName : i18n("mobile.courseScreen.anonymous")}
                                            </Text>
                                        </View>
                                        <Text style={[s.reviewDate, { color: t.textMuted }]}>
                                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                                        </Text>
                                    </View>
                                    {item.rating > 0 ? (
                                        <View style={{ flexDirection: "row", gap: 2, marginBottom: 8 }}>
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Text
                                                    key={star}
                                                    style={{
                                                        fontSize: 13,
                                                        color: star <= item.rating ? "#facc15" : t.isDark ? "#374151" : "#e5e7eb",
                                                    }}
                                                >
                                                    ★
                                                </Text>
                                            ))}
                                        </View>
                                    ) : null}
                                    <Text style={[s.reviewContent, { color: t.isDark ? "#d1d5db" : "#4b5563" }]}>
                                        {item.content}
                                    </Text>
                                    {item.imageUrls && item.imageUrls.length > 0 && (
                                        <View style={s.reviewImgGrid}>
                                            {item.imageUrls.map((uri, idx) => (
                                                <TouchableOpacity
                                                    key={idx}
                                                    activeOpacity={0.85}
                                                    onPress={() => {
                                                        setReviewPreviewImages(item.imageUrls!);
                                                        setReviewPreviewIndex(idx);
                                                    }}
                                                >
                                                    <Image source={{ uri }} style={s.reviewImgThumb} resizeMode="cover" />
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            ))}
                            {reviews.length > reviewShowCount && (
                                <TouchableOpacity
                                    onPress={() => setReviewShowCount((c) => c + 5)}
                                    style={[s.reviewMoreBtn, { borderColor: t.border }]}
                                >
                                    <Text style={[s.reviewMoreBtnText, { color: t.textMuted }]}>
                                        {i18n("mobile.courseScreen.showMoreReviews", { n: reviews.length - reviewShowCount })}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                <View style={{ height: insets.bottom + 110 }} />
            </ScrollView>

            {/* 우하단 고정 지도 FAB (스크롤과 무관하게 CTA 바 위에 고정) */}
            {normalizedPlaces.length > 0 ? (
                <TouchableOpacity
                    style={[s.mapFabFixed, { bottom: mapFabBottom }]}
                    onPress={openFullRouteMap}
                    activeOpacity={0.88}
                    accessibilityLabel={i18n("mobile.courseScreen.mapFabA11y")}
                >
                    <Ionicons name="location" size={22} color="#fff" />
                </TouchableOpacity>
            ) : null}

            {/* ── 하단 CTA 바 ────────────────────────────────────────────── */}
            <View
                style={[
                    s.ctaBar,
                    { backgroundColor: t.card, borderTopColor: t.border, paddingBottom: insets.bottom + 12 },
                ]}
            >
                {/* 찜하기 */}
                <TouchableOpacity
                    style={[s.ctaIconBtn, { borderColor: t.border }]}
                    onPress={() => {
                        if (!isAuthenticated) { setShowLoginModal(true); return; }
                        if (favMutation.isPending) return;
                        favMutation.mutate(!isFav);
                    }}
                >
                    <Ionicons
                        name={isFav ? "heart" : "heart-outline"}
                        size={16}
                        color={isFav ? "#ef4444" : t.textMuted}
                    />
                    <Text style={[s.ctaIconLabel, { color: isFav ? "#ef4444" : t.textMuted }]}>{i18n("courseDetail.favorite")}</Text>
                </TouchableOpacity>
                {/* 공유하기 */}
                <TouchableOpacity style={[s.ctaIconBtn, { borderColor: t.border }]} onPress={handleShare}>
                    <Ionicons name="share-outline" size={20} color={t.textMuted} />
                    <Text style={[s.ctaIconLabel, { color: t.textMuted }]}>{i18n("courseDetail.share")}</Text>
                </TouchableOpacity>
                {/* 코스 CTA — 3가지 상태 */}
                {isAuthenticated && activeCourse?.courseId === Number(id) ? (
                    <View style={{ flex: 1 }}>
                        <Text style={[s.ctaStatusText, { color: t.textMuted }]}>{i18n("mobile.courseScreen.inProgressThisCourse")}</Text>
                        <TouchableOpacity style={[s.ctaMainBtn, { minHeight: 46, paddingVertical: 10 }]} onPress={handleMemoryRecord} activeOpacity={0.85}>
                            <Text style={s.ctaMainBtnText}>{i18n("mobile.courseScreen.memoryRecordPersonal")}</Text>
                        </TouchableOpacity>
                    </View>
                ) : isAuthenticated && activeCourse && activeCourse.courseId !== Number(id) ? (
                    <View style={{ flex: 1 }}>
                        <Text style={[s.ctaStatusText, { color: t.textMuted }]}>{i18n("mobile.courseScreen.alreadyOtherCourse")}</Text>
                        <TouchableOpacity style={[s.ctaMainBtn, { minHeight: 46, paddingVertical: 10, backgroundColor: "#374151" }]} onPress={handleSwitchCourse} activeOpacity={0.85}>
                            <Text style={s.ctaMainBtnText}>{i18n("mobile.courseScreen.switchOtherCourse")}</Text>
                        </TouchableOpacity>
                    </View>
                ) : course?.isSelectionType && selectionOrderedSteps.length > 0 && (!mySelection || showSelectionUI) ? (
                    // 선택형 코스: 장소 선택 후 저장
                    <TouchableOpacity
                        style={[s.ctaMainBtn, selectionLoading && { opacity: 0.7 }]}
                        onPress={handleStartSelectionCourse}
                        disabled={selectionLoading}
                        activeOpacity={0.85}
                    >
                        {selectionLoading
                            ? <ActivityIndicator size="small" color="#fff" />
                            : (
                                <Text style={s.ctaMainBtnText}>
                                    {mySelection ? i18n("mobile.courseScreen.saveSelection") : i18n("courseDetail.startCourse")}
                                </Text>
                            )
                        }
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={s.ctaMainBtn} onPress={handleStartCourse} activeOpacity={0.85}>
                        <Text style={s.ctaMainBtnText}>{i18n("courseDetail.startCourse")}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* 장소 상세 모달 */}
            {selectedPlace && (
                <PlaceDetailModal
                    place={selectedPlace.place}
                    tipsRow={selectedPlace.tipsRow}
                    onClose={() => setSelectedPlace(null)}
                    isLoggedIn={!!profile}
                />
            )}

            <CourseMapModal
                visible={showCourseMapModal}
                places={normalizedPlaces}
                selectedIndex={mapSelectedIndex}
                routeMode={mapRouteMode}
                onSelectIndex={(idx) => {
                    setMapSelectedIndex(idx);
                    setMapRouteMode(idx === 0 ? "full" : "segment");
                    setActivePlaceIndex(idx);
                }}
                onResetRoute={() => {
                    setMapSelectedIndex(null);
                    setMapRouteMode("full");
                    setActivePlaceIndex(null);
                }}
                onClose={() => setShowCourseMapModal(false)}
                onOpenDetail={(place, tipsRow) => {
                    setShowCourseMapModal(false);
                    setSelectedPlace({ place, tipsRow });
                }}
                onReserve={(url) => setScreenReservationUrl(url)}
            />

            {/* 예약 WebView 모달 */}
            <Modal
                visible={!!screenReservationUrl}
                animationType="slide"
                transparent
                onRequestClose={() => setScreenReservationUrl(null)}
                {...MODAL_ANDROID_PROPS}
            >
                <View style={s.screenReserveOverlay}>
                    <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setScreenReservationUrl(null)} />
                    <View style={s.screenReserveSheet}>
                        <View style={[s.reserveWebHeader, { borderBottomColor: "#e5e7eb", backgroundColor: "#fff" }]}>
                            <TouchableOpacity
                                onPress={() => setScreenReservationUrl(null)}
                                hitSlop={10}
                                style={s.reserveWebBackBtn}
                            >
                                <Ionicons name="chevron-down" size={22} color="#111827" />
                            </TouchableOpacity>
                            <Text style={[s.reserveWebTitle, { color: "#111827" }]} numberOfLines={1}>
                                {i18n("explore.reserve")}
                            </Text>
                            <TouchableOpacity
                                onPress={() => screenReservationUrl && Linking.openURL(screenReservationUrl)}
                                hitSlop={10}
                                style={s.reserveWebBackBtn}
                            >
                                <Ionicons name="open-outline" size={19} color="#6b7280" />
                            </TouchableOpacity>
                        </View>
                        {screenReservationUrl ? (
                            <WebView
                                source={{ uri: screenReservationUrl }}
                                style={{ flex: 1 }}
                                javaScriptEnabled
                                domStorageEnabled
                                allowsInlineMediaPlayback
                                startInLoadingState
                                renderLoading={() => (
                                    <View
                                        style={[
                                            StyleSheet.absoluteFillObject,
                                            { alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
                                        ]}
                                    >
                                        <ActivityIndicator color="#7aa06f" />
                                    </View>
                                )}
                            />
                        ) : null}
                    </View>
                </View>
            </Modal>

            {/* 구독/열람권 모달 */}
            <TicketPlansSheet
                visible={showTicketModal}
                onClose={() => setShowTicketModal(false)}
                courseId={Number(id)}
                courseGrade={course.grade as "BASIC" | "PREMIUM"}
                context="COURSE"
                onUnlocked={() => queryClient.invalidateQueries({ queryKey: ["course", id] })}
            />

            <LoginModal
                visible={showLoginModal}
                onClose={() => setShowLoginModal(false)}
            />

            {/* 메모리 한도 모달 */}
            <Modal visible={showMemoryLimitModal} transparent animationType="slide" onRequestClose={() => setShowMemoryLimitModal(false)} {...MODAL_ANDROID_PROPS}>
                <Pressable style={s.overlay} onPress={() => setShowMemoryLimitModal(false)}>
                    <Pressable style={[s.loginModalSheet, { backgroundColor: t.card }]} onPress={(e) => e.stopPropagation()}>
                        <TouchableOpacity style={[s.loginModalClose, { backgroundColor: t.surface }]} onPress={() => setShowMemoryLimitModal(false)}>
                            <Ionicons name="close" size={16} color={t.textMuted} />
                        </TouchableOpacity>
                        <View style={s.loginIconWrap}>
                            <View style={[s.loginIconPulse, { backgroundColor: "#7c3aed" }]} />
                            <View style={[s.loginIconBox, { backgroundColor: "#7c3aed", shadowColor: "#7c3aed" }]}>
                                <Ionicons name="lock-closed" size={30} color="#fff" />
                            </View>
                        </View>
                        <Text style={[s.loginModalTitle, { color: t.text }]}>
                            {i18n("mobile.courseScreen.memoryLimitTitleLine1")}
                            {"\n"}
                            <Text style={{ color: "#7c3aed" }}>{i18n("mobile.courseScreen.memoryLimitHighlight")}</Text>
                        </Text>
                        <Text style={[s.loginModalSub, { color: t.textMuted }]}>{i18n("mobile.courseScreen.memoryLimitSub")}</Text>
                        <View style={[s.loginBenefitBox, { backgroundColor: t.surface, borderColor: t.border }]}>
                            <Text style={[s.loginBenefitLabel, { color: t.textMuted }]}>{i18n("mobile.courseScreen.subBenefitsTitle")}</Text>
                            {[
                                i18n("mobile.courseScreen.benefitUnlimitedMemories"),
                                i18n("mobile.courseScreen.benefitPremiumCourses"),
                                i18n("mobile.courseScreen.benefitNoAds"),
                            ].map((b, i) => (
                                <View key={i} style={s.loginBenefitRow}>
                                    <View style={[s.loginCheckCircle, { backgroundColor: "#ede9fe" }]}>
                                        <Ionicons name="checkmark" size={10} color="#7c3aed" />
                                    </View>
                                    <Text style={[s.loginBenefitText, { color: t.text }]}>{b}</Text>
                                </View>
                            ))}
                        </View>
                        <TouchableOpacity
                            style={[s.loginCTABtn, { backgroundColor: "#7c3aed", shadowColor: "#7c3aed" }]}
                            onPress={() => { setShowMemoryLimitModal(false); router.push("/shop" as any); }}
                        >
                            <Text style={s.loginCTAText}>{i18n("mobile.courseScreen.subscribeSaveMore")}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.cancelBtn} onPress={() => setShowMemoryLimitModal(false)}>
                            <Text style={s.cancelBtnText}>{i18n("courseStart.close")}</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* 리뷰 이미지 프리뷰 */}
            <Modal
                visible={reviewPreviewImages.length > 0}
                transparent
                animationType="fade"
                onRequestClose={() => setReviewPreviewImages([])}
                {...MODAL_ANDROID_PROPS}
            >
                <Pressable style={s.reviewPreviewBackdrop} onPress={() => setReviewPreviewImages([])}>
                    <Pressable onPress={(e) => e.stopPropagation()} style={s.reviewPreviewInner}>
                        <Image
                            source={{ uri: reviewPreviewImages[reviewPreviewIndex] }}
                            style={s.reviewPreviewImg}
                            resizeMode="contain"
                        />
                        {reviewPreviewImages.length > 1 && (
                            <View style={s.reviewPreviewNav}>
                                <TouchableOpacity
                                    onPress={() => setReviewPreviewIndex((i) => (i > 0 ? i - 1 : reviewPreviewImages.length - 1))}
                                    style={s.reviewPreviewNavBtn}
                                >
                                    <Ionicons name="chevron-back" size={24} color="#fff" />
                                </TouchableOpacity>
                                <Text style={s.reviewPreviewCounter}>
                                    {reviewPreviewIndex + 1} / {reviewPreviewImages.length}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setReviewPreviewIndex((i) => (i < reviewPreviewImages.length - 1 ? i + 1 : 0))}
                                    style={s.reviewPreviewNavBtn}
                                >
                                    <Ionicons name="chevron-forward" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        )}
                        <TouchableOpacity style={s.reviewPreviewClose} onPress={() => setReviewPreviewImages([])}>
                            <Ionicons name="close" size={22} color="#fff" />
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal
                visible={showReviewModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowReviewModal(false)}
                {...MODAL_ANDROID_PROPS}
            >
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
                >
                    <Pressable
                        style={s.overlay}
                        onPress={() => {
                            setShowReviewModal(false);
                            setReviewImageLocalUri(null);
                            setReviewImageUrl(null);
                        }}
                    >
                        <Pressable
                            style={[s.modalSheet, s.reviewModalSheet, { backgroundColor: t.card }]}
                            onPress={(e) => e.stopPropagation()}
                        >
                        <View style={[s.handle, { backgroundColor: t.border }]} />
                        {/* 헤더: 타이틀 + X 버튼 */}
                        <View style={s.reviewModalHeader}>
                            <Text style={[s.modalTitle, { color: t.text, textAlign: "left", marginBottom: 0 }]}>
                                {i18n("mobile.courseScreen.reviewModalTitle")}
                            </Text>
                            <TouchableOpacity
                                style={[s.loginModalClose, { backgroundColor: t.surface, position: "relative", top: 0, right: 0 }]}
                                onPress={() => {
                                    setShowReviewModal(false);
                                    setReviewImageLocalUri(null);
                                    setReviewImageUrl(null);
                                }}
                                disabled={reviewSubmitting}
                            >
                                <Ionicons name="close" size={16} color={t.textMuted} />
                            </TouchableOpacity>
                        </View>
                        {/* 코스 이름 박스 */}
                        <View style={[s.reviewCourseName, { backgroundColor: t.surface }]}>
                            <Text style={{ fontSize: 11, color: t.textMuted, marginBottom: 2 }}>{i18n("mobile.courseScreen.reviewTargetLabel")}</Text>
                            <Text style={{ fontSize: 14, fontWeight: "500", color: t.text }} numberOfLines={1}>{course.title}</Text>
                        </View>
                        <View style={s.reviewRatingRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity
                                    key={star}
                                    onPress={() => setReviewRating(star)}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                >
                                    <Text
                                        style={[
                                            s.reviewStarBtn,
                                            { color: star <= reviewRating ? "#f59e0b" : "#d1d5db" },
                                        ]}
                                    >
                                        ★
                                    </Text>
                                </TouchableOpacity>
                            ))}
                            <Text style={[s.reviewRatingCount, { color: t.textMuted }]}>{reviewRating} / 5</Text>
                        </View>
                        <View style={s.reviewImageRow}>
                            <TouchableOpacity
                                style={[s.reviewImagePickBtn, { borderColor: t.border, backgroundColor: t.surface }]}
                                onPress={handlePickReviewImage}
                                disabled={reviewUploadingImage || reviewSubmitting}
                            >
                                {reviewUploadingImage ? (
                                    <ActivityIndicator size="small" color={Colors.brandGreen} />
                                ) : (
                                    <>
                                        <Ionicons name="image-outline" size={16} color={t.textMuted} />
                                        <Text style={[s.reviewImagePickText, { color: t.textMuted }]}>
                                            {reviewImageLocalUri ? i18n("mobile.courseScreen.changeImage") : i18n("mobile.courseScreen.attachImage")}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            {reviewImageLocalUri ? (
                                <View style={s.reviewImagePreviewWrap}>
                                    <Image source={{ uri: reviewImageLocalUri }} style={s.reviewImagePreview} />
                                    <TouchableOpacity
                                        style={s.reviewImageRemoveBtn}
                                        onPress={() => {
                                            setReviewImageLocalUri(null);
                                            setReviewImageUrl(null);
                                        }}
                                        disabled={reviewUploadingImage || reviewSubmitting}
                                    >
                                        <Ionicons name="close" size={12} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ) : null}
                        </View>
                        <TextInput
                            value={reviewContent}
                            onChangeText={setReviewContent}
                            placeholder={i18n("mobile.courseScreen.reviewPlaceholder")}
                            placeholderTextColor={t.textSubtle}
                            multiline
                            maxLength={500}
                            style={[
                                s.reviewInput,
                                { color: t.text, borderColor: t.border, backgroundColor: t.surface },
                            ]}
                        />
                        <Text style={[s.reviewCharCount, { color: reviewContent.length < 5 ? "#ef4444" : t.textSubtle }]}>{reviewContent.length} / 500</Text>
                        <View style={s.reviewModalActions}>
                            <TouchableOpacity
                                style={[s.cancelBtn, { margin: 0 }]}
                                onPress={() => {
                                    setShowReviewModal(false);
                                    setReviewImageLocalUri(null);
                                    setReviewImageUrl(null);
                                }}
                                disabled={reviewSubmitting}
                            >
                                <Text style={s.cancelBtnText}>{i18n("mobile.courseScreen.cancel")}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.ticketBtn, { flex: 1 }, reviewSubmitting && { opacity: 0.6 }]}
                                onPress={handleSubmitReview}
                                disabled={reviewSubmitting}
                            >
                                {reviewSubmitting ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={s.ticketBtnText}>{i18n("mobile.courseScreen.submitReview")}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                        </Pressable>
                    </Pressable>
                </KeyboardAvoidingView>
            </Modal>

            {toast ? (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    icon={toast.icon}
                    onHide={() => setToast(null)}
                />
            ) : null}
        </SafeAreaView>
    );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    // Hero (웹 CourseDetailClient 헤더와 동일 톤)
    heroWrap: { position: "relative", width: "100%" },
    heroImg: { width: "100%", height: 448, resizeMode: "cover" },
    heroBackBtn: {
        position: "absolute",
        zIndex: 50,
        padding: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    heroBackIconShadow: {
        textShadowColor: "rgba(0,0,0,0.5)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    heroFooter: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 24,
        paddingTop: 8,
        zIndex: 10,
    },
    heroChipRowTop: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
    heroChipDark: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: "rgba(17,24,39,0.92)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(55,65,81,0.9)",
    },
    heroChipDarkText: { fontSize: 11, fontWeight: "500", color: "#fff", letterSpacing: 0.3 },
    heroTitle: {
        fontSize: 20,
        fontWeight: "600",
        color: "#fff",
        marginBottom: 6,
        lineHeight: 28,
        textShadowColor: "rgba(0,0,0,0.45)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },
    heroSubTitle: { fontSize: 13, color: "rgba(255,255,255,0.88)", marginBottom: 10, lineHeight: 19 },
    heroMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    heroMetaPill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.15)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.4)",
    },
    heroMetaPillText: { fontSize: 13, fontWeight: "500", color: "#fff" },

    // 메인 카드 (웹: mt-4 rounded-2xl bg-white shadow-sm border border-gray-100)
    mainOuter: { marginTop: 16, paddingHorizontal: 20, marginBottom: 0, zIndex: 2 },
    mainCard: {
        borderRadius: 16,
        borderWidth: 1,
        paddingTop: 20,
        paddingHorizontal: 16,
        paddingBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        overflow: "hidden",
    },

    // Place card (웹: number 바깥 + 카드 안에 이미지 + 정보)
    placeRow: { flexDirection: "row", gap: 16, marginBottom: 0, alignItems: "flex-start" },
    placeCard: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    placeCardRow: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
    placeNum: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.brandGreenLight,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: 16, // 카드 padding과 맞춤
    },
    placeNumText: { color: "#fff", fontSize: 14, fontWeight: "500" },
    // 웹: font-bold text-sm (14px)
    placeName: { fontSize: 14, fontWeight: "500", marginBottom: 2 },
    placeSubText: { fontSize: 12, marginBottom: 6 },
    placeBadgeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 4 },
    catText: { fontSize: 10, fontWeight: "500", letterSpacing: 0.3 },
    catBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
    catBadgeText: { fontSize: 10, fontWeight: "500" },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    statusBadgeText: { fontSize: 10, fontWeight: "500" },
    // 예약 버튼 (웹: bg-emerald-500 text-white text-[11px] px-3 py-1.5 rounded-md)
    reserveBtn: { alignSelf: "flex-start", marginTop: 4 },
    reserveBtnInner: {
        backgroundColor: "#10b981",
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    reserveBtnText: { fontSize: 11, color: "#fff", fontWeight: "500" },
    // 웹: w-20 h-20 = 80px
    placeThumb: { width: 80, height: 80, borderRadius: 8, flexShrink: 0 },
    // 꿀팁 (웹: ✨ 꿀팁 헤더 + 칩)
    tipRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" },
    tipLabel: { fontSize: 11, fontWeight: "500", color: "#4b5563" },
    tipChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: "#f3f4f6",
        borderWidth: 1,
        borderColor: "#d1fae5",
    },
    tipChipText: { fontSize: 11, fontWeight: "500", color: "#059669" },
    mapFabFixed: {
        position: "absolute",
        right: 16,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.brandGreenLight,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 30,
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
    },

    // Walking connector
    walkConnector: { flexDirection: "row", alignItems: "center", marginVertical: 6, paddingHorizontal: 20 },
    walkLine: { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
    walkBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 10,
        paddingVertical: 3,
        backgroundColor: "#f9fafb",
        borderRadius: 999,
        marginHorizontal: 8,
    },
    walkText: { fontSize: 11, color: "#6b7280", fontWeight: "500" },

    // Place detail modal (웹 showPlaceModal: rounded-t-2xl, h-72 이미지, 그라데이션+이름만 오버레이)
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    placeModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
    placeModalSheet: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        overflow: "hidden",
        width: "100%",
        maxWidth: 448,
        alignSelf: "center",
        flexDirection: "column",
    },
    detailSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
    handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
    detailImgWrap: { position: "relative", backgroundColor: "#f3f4f6" },
    detailImg: { width: "100%", height: 260 },
    detailImgWeb: { width: "100%", height: 288 },
    detailImgGradient: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 140,
        flexDirection: "column",
    },
    detailHandleOnImg: {
        position: "absolute",
        top: 10,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 10,
    },
    detailHandleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.75)" },
    detailHandleBarWeb: {
        width: 48,
        height: 6,
        borderRadius: 3,
        backgroundColor: "rgba(255,255,255,0.92)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    detailImgOverlayWeb: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 36,
        backgroundColor: "transparent",
    },
    detailImgNameWeb: {
        fontSize: 18,
        fontWeight: "600",
        color: "#fff",
        letterSpacing: -0.2,
        textShadowColor: "rgba(0,0,0,0.5)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    detailScrollTitle: { fontSize: 20, fontWeight: "600", marginBottom: 8, letterSpacing: -0.3 },
    detailAddressWeb: { fontSize: 13, fontWeight: "500", marginBottom: 12 },
    detailDescWeb: { fontSize: 14, lineHeight: 22, marginBottom: 16 },
    placeTipSection: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 12 },
    placeTipSectionLabel: { fontSize: 12, fontWeight: "600", marginBottom: 8 },
    placeTipSectionBody: { fontSize: 14, lineHeight: 21, fontWeight: "500" },
    detailReserveBtnWeb: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#10b981",
        borderRadius: 10,
        paddingVertical: 12,
        marginBottom: 8,
        marginTop: 4,
    },
    detailReserveBtnWebText: { color: "#fff", fontSize: 14, fontWeight: "500" },
    detailCloseTextWeb: { fontSize: 13, fontWeight: "500", textAlign: "center" },
    detailImgOverlay: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingBottom: 18,
        paddingTop: 40,
        backgroundColor: "rgba(0,0,0,0.38)",
    },
    detailImgCategory: {
        fontSize: 10,
        fontWeight: "500",
        color: "rgba(255,255,255,0.75)",
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    detailImgName: {
        fontSize: 22,
        fontWeight: "600",
        color: "#fff",
        letterSpacing: -0.3,
        textShadowColor: "rgba(0,0,0,0.4)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    detailName: { fontSize: 20, fontWeight: "600", marginBottom: 8, letterSpacing: -0.3 },
    detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 5, marginBottom: 8 },
    detailRowText: { fontSize: 13, flex: 1, lineHeight: 18 },
    detailDesc: {
        fontSize: 13,
        lineHeight: 20,
        marginBottom: 12,
        marginTop: 4,
    },
    detailStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 6, alignSelf: "flex-start" },
    detailStatusText: { fontSize: 11, fontWeight: "500" },
    detailTipBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginHorizontal: 16,
        marginBottom: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    detailTipLockIcon: { fontSize: 20 },
    detailTipBannerTitle: { fontSize: 13, fontWeight: "500", marginBottom: 2 },
    detailTipBannerSub: { fontSize: 12 },
    detailFooter: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
    detailReserveBtn: {
        backgroundColor: Colors.brandGreen,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        marginBottom: 8,
    },
    detailReserveBtnText: { color: "#fff", fontSize: 15, fontWeight: "500" },
    detailCloseTextBtn: { paddingVertical: 10, alignItems: "center" },
    detailCloseText: { fontSize: 14, fontWeight: "500" },
    reserveWebHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    reserveWebBackBtn: { width: 36, alignItems: "center" },
    reserveWebTitle: { flex: 1, fontSize: 15, fontWeight: "500", textAlign: "center" },
    screenReserveOverlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.4)",
    },
    screenReserveSheet: {
        height: Dimensions.get("window").height * 0.75,
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: "hidden",
    },
    tipModalSheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 36,
    },
    tipModalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
    tipModalContent: { fontSize: 15, lineHeight: 24 },
    tipBox: { backgroundColor: "#fef9c3", borderRadius: 10, padding: 12, marginBottom: 12 },
    tipText: { fontSize: 13, color: "#92400e", lineHeight: 19 },
    mapBtn: {
        marginTop: 6,
        borderRadius: 10,
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    mapBtnText: { fontSize: 13, fontWeight: "500" },
    closeBtn: {
        margin: 16,
        borderRadius: 12,
        borderWidth: 1,
        paddingVertical: 14,
        alignItems: "center",
    },
    closeBtnText: { fontSize: 15, fontWeight: "500" },
    mapModalWrap: {
        height: "62%",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: "hidden",
    },
    mapModalHeader: {
        height: 52,
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    mapModalTitle: { fontSize: 15, fontWeight: "500", maxWidth: "60%" },
    mapModalCloseText: { fontSize: 14, fontWeight: "500" },
    mapModalOpenText: { fontSize: 14, color: Colors.brandGreen, fontWeight: "500" },
    courseMapModalRoot: { flex: 1 },
    courseMapAndroidOverlay: {
        zIndex: 60000,
        elevation: 60000,
    },
    courseMapBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.45)",
    },
    courseMapBackdropWeb: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.6)",
    },
    courseMapSheet: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: "hidden",
        flexDirection: "column",
    },
    courseMapSheetWeb: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderTopWidth: 1,
        // Android: overflow hidden이 SurfaceView(NaverMap/WebView)를 클리핑해 지도 미렌더링 발생
        overflow: Platform.OS === "android" ? "visible" : "hidden",
        flexDirection: "column",
        maxWidth: 448,
        alignSelf: "center",
        width: "100%",
    },
    courseMapGrab: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 8, marginBottom: 6 },
    courseMapGrabWeb: { width: 48, height: 8, borderRadius: 4, alignSelf: "center", marginTop: 10, marginBottom: 8 },
    courseMapWebView: { flex: 1, backgroundColor: "#e5e7eb" },
    courseMapHeader: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingTop: 4,
        paddingBottom: 10,
        paddingHorizontal: 12,
    },
    mapHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 8,
    },
    mapStepRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 4 },
    mapStepItem: { flexDirection: "row", alignItems: "center" },
    mapStepCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#99c08e",
        alignItems: "center",
        justifyContent: "center",
    },
    mapStepCircleIdleWeb: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#99c08e",
        alignItems: "center",
        justifyContent: "center",
    },
    mapStepCircleSelectedWeb: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: MAP_PURPLE,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#fff",
        shadowColor: MAP_PURPLE,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 6,
        elevation: 4,
    },
    mapStepText: { color: "#fff", fontWeight: "500" },
    mapStepTextWeb: { color: "#fff", fontWeight: "600", fontSize: 13 },
    mapStepCircleSelected: {
        backgroundColor: "#ffffff",
        borderWidth: 3,
        borderColor: "#22c55e",
    },
    mapStepTextSelected: { color: "#16a34a", fontWeight: "500" },
    mapStepArrow: { marginHorizontal: 6, color: "#9ca3af", fontSize: 22, lineHeight: 24 },
    mapAllRouteBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#d1d5db",
    },
    mapAllRouteBtnActive: {
        borderColor: "#22c55e",
        backgroundColor: "#f0fdf4",
    },
    mapAllRouteBtnText: { fontSize: 12, fontWeight: "500" },
    mapBottomSheet: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        borderTopWidth: 4,
        borderTopColor: "#99c08e",
        padding: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 8,
    },
    mapBottomTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
    mapBottomThumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: "#e5e7eb" },
    mapBottomTitle: { fontSize: 16, fontWeight: "600" },
    mapBottomSub: { fontSize: 12, marginTop: 2 },
    mapBottomAddr: { fontSize: 12, marginTop: 2 },
    mapPrimaryBtn: {
        height: 44,
        borderRadius: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginBottom: 10,
    },
    mapPrimaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "500" },
    mapActionRow: { flexDirection: "row", gap: 10 },
    mapDarkBtn: {
        height: 46,
        borderRadius: 10,
        backgroundColor: "#111827",
        alignItems: "center",
        justifyContent: "center",
    },
    mapDarkBtnText: { color: "#fff", fontSize: 16, fontWeight: "500" },
    mapLightBtn: {
        height: 46,
        borderRadius: 10,
        backgroundColor: "#9ca3af",
        alignItems: "center",
        justifyContent: "center",
    },
    mapLightBtnText: { color: "#fff", fontSize: 16, fontWeight: "500" },

    // Bottom CTA bar
    ctaBar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        zIndex: 20,
    },
    ctaIconBtn: {
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        paddingVertical: 4,
        paddingHorizontal: 4,
        borderRadius: 0,
        borderWidth: 0,
    },
    ctaIconLabel: { fontSize: 10, fontWeight: "500" },
    ctaMainBtn: {
        flex: 1,
        backgroundColor: Colors.brandGreenLight,
        borderRadius: 8,
        minHeight: 56,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },
    ctaMainBtnText: { color: "#fff", fontSize: 16, fontWeight: "500" },
    ctaStatusText: { fontSize: 11, marginBottom: 4, textAlign: "center" },

    // Ticket modal
    modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 20, fontWeight: "600", textAlign: "center", marginBottom: 8 },
    modalSubtitle: { fontSize: 13, textAlign: "center", lineHeight: 22, marginBottom: 24 },
    planCard: { borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1 },
    planRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    planName: { fontSize: 15, fontWeight: "500", marginBottom: 2 },
    planDesc: { fontSize: 13 },
    planPrice: { fontSize: 17, fontWeight: "600" },
    planCardPremium: {
        backgroundColor: "#fef3c7",
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#fde68a",
    },
    planNamePremium: { fontSize: 15, fontWeight: "500", color: "#92400e", marginBottom: 2 },
    planDescPremium: { fontSize: 13, color: "#92400e" },
    planPricePremium: { fontSize: 13, fontWeight: "500", color: "#92400e" },
    planCtaPremium: { fontSize: 13, fontWeight: "500", color: "#92400e", textAlign: "right" },
    ticketBtn: { backgroundColor: Colors.brandGreen, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
    ticketBtnText: { color: "#fff", fontSize: 13, fontWeight: "500" },
    ticketPlanCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 2, position: "relative", paddingTop: 32 },
    ticketPlanBadge: { position: "absolute", top: -10, left: 16, backgroundColor: "#10b981", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
    ticketPlanBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
    cancelBtn: { paddingVertical: 12, alignItems: "center" },
    cancelBtnText: { color: "#9ca3af", fontSize: 13 },
    // 리뷰 섹션 (웹: 별도 rounded-2xl bg-gray-50 border border-gray-200 p-6)
    reviewSection: {
        marginHorizontal: 20,
        marginTop: 16,
        marginBottom: 8,
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 20,
        paddingVertical: 24,
    },
    reviewSectionTitle: { fontSize: 18, fontWeight: "500" },
    reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
    reviewWriteBtn: {
        backgroundColor: "#ecfdf5",
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: "#d1fae5",
    },
    reviewWriteBtnText: { color: "#047857", fontSize: 13, fontWeight: "500" },
    reviewEmpty: { fontSize: 13, marginBottom: 8 },
    // 웹: bg-gray-50 p-5 rounded-2xl
    reviewCard: { borderRadius: 16, padding: 20 },
    reviewAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    reviewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    reviewUser: { fontSize: 14, fontWeight: "500" },
    reviewDate: { fontSize: 12 },
    reviewStars: { color: "#f59e0b", marginBottom: 6 },
    reviewContent: { fontSize: 15, lineHeight: 24 },
    reviewRatingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, justifyContent: "center" },
    reviewStarBtn: { fontSize: 30, lineHeight: 34 },
    reviewRatingCount: { fontSize: 14, fontWeight: "500", marginLeft: 4 },
    reviewCharCount: { fontSize: 12, textAlign: "right", marginBottom: 10, marginTop: -6 },
    reviewInput: {
        borderWidth: 1,
        borderRadius: 12,
        minHeight: 120,
        padding: 12,
        textAlignVertical: "top",
        marginBottom: 10,
    },
    reviewImageRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
    reviewImagePickBtn: {
        borderWidth: 1,
        borderRadius: 10,
        minHeight: 40,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    reviewImagePickText: { fontSize: 13, fontWeight: "500" },
    reviewImagePreviewWrap: { width: 40, height: 40, borderRadius: 8, overflow: "hidden", position: "relative" },
    reviewImagePreview: { width: "100%", height: "100%" },
    reviewImageRemoveBtn: {
        position: "absolute",
        top: 2,
        right: 2,
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(17,24,39,0.8)",
    },
    reviewModalActions: { flexDirection: "row", gap: 10, alignItems: "center" },
    reviewModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
    reviewCourseName: { borderRadius: 12, padding: 12, marginBottom: 16 },
    reviewModalSheet: { paddingBottom: 20 },
    reviewMoreBtn: {
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
        marginTop: 4,
    },
    reviewMoreBtnText: { fontSize: 13, fontWeight: "500" },
    reviewImgGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 10,
    },
    reviewImgThumb: {
        width: (Dimensions.get("window").width - 32 - 40 - 12) / 3,
        aspectRatio: 1,
        borderRadius: 8,
        backgroundColor: "#e5e7eb",
    },
    reviewPreviewBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.92)",
        justifyContent: "center",
        alignItems: "center",
    },
    reviewPreviewInner: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
    },
    reviewPreviewImg: {
        width: "100%",
        height: "80%",
    },
    reviewPreviewNav: {
        flexDirection: "row",
        alignItems: "center",
        gap: 24,
        marginTop: 16,
    },
    reviewPreviewNavBtn: {
        padding: 8,
    },
    reviewPreviewCounter: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "500",
    },
    reviewPreviewClose: {
        position: "absolute",
        top: 52,
        right: 20,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(0,0,0,0.5)",
        alignItems: "center",
        justifyContent: "center",
    },

    loginModalSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 44, position: "relative" },
    loginModalClose: { position: "absolute", top: 20, right: 20, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", zIndex: 10 },
    loginIconWrap: { alignItems: "center", marginBottom: 20, marginTop: 16 },
    loginIconPulse: { position: "absolute", width: 96, height: 96, borderRadius: 24, backgroundColor: "#059669", opacity: 0.12, transform: [{ rotate: "12deg" }] },
    loginIconBox: {
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundColor: "#059669",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#059669",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
        position: "relative",
    },
loginModalTitle: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 8, letterSpacing: -0.5, lineHeight: 30 },
    loginModalSub: { fontSize: 14, textAlign: "center", marginBottom: 20, lineHeight: 20 },
    loginBenefitBox: { borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1 },
    loginBenefitLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 },
    loginBenefitRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    loginCheckCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#dcfce7", alignItems: "center", justifyContent: "center", flexShrink: 0 },
    loginBenefitText: { fontSize: 14, fontWeight: "500" },
    loginCTABtn: {
        borderRadius: 999,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
        backgroundColor: "#059669",
    },
    loginCTAText: { color: "#fff", fontSize: 15, fontWeight: "500" },

    // Toast
    toast: {
        position: "absolute",
        bottom: 120,
        left: 24,
        right: 24,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 14,
        backgroundColor: "rgba(30,42,26,0.94)",
        zIndex: 100,
    },
    toastIcon: { fontSize: 18 },
    toastText: { color: "#fff", fontSize: 14, fontWeight: "500", flex: 1 },

    // ── 선택형 코스 스타일 ──────────────────────────────────────────────────────
    selStepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 4 },
    selStepNum: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: "#7FCC9F",
        alignItems: "center", justifyContent: "center",
        marginTop: 4, flexShrink: 0,
    },
    selStepNumText: { color: "#fff", fontWeight: "500", fontSize: 14 },
    confirmedBadge: {
        marginTop: 6, alignSelf: "flex-start",
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 20, backgroundColor: "#dcfce7",
    },
    confirmedBadgeText: { fontSize: 11, fontWeight: "500", color: "#16a34a" },
    selSegLabel: { fontSize: 15, fontWeight: "500", color: "#111827", marginBottom: 2 },
    selSegPrompt: { fontSize: 13, marginBottom: 10 },
    selCandidateScroll: { paddingRight: 16, gap: 10, flexDirection: "row" },
    candidateCard: {
        width: 180, borderRadius: 14, overflow: "hidden",
    },
    candidateImgWrap: { position: "relative" },
    candidateImg: { width: "100%" as any, height: 100 },
    candidateCheckBadge: {
        position: "absolute", top: 6, right: 6,
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: "#22c55e",
        alignItems: "center", justifyContent: "center",
    },
    candidateInfo: { padding: 8, paddingBottom: 4 },
    candidateName: { fontSize: 13, fontWeight: "500", marginBottom: 2, lineHeight: 17 },
    candidateSub: { fontSize: 11, lineHeight: 15 },
    candidateInfoBtn: {
        paddingVertical: 7, paddingHorizontal: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        alignItems: "center", justifyContent: "center",
    },
    candidateInfoBtnText: { fontSize: 11, fontWeight: "500", color: "#059669" },
    editSelectionBtn: { alignSelf: "flex-end", paddingVertical: 4, paddingHorizontal: 2, marginBottom: 4 },
    editSelectionBtnText: { fontSize: 13, fontWeight: "500", color: "#10b981" },
});
