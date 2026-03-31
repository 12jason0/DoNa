/**
 * 주변 탐색 탭 — 웹 map/page.tsx 와 동일한 UI (Phase 3)
 * - 장소/코스 탭, 드래그 바텀 시트, 카테고리 마커, 폴리라인, 장소 상세
 */
import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
    useMemo,
} from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Animated,
    PanResponder,
    Dimensions,
    ActivityIndicator,
    Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import Svg, { Path, Circle } from "react-native-svg";
import { BASE_URL } from "../../src/lib/api";

// 네이버 지도 — EAS dev build 필요
let NaverMapView: any = null;
let NaverMapMarkerOverlay: any = null;
let NaverMapPolylineOverlay: any = null;
let ExpoLocation: any = null;
try {
    const NaverMap = require("@mj-studio/react-native-naver-map");
    NaverMapView = NaverMap.NaverMapView;
    NaverMapMarkerOverlay = NaverMap.NaverMapMarkerOverlay;
    NaverMapPolylineOverlay = NaverMap.NaverMapPolylineOverlay;
} catch {}
try {
    ExpoLocation = require("expo-location");
} catch {}

// --- 타입 ---
interface Place {
    id: string;
    name: string;
    category: string;
    address: string;
    description?: string;
    phone?: string;
    latitude: number;
    longitude: number;
    source: "kakao" | "db";
}
interface Course {
    id: string;
    title: string;
    description: string;
    distance: number;
    grade?: string;
    latitude?: number;
    longitude?: number;
}

// --- 카테고리 색상 / 아이콘 ---
type CatKey = "restaurant" | "cafe" | "bar" | "play" | "bookstore" | "landmark" | "default";

const CAT_COLORS: Record<CatKey, string> = {
    restaurant: "#f97316",
    cafe: "#92400e",
    bar: "#3b82f6",
    play: "#a855f7",
    bookstore: "#0d9488",
    landmark: "#e11d48",
    default: "#6b7280",
};

function getCatKey(category: string): CatKey {
    const c = (category || "").toLowerCase();
    if (c.includes("카페") || c.includes("cafe") || c.includes("커피") || c.includes("던킨")) return "cafe";
    if (c.includes("미술관") || c.includes("박물관") || c.includes("갤러리") || c.includes("도서관") || c.includes("이색데이트") || c.includes("공방") || c.includes("쇼핑")) return "landmark";
    if (c.includes("음식") || c.includes("식당") || c.includes("맛집") || c.includes("한식") || c.includes("중식") || c.includes("양식") || c.includes("일식") || c.includes("피자") || c.includes("이탈리안")) return "restaurant";
    if (c.includes("술") || c.includes("바") || c.includes("맥주") || c.includes("호프") || c.includes("주점")) return "bar";
    if (c.includes("관광") || c.includes("명소") || c.includes("놀거리") || c.includes("문화") || c.includes("전시") || c.includes("테마")) return "play";
    if (c.includes("서점") || c.includes("책") || c.includes("북") || c.includes("book")) return "bookstore";
    return "default";
}

// --- 카테고리 아이콘 (목록 아이템용, 마커 child 아님) ---
function CatIcon({ catKey, size = 16, color }: { catKey: CatKey; size?: number; color?: string }) {
    const c = color ?? CAT_COLORS[catKey];
    const s = size;
    if (catKey === "restaurant") return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
            <Path d="M7 2v20" />
            <Path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </Svg>
    );
    if (catKey === "cafe") return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M10 2v2M14 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1M6 2v2" />
        </Svg>
    );
    if (catKey === "bar") return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M17 11h1a3 3 0 0 1 0 6h-1M9 12v6M13 12v6M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5ZM5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />
        </Svg>
    );
    if (catKey === "play") return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2ZM13 5v2M13 17v2M13 11v2" />
        </Svg>
    );
    if (catKey === "bookstore") return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
        </Svg>
    );
    if (catKey === "landmark") return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
        </Svg>
    );
    return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <Circle cx={12} cy={10} r={3} />
        </Svg>
    );
}

/** 웹 createReactNaverMapIcon 과 동일 비주얼. 각 이름에 @2x·@3x 동반 — npm run generate-map-markers */
const MAP_MARKER_IMAGES: Record<CatKey, { normal: number; selected: number }> = {
    restaurant: {
        normal: require("../../assets/map-markers/marker-restaurant.png"),
        selected: require("../../assets/map-markers/marker-restaurant-selected.png"),
    },
    cafe: {
        normal: require("../../assets/map-markers/marker-cafe.png"),
        selected: require("../../assets/map-markers/marker-cafe-selected.png"),
    },
    bar: {
        normal: require("../../assets/map-markers/marker-bar.png"),
        selected: require("../../assets/map-markers/marker-bar-selected.png"),
    },
    play: {
        normal: require("../../assets/map-markers/marker-play.png"),
        selected: require("../../assets/map-markers/marker-play-selected.png"),
    },
    bookstore: {
        normal: require("../../assets/map-markers/marker-bookstore.png"),
        selected: require("../../assets/map-markers/marker-bookstore-selected.png"),
    },
    landmark: {
        normal: require("../../assets/map-markers/marker-landmark.png"),
        selected: require("../../assets/map-markers/marker-landmark-selected.png"),
    },
    default: {
        normal: require("../../assets/map-markers/marker-default.png"),
        selected: require("../../assets/map-markers/marker-default-selected.png"),
    },
};

