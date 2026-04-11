import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Linking,
    Modal,
    Pressable,
    Dimensions,
    Platform,
    BackHandler,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useLocale } from "../../lib/useLocale";
import { pickPlaceName } from "../../lib/courseLocalized";
import { BASE_URL } from "../../lib/api";
import type { CoursePlaceTipsRow } from "../../../../src/types/tip";
import type { PlaceData, CoursePlace } from "./types";
import { MAP_PURPLE, NAVER_BTN_GRAY, STEP_PIN_IMAGES } from "./constants";
import {
    getPlaceImageUrl,
    getPlaceLatLng,
    getPlaceMapUrl,
    getPlaceReservationUrl,
    getNaverAppRouteUrl,
    getWalkingMinutes,
    coursePlaceToTipsRow,
} from "./utils";

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

const NAVER_MAP_CLIENT_ID = "4gfc00t72p";

// 선택형 코스 마커 라벨 정보
export type PlaceLabelInfo = {
    label: string;          // "1", "2A", "2B" 등
    isMainPath: boolean;    // 현재 선택된 경로에 포함
    isSegmentOption: boolean;
    segment?: string;
};

// 선택형 스텝 타입
export type SelectionStep =
    | { type: "fixed"; coursePlace: CoursePlace }
    | { type: "segment"; segment: string; options: CoursePlace[] };