// --- 내 위치 마커 ---
function UserLocationMarker() {
    const pulseAnim = useRef(new Animated.Value(0.5)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
            ])
        ).start();
    }, []);
    return (
        <View key="user-location-marker" collapsable={false} style={{ width: 60, height: 60, alignItems: "center", justifyContent: "center" }}>
            <Animated.View style={{
                position: "absolute", width: 60, height: 60, borderRadius: 30,
                backgroundColor: "rgba(59,130,246,0.3)",
                transform: [{ scale: pulseAnim }],
            }} />
            <View style={{
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: "#2563EB", borderWidth: 3, borderColor: "#fff",
                shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3, shadowRadius: 5, elevation: 6,
            }} />
        </View>
    );
}

const { height: SCREEN_H } = Dimensions.get("window");
const PANEL_EXPANDED = SCREEN_H * 0.85;
const PANEL_DEFAULT = SCREEN_H * 0.40;
const PANEL_MINIMIZED = 100;


export default function ExploreScreen() {
    const insets = useSafeAreaInsets();
    const t = useThemeColors();
    const router = useRouter();

    // --- 지도 상태 ---
    const [center, setCenter] = useState({ latitude: 37.5665, longitude: 126.978 });
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const mapRef = useRef<any>(null);
    // 드래그 중 카메라 위치 추적 (state 아닌 ref — 피드백 루프 방지)
    const cameraCenterRef = useRef({ latitude: 37.5665, longitude: 126.978 });

    // --- 데이터 상태 ---
    const [places, setPlaces] = useState<Place[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [activeTab, setActiveTab] = useState<"places" | "courses">("places");
    const [loading, setLoading] = useState(false);
    const [showSearchBtn, setShowSearchBtn] = useState(false);

    // --- 코스 루트 ---
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [coursePath, setCoursePath] = useState<{ latitude: number; longitude: number }[]>([]);
    const [coursePlaces, setCoursePlaces] = useState<Place[]>([]);
    const [courseLoading, setCourseLoading] = useState(false);
    const courseCache = useRef<Record<string, { path: { latitude: number; longitude: number }[]; list: Place[] }>>({});

    // --- 검색 ---
    const [searchInput, setSearchInput] = useState("");

    // --- 토스트 ---
    const [toast, setToast] = useState<string | null>(null);
    const showToast = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2200);
    }, []);

    // --- 바텀 시트 ---
    const panelY = useRef(new Animated.Value(SCREEN_H - PANEL_DEFAULT)).current;
    const panelState = useRef<"expanded" | "default" | "minimized">("default");
    const dragStart = useRef(0);
    const [panelMode, setPanelMode] = useState<"expanded" | "default" | "minimized">("default");
    const locationBtnAnim = useRef(new Animated.Value(PANEL_DEFAULT + 16)).current;

    const snapPanel = useCallback((mode: "expanded" | "default" | "minimized") => {
        panelState.current = mode;
        setPanelMode(mode);
        // 패널 bottom은 항상 0 (safe area 무시)
        const targetY =
            mode === "expanded" ? SCREEN_H - PANEL_EXPANDED
                : mode === "minimized" ? SCREEN_H - PANEL_MINIMIZED
                    : SCREEN_H - PANEL_DEFAULT;
        const panelH = mode === "expanded" ? PANEL_EXPANDED : mode === "minimized" ? PANEL_MINIMIZED : PANEL_DEFAULT;
        Animated.spring(panelY, { toValue: targetY, useNativeDriver: false, tension: 60, friction: 12 }).start();
        Animated.spring(locationBtnAnim, { toValue: panelH + 16, useNativeDriver: false, tension: 60, friction: 12 }).start();
    }, [panelY, locationBtnAnim]);

    const panelHeight = panelY.interpolate({
        inputRange: [SCREEN_H - PANEL_EXPANDED, SCREEN_H - PANEL_MINIMIZED],
        outputRange: [PANEL_EXPANDED, PANEL_MINIMIZED],
        extrapolate: "clamp",
    });

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
            onPanResponderGrant: (e) => { dragStart.current = e.nativeEvent.pageY; },
            onPanResponderMove: (_, gs) => {
                const mode = panelState.current;
                const base =
                    mode === "expanded" ? SCREEN_H - PANEL_EXPANDED
                        : mode === "minimized" ? SCREEN_H - PANEL_MINIMIZED
                            : SCREEN_H - PANEL_DEFAULT;
                const next = Math.max(
                    SCREEN_H - PANEL_EXPANDED,
                    Math.min(SCREEN_H - PANEL_MINIMIZED, base + gs.dy)
                );
                panelY.setValue(next);
            },
            onPanResponderRelease: (_, gs) => {
                const cur = panelState.current;
                if (gs.dy > 60) {
                    if (cur === "expanded") snapPanel("default");
                    else snapPanel("minimized");
                } else if (gs.dy < -60) {
                    if (cur === "minimized") snapPanel("default");
                    else snapPanel("expanded");
                } else {
                    snapPanel(cur);
                }
            },
        })
    ).current;

    // --- 데이터 패치 ---
    const fetchData = useCallback(async (lat: number, lng: number, keyword?: string) => {
        setLoading(true);
        try {
            const range = 0.02;
            const minLat = lat - range, maxLat = lat + range;
            const minLng = lng - range, maxLng = lng + range;
            const effectiveKeyword = keyword?.trim() || "맛집";
            const radius = 2000;

            const [myData, kakaoData] = await Promise.all([
                fetch(`${BASE_URL}/api/map?minLat=${minLat}&maxLat=${maxLat}&minLng=${minLng}&maxLng=${maxLng}`)
                    .then(r => r.json()).catch(() => ({ places: [], courses: [] })),
                fetch(`${BASE_URL}/api/places/search-kakao?lat=${lat}&lng=${lng}&keyword=${encodeURIComponent(effectiveKeyword)}&radius=${radius}`)
                    .then(r => r.json()).catch(() => ({ success: false, places: [], relatedCourses: [] })),
            ]);

            const uniquePlaces = new Map<string, Place>();
            const uniqueCourses = new Map<string, Course>();

            if (kakaoData.success && Array.isArray(kakaoData.places)) {
                kakaoData.places.forEach((p: any) => {
                    const id = `k-${p.id}`;
                    const lat = Number(p.latitude ?? p.lat);
                    const lng = Number(p.longitude ?? p.lng);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                    uniquePlaces.set(id, {
                        ...p,
                        id,
                        latitude: lat,
                        longitude: lng,
                        source: "kakao",
                    });
                });
            }
            if (Array.isArray(myData.places)) {
                myData.places.forEach((p: any) => {
                    const lat = Number(p.latitude ?? p.lat);
                    const lng = Number(p.longitude ?? p.lng);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                    uniquePlaces.set(`db-${p.id}`, {
                        ...p,
                        id: `db-${p.id}`,
                        latitude: lat,
                        longitude: lng,
                        source: "db",
                    });
                });
            }
            if (Array.isArray(myData.courses)) {
                myData.courses.forEach((c: any) => uniqueCourses.set(`c-${c.id}`, { ...c, id: `c-${c.id}` }));
            }
            if (Array.isArray(kakaoData.relatedCourses)) {
                kakaoData.relatedCourses.forEach((c: any) => uniqueCourses.set(`c-${c.id}`, { ...c, id: `c-${c.id}` }));
            }

            setPlaces(Array.from(uniquePlaces.values()).slice(0, 40));
            setCourses(Array.from(uniqueCourses.values()).slice(0, 40));
            if (keyword && uniqueCourses.size > 0) setActiveTab("courses");
        } catch {}
        finally { setLoading(false); }
    }, []);

    const fetchAreaSearch = useCallback(async () => {
        setShowSearchBtn(false);
        const { latitude, longitude } = cameraCenterRef.current;
        await fetchData(latitude, longitude);
        snapPanel("default");
    }, [fetchData, snapPanel]);

    // 초기 로드
    useEffect(() => { fetchData(center.latitude, center.longitude); }, []);

    // 코스 상세 패치
    const fetchCourseDetail = useCallback(async (course: Course) => {
        const courseId = course.id;
        const cleanId = courseId.startsWith("c-") ? courseId.replace("c-", "") : courseId;
        if (courseCache.current[courseId]) {
            const c = courseCache.current[courseId];
            setCoursePath(c.path);
            setCoursePlaces(c.list);
            return;
        }
        setCourseLoading(true);
        setCoursePath([]);
        setCoursePlaces([]);
        try {
            const res = await fetch(`${BASE_URL}/api/courses/${cleanId}`);
            const data = await res.json();
            const cps = data?.coursePlaces;
            if (!Array.isArray(cps)) return;
            const sorted = [...cps].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
            const path = sorted
                .map((cp: any) => {
                    const lat = cp.place?.latitude, lng = cp.place?.longitude;
                    if (lat != null && lng != null) return { latitude: Number(lat), longitude: Number(lng) };
                    return null;
                }).filter(Boolean) as { latitude: number; longitude: number }[];
            const list: Place[] = sorted
                .map((cp: any) => {
                    const p = cp.place;
                    if (!p || p.latitude == null || p.longitude == null) return null;
                    return { id: String(p.id ?? ""), name: p.name ?? "", category: p.category ?? "", address: p.address ?? "", latitude: Number(p.latitude), longitude: Number(p.longitude), source: "db" as const };
                }).filter(Boolean) as Place[];
            courseCache.current[courseId] = { path, list };
            setCoursePath(path);
            setCoursePlaces(list);
        } catch {}
        finally { setCourseLoading(false); }
    }, []);

    const handleCourseSelect = useCallback((course: Course) => {
        setSelectedCourse(course);
        setSelectedPlace(null);
        fetchCourseDetail(course);
    }, [fetchCourseDetail]);

    // 탭 변경 시 초기화
    useEffect(() => {
        if (activeTab === "places") {
            setSelectedCourse(null);
            setCoursePath([]);
            setCoursePlaces([]);
        }
    }, [activeTab]);

    // 현재 위치로 이동
    const moveToMyLocation = useCallback(async () => {
        setLoading(true);
        try {
            if (!ExpoLocation) {
                showToast("위치 기능은 새 dev build 설치 후 사용할 수 있어요");
                await fetchData(center.latitude, center.longitude);
                return;
            }

            const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                showToast("위치 권한이 거부되었어요");
                await fetchData(center.latitude, center.longitude);
                return;
            }

            const pos = await ExpoLocation.getCurrentPositionAsync({
                accuracy: ExpoLocation.Accuracy.Balanced,
            });
            const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setUserLocation(loc);
            setCenter(loc);
            mapRef.current?.animateCameraTo({ latitude: loc.latitude, longitude: loc.longitude, zoom: 16 });
            await fetchData(loc.latitude, loc.longitude);
        } catch {
            showToast("위치를 가져올 수 없어요");
            await fetchData(center.latitude, center.longitude);
        } finally {
            setLoading(false);
        }
    }, [fetchData, center, showToast]);

    // 검색
    const handleSearch = useCallback(async () => {
        if (!searchInput.trim()) return;
        setLoading(true);
        setSelectedPlace(null);
        try {
            const res = await fetch(`${BASE_URL}/api/places/search-single?query=${encodeURIComponent(searchInput)}`);
            const data = await res.json();
            if (data.success && data.place) {
                const loc = { latitude: parseFloat(data.place.lat), longitude: parseFloat(data.place.lng) };
                setCenter(loc);
                mapRef.current?.animateCameraTo({ ...loc, zoom: 15 });
                await fetchData(loc.latitude, loc.longitude, searchInput);
                setShowSearchBtn(false);
                setSearchInput("");
                snapPanel("default");
            } else { showToast("검색 결과가 없어요"); }
        } catch { showToast("검색 중 오류가 발생했어요"); }
        finally { setLoading(false); }
    }, [searchInput, fetchData, showToast, snapPanel]);

    // 장소 클릭
    const handlePlaceClick = useCallback((place: Place) => {
        setSelectedPlace(place);
        setCenter({ latitude: place.latitude, longitude: place.longitude });
        mapRef.current?.animateCameraTo({ latitude: place.latitude, longitude: place.longitude, zoom: 17 });
        snapPanel("default");
        setShowSearchBtn(false);
    }, [snapPanel]);

    // 길찾기
    const handleFindWay = useCallback((place: Place) => {
        const appUrl = `nmap://route/public?dlat=${place.latitude}&dlng=${place.longitude}&dname=${encodeURIComponent(place.name)}&appname=${encodeURIComponent("kr.io.dona.dona")}`;
        Linking.canOpenURL(appUrl).then(can => {
            if (can) Linking.openURL(appUrl);
            else Linking.openURL(`https://map.naver.com/p/search/${encodeURIComponent(place.name)}`);
        });
    }, []);

    // --- 렌더할 마커 목록 ---
    const markerPlaces = useMemo(() => {
        if (activeTab === "courses") {
            return selectedCourse ? coursePlaces : [];
        }
        return places;
    }, [activeTab, selectedCourse, coursePlaces, places]);

    // Expo Go 폴백
    if (!NaverMapView) {
        return (
            <View style={[styles.root, { backgroundColor: t.bg }]}>
                <View style={styles.fallback}>
                    <Text style={styles.fallbackEmoji}>🗺️</Text>
                    <Text style={[styles.fallbackTitle, { color: t.text }]}>지도는 앱 빌드에서 사용 가능합니다</Text>
                    <Text style={[styles.fallbackSub, { color: t.textMuted }]}>EAS dev build 후 이용해주세요</Text>
                </View>
            </View>
        );
    }

    const panelBgColor = t.isDark ? "#1a241b" : "#ffffff";
    const borderColor = t.isDark ? "#2d3748" : "#e5e7eb";

    return (
        <View style={[styles.root, { backgroundColor: t.bg }]}>
            {/* 지도 */}
            <NaverMapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                camera={{ latitude: center.latitude, longitude: center.longitude, zoom: 15 }}
                isNightModeEnabled={t.isDark}
                isScrollGesturesEnabled
                isZoomGesturesEnabled
                isRotateGesturesEnabled
                isShowZoomControls={false}
                isShowCompass={false}
                isShowScaleBar={false}
                isShowLocationButton={false}
                onCameraChanged={(e: any) => {
                    setShowSearchBtn(true);
                    if (e?.latitude != null && e?.longitude != null) {
                        cameraCenterRef.current = { latitude: e.latitude, longitude: e.longitude };
                    }
                }}
            >
                {/* 내 위치 마커 */}
                {userLocation && NaverMapMarkerOverlay && (
                    <NaverMapMarkerOverlay
                        latitude={userLocation.latitude}
                        longitude={userLocation.longitude}
                        width={60}
                        height={60}
                        anchor={{ x: 0.5, y: 0.5 }}
                        zIndex={2000}
                    >
                        <UserLocationMarker />
                    </NaverMapMarkerOverlay>
                )}

                {/* 장소 마커 — 웹과 동일 PNG (MAP_MARKER_IMAGES) */}
                {/* 장소 마커 (장소 탭 or 코스 선택 후 coursePlaces) */}
                {NaverMapMarkerOverlay && markerPlaces
                    .filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
                    .map(place => {
                    const catKey = getCatKey(place.category || place.name);
                    const isSelected = selectedPlace?.id === place.id;
                    const size = isSelected ? 42 : 34;
                    const imgs = MAP_MARKER_IMAGES[catKey];
                    return (
                        <NaverMapMarkerOverlay
                            key={`${place.id}-${isSelected ? "1" : "0"}`}
                            latitude={place.latitude}
                            longitude={place.longitude}
                            image={isSelected ? imgs.selected : imgs.normal}
                            width={size}
                            height={size}
                            anchor={{ x: 0.5, y: 1.0 }}
                            zIndex={isSelected ? 1000 : place.source === "db" ? 500 : 100}
                            onTap={() => handlePlaceClick(place)}
                        />
                    );
                })}

                {/* 코스 마커 (코스 탭 + 코스 미선택 시) */}
                {NaverMapMarkerOverlay && activeTab === "courses" && !selectedCourse &&
                    courses
                        .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
                        .map((c) => {
                            const imgs = MAP_MARKER_IMAGES["play"];
                            return (
                                <NaverMapMarkerOverlay
                                    key={`course-${c.id}`}
                                    latitude={c.latitude!}
                                    longitude={c.longitude!}
                                    image={imgs.normal}
                                    width={34}
                                    height={34}
                                    anchor={{ x: 0.5, y: 1.0 }}
                                    zIndex={300}
                                    onTap={() => handleCourseSelect(c)}
                                />
                            );
                        })
                }

                {/* 코스 루트 폴리라인 */}
                {NaverMapPolylineOverlay && activeTab === "courses" && selectedCourse && coursePath.length >= 2 && (
                    <NaverMapPolylineOverlay
                        coords={coursePath}
                        width={6}
                        color="#10b981"
                        joinType="Round"
                        capType="Round"
                        zIndex={300}
                    />
                )}
            </NaverMapView>

            {/* 상단 플로팅 UI */}
            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
                {/* 뒤로가기 + 검색창 */}
                <View style={styles.searchRow}>
                    {/* 뒤로가기 버튼 */}
                    <TouchableOpacity
                        style={[styles.backBtn, { backgroundColor: t.card, shadowColor: "#000" }]}
                        onPress={() => router.back()}
                        activeOpacity={0.8}
                    >
                        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth={2.5}>
                            <Path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                    </TouchableOpacity>
                    <View style={[styles.searchBox, { backgroundColor: t.card, shadowColor: "#000" }]}>
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="#6bb88a">
                            <Path fillRule="evenodd" clipRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" />
                        </Svg>
                        <TextInput
                            style={[styles.searchInput, { color: t.text }]}
                            placeholder="장소, 맛집, 코스 검색"
                            placeholderTextColor={t.textMuted}
                            value={searchInput}
                            onChangeText={setSearchInput}
                            onSubmitEditing={handleSearch}
                            returnKeyType="search"
                        />
                    </View>
                </View>

                {/* 탭 + 현 지도 검색 */}
                <View style={styles.tabRow}>
                    <View style={[styles.tabPill, { backgroundColor: t.card }]}>
                        <View style={[styles.tabIndicator, { left: activeTab === "places" ? 2 : undefined, right: activeTab === "courses" ? 2 : undefined }]} />
                        <TouchableOpacity
                            style={styles.tabBtn}
                            onPress={() => { setActiveTab("places"); setSelectedPlace(null); snapPanel("default"); }}
                        >
                            <Text style={[styles.tabText, activeTab === "places" ? styles.tabTextActive : { color: t.textMuted }]}>장소</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.tabBtn}
                            onPress={() => {
                                setActiveTab("courses");
                                snapPanel("default");
                                const { latitude, longitude } = cameraCenterRef.current;
                                fetchData(latitude, longitude);
                            }}
                        >
                            <Text style={[styles.tabText, activeTab === "courses" ? styles.tabTextActive : { color: t.textMuted }]}>코스</Text>
                        </TouchableOpacity>
                    </View>
                    {showSearchBtn && (
                        <TouchableOpacity style={[styles.areaSearchBtn, { backgroundColor: t.card }]} onPress={fetchAreaSearch}>
                            <Text style={styles.areaSearchText}>현 지도 검색</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* 토스트 */}
            {toast ? (
                <View style={styles.toast} pointerEvents="none">
                    <Text style={styles.toastText}>{toast}</Text>
                </View>
            ) : null}

            {/* 내 위치 버튼 */}
            <Animated.View
                style={[styles.locationBtn, { bottom: locationBtnAnim }]}
            >
                <TouchableOpacity
                    style={[styles.locationBtnInner, { backgroundColor: t.card, borderColor }]}
                    onPress={moveToMyLocation}
                    activeOpacity={0.8}
                >
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill={t.isDark ? "#fff" : "#374151"}>
                        <Path fillRule="evenodd" clipRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" />
                    </Svg>
                </TouchableOpacity>
            </Animated.View>

            {/* 바텀 시트 */}
            <Animated.View
                style={[
                    styles.panel,
                    {
                        backgroundColor: panelBgColor,
                        height: panelHeight,
                        bottom: 0,
                        shadowColor: "#000",
                    }
                ]}
            >
                {/* 드래그 핸들 */}
                <View style={styles.handleArea} {...panResponder.panHandlers}>
                    <View style={[styles.handle, { backgroundColor: t.isDark ? "#374151" : "#d1d5db" }]} />
                </View>

                {/* 패널 헤더 */}
                {!selectedPlace && (
                    <View style={[styles.panelHeader, { borderBottomColor: borderColor }]}>
                        <View style={{ flex: 1 }}>
                            {activeTab === "courses" && selectedCourse ? (
                                <TouchableOpacity
                                    onPress={() => router.push(`/courses/${selectedCourse.id.replace("c-", "")}` as any)}
                                    activeOpacity={0.7}
                                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                                >
                                    <Text style={[styles.panelTitle, { color: t.text }]}>{selectedCourse.title}</Text>
                                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth={2.5}>
                                        <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                                    </Svg>
                                </TouchableOpacity>
                            ) : (
                                <Text style={[styles.panelTitle, { color: t.text }]}>
                                    {activeTab === "places" ? "내 주변 장소" : "추천 데이트 코스"}
                                </Text>
                            )}
                            <Text style={[styles.panelSub, { color: t.textMuted }]}>
                                {activeTab === "places"
                                    ? `지도에 ${places.length}개의 장소가 있어요`
                                    : selectedCourse
                                        ? selectedCourse.description || "코스에 포함된 장소예요"
                                        : "엄선된 코스를 확인해보세요"}
                            </Text>
                        </View>
                        {activeTab === "courses" && selectedCourse && (
                            <TouchableOpacity
                                style={styles.closeCourseBtn}
                                onPress={() => { setSelectedCourse(null); setCoursePath([]); setCoursePlaces([]); }}
                            >
                                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth={2}>
                                    <Path d="M18 6L6 18M6 6l12 12" />
                                </Svg>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* 패널 컨텐츠 */}
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 4 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {loading ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color="#6bb88a" />
                            <Text style={[styles.loadingText, { color: t.textMuted }]}>정보를 불러오고 있어요...</Text>
                        </View>
                    ) : selectedPlace ? (
                        // 장소 상세
                        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
                            <View style={styles.detailHeader}>
                                <View style={[styles.categoryBadge, { backgroundColor: t.isDark ? "rgba(107,184,138,0.15)" : "#f0fdf4" }]}>
                                    <Text style={[styles.categoryBadgeText, { color: "#6bb88a" }]}>
                                        {selectedPlace.category || "추천 장소"}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.closeDetailBtn}
                                    onPress={() => setSelectedPlace(null)}
                                >
                                    <Svg width={22} height={22} viewBox="0 0 24 24" fill={t.textMuted}>
                                        <Path fillRule="evenodd" clipRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" />
                                    </Svg>
                                </TouchableOpacity>
                            </View>
                            <Text style={[styles.detailName, { color: t.text }]}>{selectedPlace.name}</Text>
                            <Text style={[styles.detailAddress, { color: t.textMuted }]}>{selectedPlace.address}</Text>
                            <View style={styles.detailActions}>
                                <TouchableOpacity
                                    style={[styles.phoneBtn, { borderColor, backgroundColor: t.card }]}
                                    onPress={() => selectedPlace.phone
                                        ? Linking.openURL(`tel:${selectedPlace.phone}`)
                                        : showToast("전화번호 정보가 없어요")}
                                >
                                    <Svg width={20} height={20} viewBox="0 0 24 24" fill={t.textMuted}>
                                        <Path fillRule="evenodd" clipRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" />
                                    </Svg>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.dirBtn}
                                    onPress={() => handleFindWay(selectedPlace)}
                                >
                                    <Text style={styles.dirBtnText}>길찾기</Text>
                                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="#fff">
                                        <Path fillRule="evenodd" clipRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" />
                                    </Svg>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : activeTab === "courses" && selectedCourse && courseLoading ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="small" color="#6bb88a" />
                            <Text style={[styles.loadingText, { color: t.textMuted }]}>장소 불러오는 중...</Text>
                        </View>
                    ) : (
                        // 목록
                        <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
                            {(activeTab === "places" ? places : selectedCourse ? coursePlaces : courses).length === 0 ? (
                                <View style={styles.emptyBox}>
                                    <Text style={{ fontSize: 36 }}>🤔</Text>
                                    <Text style={[styles.emptyText, { color: t.textMuted }]}>
                                        {activeTab === "courses" && selectedCourse
                                            ? "이 코스에 등록된 장소가 없어요."
                                            : "이 근처에는 아직 정보가 없어요.\n지도를 조금만 이동해볼까요?"}
                                    </Text>
                                </View>
                            ) : (
                                (activeTab === "places" ? places : selectedCourse ? coursePlaces : courses).map((item: any) => {
                                    const isCourse = "title" in item && typeof item.title === "string";
                                    const catKey = isCourse ? "play" : getCatKey(item.category || item.name);
                                    const isSelectedCourse = isCourse && selectedCourse?.id === item.id;
                                    return (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={[
                                                styles.listItem,
                                                {
                                                    backgroundColor: t.card,
                                                    borderColor: isSelectedCourse ? "#6bb88a" : borderColor,
                                                    shadowColor: "#000",
                                                }
                                            ]}
                                            onPress={() => {
                                                if (activeTab === "courses" && !selectedCourse) handleCourseSelect(item);
                                                else handlePlaceClick(item);
                                            }}
                                            activeOpacity={0.75}
                                        >
                                            {/* 아이콘 박스 */}
                                            <View style={[styles.iconBox, { backgroundColor: t.isDark ? "#243026" : "#f9fafb" }]}>
                                                <CatIcon catKey={catKey} size={28} />
                                            </View>
                                            {/* 텍스트 */}
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                                <View style={styles.badgeRow}>
                                                    <View style={[
                                                        styles.badge,
                                                        isCourse
                                                            ? { backgroundColor: t.isDark ? "rgba(99,102,241,0.15)" : "#eef2ff", borderColor: t.isDark ? "rgba(99,102,241,0.3)" : "#e0e7ff" }
                                                            : { backgroundColor: t.isDark ? "rgba(107,184,138,0.15)" : "#f0fdf4", borderColor: t.isDark ? "rgba(107,184,138,0.3)" : "#dcfce7" }
                                                    ]}>
                                                        <Text style={[styles.badgeText, { color: isCourse ? (t.isDark ? "#818cf8" : "#4f46e5") : "#6bb88a" }]}>
                                                            {isCourse ? "추천 코스" : item.category || "장소"}
                                                        </Text>
                                                    </View>
                                                    {isCourse && isSelectedCourse && (
                                                        <TouchableOpacity onPress={(e) => { router.push(`/courses/${item.id.replace("c-", "")}`); }}>
                                                            <Text style={{ fontSize: 11, fontWeight: "500", color: "#6bb88a" }}>상세 보기</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                                <Text style={[styles.itemName, { color: t.text }]} numberOfLines={1}>
                                                    {item.name || item.title}
                                                </Text>
                                                <Text style={[styles.itemSub, { color: t.textMuted }]} numberOfLines={1}>
                                                    {isCourse ? item.description : item.address}
                                                </Text>
                                            </View>
                                            {/* 화살표 */}
                                            <View style={[styles.arrowBox, { backgroundColor: t.isDark ? "#243026" : "#f9fafb" }]}>
                                                <Svg width={18} height={18} viewBox="0 0 24 24" fill={t.textMuted}>
                                                    <Path fillRule="evenodd" clipRule="evenodd" d="M12.97 3.97a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06l6.22-6.22H3a.75.75 0 010-1.5h16.19l-6.22-6.22a.75.75 0 010-1.06z" />
                                                </Svg>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </View>
            )}
                </ScrollView>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    fallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    fallbackEmoji: { fontSize: 48, marginBottom: 8 },
    fallbackTitle: { fontSize: 16, fontWeight: "500" },
    fallbackSub: { fontSize: 13 },

    // 상단
    topBar: {
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 30,
        paddingHorizontal: 12, paddingBottom: 8,
    },
    searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    backBtn: {
        width: 38, height: 38, borderRadius: 10,
        alignItems: "center", justifyContent: "center", flexShrink: 0,
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
    },
    searchBox: {
        flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
        paddingHorizontal: 12, paddingVertical: 10,
        borderRadius: 12, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
    },
    searchInput: { flex: 1, fontSize: 13, fontWeight: "500", padding: 0 },

    tabRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    tabPill: {
        flexDirection: "row", borderRadius: 20, padding: 3,
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
        position: "relative", overflow: "hidden",
    },
    tabIndicator: {
        position: "absolute", top: 3, bottom: 3, width: "48%",
        backgroundColor: "#6bb88a", borderRadius: 17,
    },
    tabBtn: { paddingHorizontal: 20, paddingVertical: 6, zIndex: 1 },
    tabText: { fontSize: 12, fontWeight: "500" },
    tabTextActive: { color: "#fff" },
    areaSearchBtn: {
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
    },
    areaSearchText: { fontSize: 12, fontWeight: "500", color: "#6bb88a" },

    // 토스트
    toast: {
        position: "absolute", top: 110, alignSelf: "center", zIndex: 60,
        backgroundColor: "rgba(31,41,55,0.95)", paddingHorizontal: 20, paddingVertical: 12,
        borderRadius: 24, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
    },
    toastText: { color: "#fff", fontSize: 13, fontWeight: "500" },

    // 내 위치 버튼
    locationBtn: { position: "absolute", right: 16, zIndex: 20 },
    locationBtnInner: {
        width: 48, height: 48, borderRadius: 24, borderWidth: 1,
        alignItems: "center", justifyContent: "center",
        shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
    },

    // 바텀 시트
    panel: {
        position: "absolute", left: 0, right: 0,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
        zIndex: 40,
    },
    handleArea: { alignItems: "center", paddingTop: 12, paddingBottom: 4 },
    handle: { width: 48, height: 6, borderRadius: 3 },
    panelHeader: {
        flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
        paddingHorizontal: 20, paddingVertical: 12,
        borderBottomWidth: 1,
    },
    panelTitle: { fontSize: 17, fontWeight: "600", marginBottom: 3 },
    panelSub: { fontSize: 12 },
    closeCourseBtn: { padding: 8 },

    // 로딩/빈상태
    loadingBox: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 10 },
    loadingText: { fontSize: 13, fontWeight: "500" },
    emptyBox: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 8 },
    emptyText: { fontSize: 14, fontWeight: "500", textAlign: "center", lineHeight: 22 },

    // 장소 상세
    detailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, marginTop: 4 },
    categoryBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
    categoryBadgeText: { fontSize: 12, fontWeight: "500" },
    closeDetailBtn: { padding: 8 },
    detailName: { fontSize: 18, fontWeight: "600", marginBottom: 4, lineHeight: 24 },
    detailAddress: { fontSize: 13, marginBottom: 20, lineHeight: 18 },
    detailActions: { flexDirection: "row", gap: 10, height: 44 },
    phoneBtn: {
        width: 44, height: 44, borderWidth: 1, borderRadius: 10,
        alignItems: "center", justifyContent: "center",
    },
    dirBtn: {
        flex: 1, height: 44, backgroundColor: "#6bb88a", borderRadius: 10,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
    },
    dirBtnText: { color: "#fff", fontSize: 14, fontWeight: "500" },

    // 목록
    listItem: {
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10,
        borderRadius: 16, borderWidth: 1,
        shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    iconBox: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    badgeText: { fontSize: 11, fontWeight: "500" },
    itemName: { fontSize: 13, fontWeight: "500", marginBottom: 2 },
    itemSub: { fontSize: 12 },
    arrowBox: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