function buildNaverMapHtml(
    places: CoursePlace[],
    selectedIndex: number | null,
    routeMode: "full" | "segment",
    routeCoords: { lat: number; lng: number }[] | undefined,
    unnamedPlace: (index: number) => string,
    labelInfos?: PlaceLabelInfo[],
    locale?: string,
): string {
    const placeData = places.map((cp, i) => {
        const p = cp.place;
        const info = labelInfos?.[i];
        if (!p) return { idx: i, name: "", lat: null, lng: null, label: String(i + 1), isMainPath: true };
        const lat = Number(p.latitude ?? p.lat);
        const lng = Number(p.longitude ?? p.lng);
        const localizedName = locale ? pickPlaceName(p as any, locale as any) : (p.name || unnamedPlace(i + 1));
        return {
            idx: i,
            name: localizedName || unnamedPlace(i + 1),
            lat: Number.isFinite(lat) ? lat : null,
            lng: Number.isFinite(lng) ? lng : null,
            label: info?.label ?? String(i + 1),
            isMainPath: info ? info.isMainPath : true,
        };
    });

    const mainPathData = placeData.filter((p) => p.isMainPath && p.lat !== null);
    const isSelectionType = !!(labelInfos && labelInfos.some((l) => l.isSegmentOption));

    const placesJson = JSON.stringify(placeData);
    const mainPathJson = JSON.stringify(mainPathData);
    const selIdxStr = selectedIndex === null ? "null" : String(selectedIndex);
    const routeModeStr = JSON.stringify(routeMode);
    const routeCoordsJson = routeCoords ? JSON.stringify(routeCoords) : "null";

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <style>* { margin:0; padding:0; box-sizing:border-box; } html,body,#map { width:100%; height:100%; background:#e5e7eb; }</style>
</head>
<body>
  <div id="map"></div>
  <script>
    var PLACES = ${placesJson};
    var MAIN_PATH = ${mainPathJson};
    var SELECTED = ${selIdxStr};
    var ROUTE_MODE = ${routeModeStr};
    var ROUTE_COORDS = ${routeCoordsJson};
    var IS_SEL = ${isSelectionType};

    function postMsg(msg) { try { window.ReactNativeWebView.postMessage(msg); } catch(e) {} }

    function initMap() {
      var nm = window.naver.maps;
      var validPlaces = PLACES.filter(function(p) { return p.lat !== null && p.lng !== null; });
      var center;
      if (IS_SEL && MAIN_PATH.length > 0) {
        var sLat=0,sLng=0; MAIN_PATH.forEach(function(p){sLat+=p.lat;sLng+=p.lng;});
        center = new nm.LatLng(sLat/MAIN_PATH.length, sLng/MAIN_PATH.length);
      } else if (SELECTED !== null && PLACES[SELECTED] && PLACES[SELECTED].lat !== null) {
        center = new nm.LatLng(PLACES[SELECTED].lat, PLACES[SELECTED].lng);
      } else if (validPlaces.length > 0) {
        var sLat=0,sLng=0; validPlaces.forEach(function(p){sLat+=p.lat;sLng+=p.lng;});
        center = new nm.LatLng(sLat/validPlaces.length, sLng/validPlaces.length);
      } else { center = new nm.LatLng(37.5665, 126.978); }

      var map = new nm.Map('map', { center:center, zoom:14, mapTypeControl:false, scaleControl:false, logoControl:true, mapDataControl:false, zoomControl:false });
      nm.Event.addListener(map, 'click', function() { postMsg('mapClick'); });

      var showAll = ROUTE_MODE === 'full' || SELECTED === null || SELECTED === 0;
      PLACES.forEach(function(place, idx) {
        if (place.lat === null || place.lng === null) return;
        if (!IS_SEL && !showAll && idx !== SELECTED-1 && idx !== SELECTED) return;
        var isSel = SELECTED !== null && idx === SELECTED;
        var isMain = IS_SEL ? place.isMainPath : true;
        var bg, sz, fs, border, anchor, opacity;
        if (IS_SEL) {
          var isSel2 = SELECTED !== null && idx === SELECTED;
          if (isMain) { bg=isSel2?'#5347AA':'#5bc770'; sz='30px'; fs='11px'; border='2px solid #fff'; anchor=15; opacity=1; }
          else        { bg='rgba(110,110,110,0.55)'; sz='30px'; fs='11px'; border='1px solid rgba(255,255,255,0.4)'; anchor=15; opacity=0.75; }
        } else {
          bg = isSel?'#5347AA':'#99c08e'; sz=isSel?'40px':'30px'; fs=isSel?'15px':'13px';
          border=isSel?'3px solid #fff':'2px solid rgba(255,255,255,0.6)'; anchor=isSel?20:15; opacity=1;
        }
        var content = '<div style="width:'+sz+';height:'+sz+';border-radius:50%;background:'+bg+';color:#fff;font-weight:700;font-size:'+fs+';display:flex;align-items:center;justify-content:center;border:'+border+';box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;opacity:'+opacity+';">'+place.label+'</div>';
        var marker = new nm.Marker({ position: new nm.LatLng(place.lat, place.lng), map:map, icon:{ content:content, anchor:new nm.Point(anchor,anchor) }, zIndex: isMain ? 100 : 5 });
        (function(i){ nm.Event.addListener(marker,'click',function(e){ if(e&&e.domEvent) try{e.domEvent.stopPropagation();}catch(ex){} postMsg('placeClick:'+i); }); })(idx);
      });

      // 폴리라인
      if (IS_SEL) {
        var mainPts = MAIN_PATH.filter(function(p){return p.lat!==null;}).map(function(p){return new nm.LatLng(p.lat,p.lng);});
        if (mainPts.length >= 2) new nm.Polyline({ map:map, path:mainPts, strokeColor:'#5bc770', strokeWeight:5, strokeOpacity:0.9, strokeLineCap:'round', strokeLineJoin:'round' });
        // 비선택 옵션 → 점선
        PLACES.forEach(function(place) {
          if (!place.isMainPath && place.lat!==null) {
            var prevMain=null;
            for(var k=PLACES.indexOf(place)-1;k>=0;k--){ if(PLACES[k]&&PLACES[k].isMainPath&&PLACES[k].lat!==null){prevMain=PLACES[k];break;} }
            if(prevMain) new nm.Polyline({ map:map, path:[new nm.LatLng(prevMain.lat,prevMain.lng),new nm.LatLng(place.lat,place.lng)], strokeColor:'#9ca3af', strokeWeight:3, strokeOpacity:0.6, strokeStyle:'shortdash', strokeLineCap:'round' });
          }
        });
        // 뷰 맞추기
        if (validPlaces.length > 1) {
          var b=new nm.LatLngBounds(); validPlaces.forEach(function(p){b.extend(new nm.LatLng(p.lat,p.lng));}); try{map.fitBounds(b,{top:60,right:50,bottom:180,left:50});}catch(e){}
        }
      } else {
        var pathPts=[];
        if(ROUTE_COORDS&&ROUTE_COORDS.length>=2) pathPts=ROUTE_COORDS.map(function(c){return new nm.LatLng(c.lat,c.lng);});
        else if(ROUTE_MODE==='full') pathPts=validPlaces.map(function(p){return new nm.LatLng(p.lat,p.lng);});
        else if(SELECTED!==null&&SELECTED>0){ var from=PLACES[SELECTED-1],to=PLACES[SELECTED]; if(from&&from.lat!==null&&to&&to.lat!==null) pathPts=[new nm.LatLng(from.lat,from.lng),new nm.LatLng(to.lat,to.lng)]; }
        if(pathPts.length>=2) new nm.Polyline({map:map,path:pathPts,strokeColor:'#99c08e',strokeWeight:5,strokeOpacity:0.9,strokeLineCap:'round',strokeLineJoin:'round'});
        if(ROUTE_MODE==='full'&&validPlaces.length>1){ var b=new nm.LatLngBounds(); validPlaces.forEach(function(p){b.extend(new nm.LatLng(p.lat,p.lng));}); try{map.fitBounds(b,{top:50,right:40,bottom:180,left:40});}catch(e){} }
        else if(ROUTE_MODE!=='full'&&pathPts.length>=2){ var b2=new nm.LatLngBounds(); pathPts.forEach(function(pt){b2.extend(pt);}); try{map.fitBounds(b2,{top:80,right:60,bottom:200,left:60});}catch(e){} }
        else if(SELECTED!==null&&PLACES[SELECTED]&&PLACES[SELECTED].lat!==null){ map.setCenter(new nm.LatLng(PLACES[SELECTED].lat,PLACES[SELECTED].lng)); map.setZoom(16); }
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

export function CourseMapModal({
    visible,
    places,
    selectedIndex,
    routeMode,
    onSelectIndex,
    onResetRoute,
    onClose,
    onOpenDetail,
    onReserve,
    selectionSteps,
    selectedBySegment,
    onSegmentOptionSelect,
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
    selectionSteps?: SelectionStep[];
    selectedBySegment?: Record<string, number>;
    onSegmentOptionSelect?: (segment: string, placeId: number) => void;
}) {
    const t = useThemeColors();
    const { t: i18n, locale } = useLocale();
    const insets = useSafeAreaInsets();
    const safeIndex =
        selectedIndex !== null ? Math.max(0, Math.min(selectedIndex, Math.max(0, places.length - 1))) : null;
    const current = safeIndex !== null ? places[safeIndex]?.place : null;
    const effectiveRouteMode = safeIndex === null ? "full" : routeMode;
    const currentImage = getPlaceImageUrl(current ?? undefined);

    // 선택된 경로 장소만 (폴리라인 & 지도 카메라용)
    const mainPathCps = useMemo(() => {
        if (!selectionSteps?.length) return places;
        return selectionSteps.map((step) => {
            if (step.type === "fixed") return step.coursePlace;
            const selId = Number((selectedBySegment ?? {})[step.segment] ?? 0);
            return step.options.find((cp) => Number(cp.place_id ?? cp.place?.id) === selId) ?? step.options[0];
        }).filter(Boolean) as CoursePlace[];
    }, [selectionSteps, selectedBySegment, places]);

    // 비선택 옵션 마커 탭 시 미리보기 (즉시 선택 대신 하단 카드에 표시)
    const [previewSegmentPlace, setPreviewSegmentPlace] = useState<{
        place: PlaceData;
        segment: string;
        cp: CoursePlace;
    } | null>(null);

    // 미리보기 중일 때 해당 세그먼트를 preview 장소로 교체한 경로
    const effectiveMainPathCps = useMemo(() => {
        if (!previewSegmentPlace || !selectionSteps?.length) return mainPathCps;
        return selectionSteps.map((step) => {
            if (step.type === "fixed") return step.coursePlace;
            if (step.segment === previewSegmentPlace.segment) return previewSegmentPlace.cp;
            const selId = Number((selectedBySegment ?? {})[step.segment] ?? 0);
            return step.options.find((cp) => Number(cp.place_id ?? cp.place?.id) === selId) ?? step.options[0];
        }).filter(Boolean) as CoursePlace[];
    }, [previewSegmentPlace, selectionSteps, selectedBySegment, mainPathCps]);

    // prev: 선택형은 effectiveMainPathCps 기준, 일반형은 places 기준
    const prev = useMemo((): PlaceData | undefined => {
        if (safeIndex === null || safeIndex <= 0) return undefined;
        if (effectiveMainPathCps.length > 0 && selectionSteps?.length) {
            const curPid = Number(places[safeIndex]?.place_id ?? places[safeIndex]?.place?.id);
            const curIdxInMain = effectiveMainPathCps.findIndex(
                (cp) => Number(cp.place_id ?? cp.place?.id) === curPid,
            );
            if (curIdxInMain > 0) return effectiveMainPathCps[curIdxInMain - 1]?.place as PlaceData | undefined;
            return undefined;
        }
        return places[safeIndex - 1]?.place as PlaceData | undefined;
    }, [safeIndex, places, effectiveMainPathCps, selectionSteps]);

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

    const navBottom = insets.bottom;
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

    // ── 선택형 코스: 라벨맵 & 주경로 장소 목록 ────────────────────────────────
    const labelInfos = useMemo((): PlaceLabelInfo[] | undefined => {
        if (!selectionSteps?.length) return undefined;
        const pidToInfo = new Map<number, PlaceLabelInfo>();
        selectionSteps.forEach((step, stepIdx) => {
            const num = stepIdx + 1;
            if (step.type === "fixed") {
                const pid = Number(step.coursePlace.place_id ?? step.coursePlace.place?.id);
                if (pid) pidToInfo.set(pid, { label: String(num), isMainPath: true, isSegmentOption: false });
            } else {
                const selId = Number((selectedBySegment ?? {})[step.segment] ?? 0);
                step.options.forEach((cp, optIdx) => {
                    const pid = Number(cp.place_id ?? cp.place?.id);
                    const letter = String.fromCharCode(65 + optIdx);
                    if (pid) pidToInfo.set(pid, {
                        label: `${num}${letter}`,
                        isMainPath: pid === selId,
                        isSegmentOption: true,
                        segment: step.segment,
                    });
                });
            }
        });
        return places.map((cp) => {
            const pid = Number(cp.place_id ?? cp.place?.id);
            return pidToInfo.get(pid) ?? { label: "?", isMainPath: false, isSegmentOption: false };
        });
    }, [selectionSteps, selectedBySegment, places]);

    // preview 상태를 반영한 labelInfos (마커/점선/step row에서 일관되게 사용)
    const effectiveLabelInfos = useMemo((): PlaceLabelInfo[] | undefined => {
        if (!labelInfos || !previewSegmentPlace) return labelInfos;
        const previewPid = Number(previewSegmentPlace.cp.place_id ?? previewSegmentPlace.cp.place?.id);
        return labelInfos.map((info, idx) => {
            if (!info.isSegmentOption || info.segment !== previewSegmentPlace.segment) return info;
            const pid = Number(places[idx]?.place_id ?? places[idx]?.place?.id);
            return { ...info, isMainPath: pid === previewPid };
        });
    }, [labelInfos, previewSegmentPlace, places]);

    // 미리보기 장소 도보 시간
    const previewWalkMins = useMemo(() => {
        if (!previewSegmentPlace || !selectionSteps) return null;
        const stepIdx = selectionSteps.findIndex(
            (s) => s.type === "segment" && s.segment === previewSegmentPlace.segment,
        );
        if (stepIdx <= 0) return null;
        const prevStep = selectionSteps[stepIdx - 1];
        let prevPlace: PlaceData | null = null;
        if (prevStep.type === "fixed") {
            prevPlace = prevStep.coursePlace.place as PlaceData;
        } else {
            const selId = Number((selectedBySegment ?? {})[prevStep.segment] ?? 0);
            prevPlace =
                (prevStep.options.find((o) => Number(o.place_id ?? o.place?.id) === selId)?.place as PlaceData) ??
                (prevStep.options[0]?.place as PlaceData) ??
                null;
        }
        if (!prevPlace) return null;
        const a = getPlaceLatLng(prevPlace);
        const b = getPlaceLatLng(previewSegmentPlace.place);
        if (!a || !b) return null;
        return getWalkingMinutes(a.lat, a.lng, b.lat, b.lng);
    }, [previewSegmentPlace, selectionSteps, selectedBySegment]);

    const handleMarkerTap = useCallback((idx: number) => {
        if (!labelInfos) {
            setPreviewSegmentPlace(null);
            onSelectIndex(idx);
            return;
        }
        const info = labelInfos[idx];
        const cp = places[idx];
        if (info?.isSegmentOption && !info.isMainPath && info.segment && cp?.place) {
            // 즉시 선택 대신 미리보기 → 하단 카드에 "이 장소로 변경" 표시
            setPreviewSegmentPlace({ place: cp.place as PlaceData, segment: info.segment, cp });
        } else {
            setPreviewSegmentPlace(null);
            onSelectIndex(idx);
        }
    }, [labelInfos, places, onSelectIndex]);

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
            // 선택형 코스는 effectiveMainPathCps 기준으로 경로 계산
            const pathCps = selectionSteps?.length ? effectiveMainPathCps : places;
            if (effectiveRouteMode === "full") {
                return pathCps.map((cp) => toC(cp.place)).filter(Boolean) as { lat: number; lng: number }[];
            }
            if (safeIndex !== null && safeIndex > 0) {
                const curPid = Number(places[safeIndex]?.place_id ?? places[safeIndex]?.place?.id);
                const curIdxInPath = pathCps.findIndex((cp) => Number(cp.place_id ?? cp.place?.id) === curPid);
                if (curIdxInPath > 0) {
                    const from = toC(pathCps[curIdxInPath - 1]?.place);
                    const to = toC(pathCps[curIdxInPath]?.place);
                    if (from && to) return [from, to];
                }
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
                        { height: sheetH, bottom: 0, backgroundColor: t.card, borderColor: t.isDark ? "#374151" : "#f3f4f6" },
                    ]}
                >
                    <View style={[s.courseMapGrabWeb, { backgroundColor: t.isDark ? "#4b5563" : "#d1d5db" }]} />
                    <View style={[s.courseMapHeader, { borderBottomColor: t.border }]}>
                        <View style={s.mapHeaderRow}>
                            {/* 경로 스텝 버튼 — 선택형 코스면 그룹 단위로 표시 */}
                            <View style={s.mapStepRow}>
                                {effectiveLabelInfos ? (
                                    // 선택형: 주경로 장소들만 버튼으로 표시 (preview 반영)
                                    effectiveMainPathCps.map((cp, stepIdx) => {
                                        const pid = Number(cp.place_id ?? cp.place?.id);
                                        const flatIdx = places.findIndex((p) => Number(p.place_id ?? p.place?.id) === pid);
                                        const label = effectiveLabelInfos[flatIdx]?.label ?? String(stepIdx + 1);
                                        const selected = safeIndex !== null && flatIdx === safeIndex;
                                        return (
                                            <View key={`step-sel-${stepIdx}`} style={s.mapStepItem}>
                                                <TouchableOpacity
                                                    onPress={() => onSelectIndex(flatIdx)}
                                                    style={[s.mapStepCircle, selected ? s.mapStepCircleSelectedWeb : s.mapStepCircleIdleWeb]}
                                                    activeOpacity={0.85}
                                                >
                                                    <Text style={s.mapStepTextWeb}>{label}</Text>
                                                </TouchableOpacity>
                                                {stepIdx < effectiveMainPathCps.length - 1 ? <Text style={s.mapStepArrow}>→</Text> : null}
                                            </View>
                                        );
                                    })
                                ) : (
                                    // 일반 코스: 기존 sequential 번호
                                    places.map((_, idx) => {
                                        const selected = selectedIndex !== null && idx === safeIndex;
                                        return (
                                            <View key={`step-${idx}`} style={s.mapStepItem}>
                                                <TouchableOpacity
                                                    onPress={() => onSelectIndex(idx)}
                                                    style={[s.mapStepCircle, selected ? s.mapStepCircleSelectedWeb : s.mapStepCircleIdleWeb]}
                                                    activeOpacity={0.85}
                                                >
                                                    <Text style={s.mapStepTextWeb}>{idx + 1}</Text>
                                                </TouchableOpacity>
                                                {idx < places.length - 1 ? <Text style={s.mapStepArrow}>→</Text> : null}
                                            </View>
                                        );
                                    })
                                )}
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
                                    const info = effectiveLabelInfos?.[idx];
                                    const isMain = info ? info.isMainPath : true;

                                    // 선택형 코스: View 기반 커스텀 원형 마커 (웹과 동일 — "2A"/"2B" 라벨 표시)
                                    if (effectiveLabelInfos) {
                                        const label = info?.label ?? String(idx + 1);
                                        const isSel = safeIndex === idx;
                                        const SZ = 30;
                                        const bg = isMain
                                            ? (isSel ? "#5347AA" : "#5bc770")
                                            : "rgba(110,110,110,0.55)";
                                        return (
                                            <NaverMapMarkerOverlay
                                                key={`m-${idx}-${isMain ? "main" : "alt"}-${isSel ? "s" : "n"}`}
                                                latitude={lat}
                                                longitude={lng}
                                                width={SZ}
                                                height={SZ}
                                                anchor={{ x: 0.5, y: 0.5 }}
                                                onTap={() => handleMarkerTap(idx)}
                                                zIndex={isMain ? (isSel ? 100 : 50) : 5}
                                            >
                                                <View style={[s.selMarkerCircle, {
                                                    width: SZ, height: SZ, borderRadius: SZ / 2,
                                                    backgroundColor: bg,
                                                    opacity: isMain ? 1 : 0.75,
                                                }]}>
                                                    <Text style={[s.selMarkerLabel, { fontSize: 10 }]}>{label}</Text>
                                                </View>
                                            </NaverMapMarkerOverlay>
                                        );
                                    }

                                    // 일반 코스: 기존 PNG 마커
                                    if (effectiveRouteMode === "segment" && safeIndex !== null && safeIndex > 0) {
                                        if (idx !== safeIndex - 1 && idx !== safeIndex) return null;
                                    }
                                    const isSel = safeIndex === idx;
                                    const pinW = isSel ? 42 : 34;
                                    const pinH = isSel ? 42 : 34;
                                    const stepNo = Math.min(idx + 1, 5);
                                    const stepImgs = STEP_PIN_IMAGES[stepNo];
                                    const markerImg = isSel ? stepImgs.selected : stepImgs.normal;
                                    return (
                                        <NaverMapMarkerOverlay
                                            key={`m-${idx}-${isSel ? "1" : "0"}`}
                                            latitude={lat}
                                            longitude={lng}
                                            image={markerImg}
                                            width={pinW}
                                            height={pinH}
                                            anchor={{ x: 0.5, y: 1.0 }}
                                            onTap={() => handleMarkerTap(idx)}
                                            zIndex={isSel ? 100 : 10}
                                        />
                                    );
                                })}
                                {/* 선택형: 주경로 실선 + 비선택 옵션 점선 */}
                                {effectiveLabelInfos && NaverMapPolylineOverlay && (() => {
                                    const mainCoords = effectiveMainPathCps
                                        .map((cp) => {
                                            const lat = Number(cp.place?.latitude ?? cp.place?.lat);
                                            const lng = Number(cp.place?.longitude ?? cp.place?.lng);
                                            return Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
                                        })
                                        .filter(Boolean) as { latitude: number; longitude: number }[];
                                    // 비선택 옵션 → 수동 점선 세그먼트 생성
                                    const altDashSegs: { latitude: number; longitude: number }[][] = [];
                                    places.forEach((cp, idx) => {
                                        if (!effectiveLabelInfos[idx]?.isSegmentOption || effectiveLabelInfos[idx]?.isMainPath) return;
                                        const toLat = Number(cp.place?.latitude ?? cp.place?.lat);
                                        const toLng = Number(cp.place?.longitude ?? cp.place?.lng);
                                        if (!Number.isFinite(toLat) || !Number.isFinite(toLng)) return;
                                        for (let k = idx - 1; k >= 0; k--) {
                                            if (effectiveLabelInfos[k]?.isMainPath) {
                                                const fLat = Number(places[k]?.place?.latitude ?? places[k]?.place?.lat);
                                                const fLng = Number(places[k]?.place?.longitude ?? places[k]?.place?.lng);
                                                if (Number.isFinite(fLat) && Number.isFinite(fLng)) {
                                                    const from = { latitude: fLat, longitude: fLng };
                                                    const to = { latitude: toLat, longitude: toLng };
                                                    const dLat = to.latitude - from.latitude;
                                                    const dLng = to.longitude - from.longitude;
                                                    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
                                                    const dashFrac = 0.00012 / (dist || 1); // ~13m dash
                                                    const gapFrac = 0.00012 / (dist || 1);
                                                    const segFrac = dashFrac + gapFrac;
                                                    let t = 0;
                                                    while (t < 1) {
                                                        const s = t;
                                                        const e = Math.min(t + dashFrac, 1);
                                                        altDashSegs.push([
                                                            { latitude: from.latitude + s * dLat, longitude: from.longitude + s * dLng },
                                                            { latitude: from.latitude + e * dLat, longitude: from.longitude + e * dLng },
                                                        ]);
                                                        t += segFrac;
                                                    }
                                                }
                                                break;
                                            }
                                        }
                                    });
                                    return (
                                        <>
                                            {mainCoords.length >= 2 && <NaverMapPolylineOverlay coords={mainCoords} width={5} color="#5bc770" joinType="Round" capType="Round" />}
                                            {altDashSegs.map((seg, i) => (
                                                <NaverMapPolylineOverlay key={`dash-${i}`} coords={seg} width={3} color="rgba(140,140,140,0.65)" joinType="Round" capType="Round" />
                                            ))}
                                        </>
                                    );
                                })()}
                                {/* 일반 코스: 기존 경로 */}
                                {!effectiveLabelInfos && routeCoords.length >= 2 && NaverMapPolylineOverlay && (
                                    <NaverMapPolylineOverlay coords={routeCoords} width={5} color="#99c08e" joinType="Round" capType="Round" />
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
                                        effectiveLabelInfos,
                                        locale,
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
                        {/* 하단 장소 정보 (지도 위 절대 오버레이) */}
                        {(current || previewSegmentPlace) ? (() => {
                            const displayPlace = previewSegmentPlace?.place ?? current!;
                            const displayImage = getPlaceImageUrl(displayPlace);
                            // 도보 시간 배지
                            const walkBadge = (() => {
                                if (previewSegmentPlace) {
                                    if (previewWalkMins == null) return null;
                                    return i18n("courseDetail.walkingMinutes", { minutes: previewWalkMins });
                                }
                                if (effectiveRouteMode === "segment" && safeIndex !== null && safeIndex > 0 && prev && current) {
                                    const a = getPlaceLatLng(prev);
                                    const b = getPlaceLatLng(current);
                                    if (a && b) {
                                        const mins = getWalkingMinutes(a.lat, a.lng, b.lat, b.lng);
                                        return i18n("mobile.courseScreen.mapSegmentWalk", {
                                            from: String(safeIndex),
                                            to: String(safeIndex + 1),
                                            minutes: mins,
                                        });
                                    }
                                }
                                return null;
                            })();
                            return (
                                <View style={[s.mapBottomSheet, { backgroundColor: t.card, paddingBottom: Math.max(12, navBottom) }]}>
                                    <View style={s.mapBottomTop}>
                                        {displayImage ? (
                                            <Image source={{ uri: displayImage }} style={s.mapBottomThumb} />
                                        ) : (
                                            <View
                                                style={[
                                                    s.mapBottomThumb,
                                                    { backgroundColor: t.surface, alignItems: "center", justifyContent: "center" },
                                                ]}
                                            >
                                                <Text>📍</Text>
                                            </View>
                                        )}
                                        <View style={{ flex: 1 }}>
                                            <Text style={[s.mapBottomTitle, { color: t.text }]} numberOfLines={1}>
                                                {pickPlaceName(displayPlace as any, locale as any) || i18n("mobile.courseScreen.placeFallback")}
                                            </Text>
                                            {walkBadge ? (
                                                <View style={s.mapWalkBadge}>
                                                    <Text style={[s.mapWalkBadgeText, { color: t.textMuted }]}>
                                                        ⏱️ {walkBadge}
                                                    </Text>
                                                </View>
                                            ) : null}
                                            <Text style={[s.mapBottomAddr, { color: t.textMuted }]} numberOfLines={1}>
                                                {displayPlace.address || ""}
                                            </Text>
                                        </View>
                                        {/* X 버튼: 미리보기면 미리보기 해제, 아니면 전체 경로 리셋 */}
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (previewSegmentPlace) {
                                                    setPreviewSegmentPlace(null);
                                                } else {
                                                    onResetRoute();
                                                }
                                            }}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Ionicons name="close" size={24} color={t.textSubtle} />
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity
                                        style={[s.mapPrimaryBtn, { backgroundColor: NAVER_BTN_GRAY }]}
                                        onPress={() => {
                                            const appRoute = getNaverAppRouteUrl(displayPlace, i18n("courseDetail.destinationFallback"));
                                            const webUrl = getPlaceMapUrl(displayPlace);
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
                                        {previewSegmentPlace ? (
                                            // 비선택 옵션 미리보기: "이 장소로 변경" + "상세보기"
                                            <>
                                                <TouchableOpacity
                                                    style={[s.mapSelectBtn, { flex: 1 }]}
                                                    onPress={() => {
                                                        if (onSegmentOptionSelect) {
                                                            const pid = Number(previewSegmentPlace.cp.place_id ?? previewSegmentPlace.cp.place?.id);
                                                            onSegmentOptionSelect(previewSegmentPlace.segment, pid);
                                                        }
                                                        setPreviewSegmentPlace(null);
                                                    }}
                                                >
                                                    <Text style={s.mapSelectBtnText}>{i18n("courseDetail.selectPlace")}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[s.mapDarkBtn, { flex: 1 }]}
                                                    onPress={() =>
                                                        onOpenDetail(
                                                            previewSegmentPlace.place,
                                                            coursePlaceToTipsRow(previewSegmentPlace.cp),
                                                        )
                                                    }
                                                >
                                                    <Text style={s.mapDarkBtnText}>{i18n("courseDetail.viewDetail")}</Text>
                                                </TouchableOpacity>
                                            </>
                                        ) : (
                                            // 일반 주경로 장소: "상세보기" + "예약"
                                            <>
                                                <TouchableOpacity
                                                    style={[s.mapDarkBtn, { flex: 1 }]}
                                                    onPress={() =>
                                                        onOpenDetail(
                                                            current!,
                                                            safeIndex !== null
                                                                ? coursePlaceToTipsRow(places[safeIndex])
                                                                : { tips: null },
                                                        )
                                                    }
                                                >
                                                    <Text style={s.mapDarkBtnText}>{i18n("courseDetail.viewDetail")}</Text>
                                                </TouchableOpacity>
                                                {getPlaceReservationUrl(current!) ? (
                                                    <TouchableOpacity
                                                        style={[s.mapLightBtn, { flex: 1 }]}
                                                        onPress={() => {
                                                            const url = getPlaceReservationUrl(current!);
                                                            if (url) onReserve(url);
                                                        }}
                                                    >
                                                        <Text style={s.mapLightBtnText}>{i18n("courses.reserve")}</Text>
                                                    </TouchableOpacity>
                                                ) : null}
                                            </>
                                        )}
                                    </View>
                                </View>
                            );
                        })() : null}
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

const s = StyleSheet.create({
    courseMapModalRoot: { flex: 1 },
    courseMapAndroidOverlay: {
        zIndex: 60000,
        elevation: 60000,
    },
    courseMapBackdropWeb: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.6)",
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
    courseMapGrabWeb: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 6, marginBottom: 4 },
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
    mapStepTextWeb: { color: "#fff", fontWeight: "600", fontSize: 13 },
    mapStepArrow: { marginHorizontal: 6, color: "#9ca3af", fontSize: 22, lineHeight: 24 },
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
    mapWalkBadge: {
        marginTop: 4,
        backgroundColor: "rgba(0,0,0,0.06)",
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        alignSelf: "flex-start",
    },
    mapWalkBadgeText: { fontSize: 12, fontWeight: "500" },
    mapBottomAddr: { fontSize: 12, marginTop: 4 },
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
    selMarkerCircle: {
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#fff",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    selMarkerAlt: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: "rgba(110,110,110,0.55)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.4)",
    },
    selMarkerLabel: { color: "#fff", fontWeight: "700" },
    mapSelectBtn: {
        height: 46,
        borderRadius: 10,
        backgroundColor: "#99c08e",
        alignItems: "center",
        justifyContent: "center",
    },
    mapSelectBtnText: { color: "#fff", fontSize: 16, fontWeight: "500" },
});
