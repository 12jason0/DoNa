"use client";

import { useState, useMemo, useEffect } from "react";
import { useLocale } from "@/context/LocaleContext";
import Image from "@/components/ImageFallback";
import dynamic from "next/dynamic";
import { Place as MapPlace } from "@/types/map";
import { isIOS, isAndroid } from "@/lib/platform";
import { TipSection } from "@/components/TipSection";
import { parseTipsFromDb } from "@/types/tip";

const NaverMap = dynamic(() => import("@/components/NaverMap"), { ssr: false });

function getWalkingMinutes(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distM = R * c;
    return Math.max(1, Math.round((distM * 1.4) / 80));
}

interface CoursePlace {
    id: number;
    place_id: number;
    order_index: number;
    segment?: string | null;
    order_in_segment?: number | null;
    coaching_tip_free?: string | null;
    recommended_time?: string | null;
    place: {
        id: number;
        name: string;
        address?: string | null;
        description?: string | null;
        category?: string | null;
        imageUrl?: string | null;
        latitude?: number | null;
        longitude?: number | null;
    };
}

interface ShareData {
    shareId: string;
    templateCourseId: number;
    isSelectionType: boolean;
    selectedPlaceIds: number[];
    title: string;
    description?: string | null;
    sub_title?: string | null;
    imageUrl?: string | null;
    region?: string | null;
    coursePlaces: CoursePlace[];
}

const APP_STORE_URL = "https://apps.apple.com/kr/app/dona/id6756777886";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=kr.io.dona.dona";

const SEGMENT_ORDER = ["brunch", "lunch", "cafe", "dinner", "bar", "date"];
const SEGMENT_LABELS: Record<string, string> = {
    brunch: "브런치",
    lunch: "점심",
    cafe: "카페",
    dinner: "저녁",
    bar: "바",
    date: "데이트",
};
const SEGMENT_ICONS: Record<string, string> = {
    brunch: "🥐",
    lunch: "🍽",
    cafe: "☕",
    dinner: "🍷",
    bar: "🍸",
    date: "💑",
};

export default function CourseSharePreviewClient({
    data,
    shareId,
}: {
    data: ShareData;
    shareId: string;
}) {
    const { t } = useLocale();
    const [showMapModal, setShowMapModal] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState<CoursePlace["place"] | null>(null);
    const [showDownloadAppModal, setShowDownloadAppModal] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShowDownloadAppModal(true), 10000);
        return () => clearTimeout(timer);
    }, []);

    const places = data.coursePlaces ?? [];
    const sortedPlaces = useMemo(
        () => [...places].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
        [places]
    );

    const isSelectionModeUnselected =
        data.isSelectionType && (data.selectedPlaceIds?.length ?? 0) === 0;

    const placesBySegment = useMemo(() => {
        const list = places;
        const map: Record<string, CoursePlace[]> = {};
        for (const cp of list) {
            const seg = cp.segment ?? "";
            if (!seg) continue;
            if (!map[seg]) map[seg] = [];
            map[seg].push(cp);
        }
        for (const seg of Object.keys(map)) {
            map[seg].sort((a, b) => (a.order_in_segment ?? 0) - (b.order_in_segment ?? 0));
        }
        return map;
    }, [places]);

    const selectionOrderedSteps = useMemo(() => {
        const sorted = [...places].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        const steps: (
            | { type: "fixed"; coursePlace: CoursePlace }
            | { type: "segment"; segment: string; options: CoursePlace[] }
        )[] = [];
        const seenSeg = new Set<string>();
        for (const cp of sorted) {
            const seg = cp.segment ?? "";
            if (!seg) {
                steps.push({ type: "fixed", coursePlace: cp });
            } else if (!seenSeg.has(seg)) {
                seenSeg.add(seg);
                steps.push({ type: "segment", segment: seg, options: placesBySegment[seg] ?? [] });
            }
        }
        return steps;
    }, [places, placesBySegment]);

    const selectedBySegment = useMemo(() => {
        const next: Record<string, number> = {};
        selectionOrderedSteps.forEach((step) => {
            if (step.type === "segment" && step.options?.[0]) next[step.segment] = step.options[0].place_id;
        });
        return next;
    }, [selectionOrderedSteps]);

    const mapPlaces: MapPlace[] = useMemo(
        () =>
            sortedPlaces
                .filter((cp) => cp.place?.latitude != null && cp.place?.longitude != null)
                .map((cp, idx) => ({
                    id: cp.place!.id,
                    name: cp.place!.name,
                    latitude: cp.place!.latitude!,
                    longitude: cp.place!.longitude!,
                    address: cp.place!.address ?? undefined,
                    category: cp.place!.category ?? undefined,
                    imageUrl: cp.place!.imageUrl ?? undefined,
                    orderIndex: idx,
                })),
        [sortedPlaces]
    );

    const selectionMapPlaces = useMemo(() => {
        if (!isSelectionModeUnselected || selectionOrderedSteps.length === 0) return [];
        const result: (MapPlace & { markerVariant?: "confirmed" | "candidate-selected" | "candidate"; segmentKey?: string })[] = [];
        let orderIdx = 0;
        for (const step of selectionOrderedSteps) {
            if (step.type === "fixed") {
                const p = step.coursePlace.place;
                if (p?.latitude == null || p?.longitude == null) continue;
                result.push({
                    id: p.id,
                    name: p.name,
                    latitude: p.latitude,
                    longitude: p.longitude,
                    address: p.address ?? undefined,
                    imageUrl: p.imageUrl ?? undefined,
                    orderIndex: orderIdx++,
                    markerVariant: "confirmed",
                });
            } else {
                const selectedId = selectedBySegment[step.segment];
                const stepOrder = orderIdx++;
                for (const cp of step.options) {
                    if (cp.place?.latitude == null || cp.place?.longitude == null) continue;
                    result.push({
                        id: cp.place.id,
                        name: cp.place.name,
                        latitude: cp.place.latitude,
                        longitude: cp.place.longitude,
                        address: cp.place.address ?? undefined,
                        imageUrl: cp.place.imageUrl ?? undefined,
                        orderIndex: stepOrder,
                        markerVariant: Number(cp.place_id) === Number(selectedId) ? "candidate-selected" : "candidate",
                        segmentKey: step.segment,
                    });
                }
            }
        }
        return result;
    }, [isSelectionModeUnselected, selectionOrderedSteps, selectedBySegment]);

    const selectionPathPlaces = useMemo(() => {
        if (!isSelectionModeUnselected || selectionOrderedSteps.length === 0) return [];
        const path: MapPlace[] = [];
        let orderIdx = 0;
        for (const step of selectionOrderedSteps) {
            if (step.type === "fixed") {
                const p = step.coursePlace.place;
                if (p?.latitude != null && p?.longitude != null) {
                    path.push({
                        id: p.id,
                        name: p.name,
                        latitude: p.latitude,
                        longitude: p.longitude,
                        address: p.address ?? undefined,
                        imageUrl: p.imageUrl ?? undefined,
                        orderIndex: orderIdx++,
                    });
                }
            } else {
                const selectedId = selectedBySegment[step.segment];
                const selected = step.options.find((o) => Number(o.place_id) === Number(selectedId));
                if (selected?.place?.latitude != null && selected.place.longitude != null) {
                    path.push({
                        id: selected.place.id,
                        name: selected.place.name,
                        latitude: selected.place.latitude,
                        longitude: selected.place.longitude,
                        address: selected.place.address ?? undefined,
                        imageUrl: selected.place.imageUrl ?? undefined,
                        orderIndex: orderIdx++,
                    });
                }
            }
        }
        return path;
    }, [isSelectionModeUnselected, selectionOrderedSteps, selectedBySegment]);

    const selectionDottedSegments = useMemo(() => {
        if (!isSelectionModeUnselected || selectionOrderedSteps.length === 0) return [];
        const segments: { from: MapPlace; to: MapPlace }[] = [];
        let prevPlace: MapPlace | null = null;
        for (const step of selectionOrderedSteps) {
            if (step.type === "fixed") {
                const p = step.coursePlace.place;
                if (p?.latitude != null && p?.longitude != null) {
                    prevPlace = {
                        id: p.id,
                        name: p.name,
                        latitude: p.latitude,
                        longitude: p.longitude,
                        address: p.address ?? undefined,
                        imageUrl: p.imageUrl ?? undefined,
                    };
                }
            } else {
                const selectedId = selectedBySegment[step.segment];
                const fromPlace = prevPlace;
                for (const cp of step.options) {
                    if (cp.place?.latitude == null || cp.place?.longitude == null) continue;
                    if (Number(cp.place_id) !== Number(selectedId) && fromPlace) {
                        segments.push({
                            from: fromPlace,
                            to: {
                                id: cp.place.id,
                                name: cp.place.name,
                                latitude: cp.place.latitude,
                                longitude: cp.place.longitude,
                                address: cp.place.address ?? undefined,
                                imageUrl: cp.place.imageUrl ?? undefined,
                            },
                        });
                    }
                    if (Number(cp.place_id) === Number(selectedId)) {
                        prevPlace = {
                            id: cp.place.id,
                            name: cp.place.name,
                            latitude: cp.place.latitude,
                            longitude: cp.place.longitude,
                            address: cp.place.address ?? undefined,
                            imageUrl: cp.place.imageUrl ?? undefined,
                        };
                    }
                }
            }
        }
        return segments;
    }, [isSelectionModeUnselected, selectionOrderedSteps, selectedBySegment]);

    const pathPlaces = mapPlaces;
    const heroImageUrl =
        data.imageUrl?.trim() ||
        sortedPlaces[0]?.place?.imageUrl?.trim() ||
        "/images/placeholder-course.jpg";

    const handleOpenInApp = () => {
        if (isIOS() || isAndroid()) {
            const appUrl = `https://dona.io.kr/courses/${data.templateCourseId}`;
            const storeUrl = isIOS() ? APP_STORE_URL : PLAY_STORE_URL;

            let timeoutId: ReturnType<typeof setTimeout>;
            const clearAndGoToStore = () => {
                clearTimeout(timeoutId);
                window.removeEventListener("visibilitychange", onVisibilityChange);
                window.removeEventListener("pagehide", onVisibilityChange);
                window.location.href = storeUrl;
            };
            const onVisibilityChange = () => {
                if (document.visibilityState === "hidden") {
                    clearTimeout(timeoutId);
                    window.removeEventListener("visibilitychange", onVisibilityChange);
                    window.removeEventListener("pagehide", onVisibilityChange);
                }
            };

            window.addEventListener("visibilitychange", onVisibilityChange);
            window.addEventListener("pagehide", onVisibilityChange);
            timeoutId = setTimeout(clearAndGoToStore, 1800);
            window.location.href = appUrl;
        } else {
            window.location.href = isIOS() ? APP_STORE_URL : PLAY_STORE_URL;
        }
    };

    return (
        <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0f1710] text-gray-900 dark:text-white pb-24">
            <header className="relative w-full max-w-[900px] mx-auto h-[280px] overflow-hidden">
                <Image
                    src={heroImageUrl}
                    alt={data.title}
                    fill
                    className="object-cover"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <p className="text-sm text-white/80 mb-1">공유된 코스</p>
                    <h1 className="text-2xl font-bold">{data.title}</h1>
                    {data.sub_title && (
                        <p className="text-sm text-white/90 mt-1">{data.sub_title}</p>
                    )}
                </div>
            </header>

            <main className="max-w-[900px] mx-auto px-4 pt-6 space-y-6">
                {isSelectionModeUnselected && selectionOrderedSteps.length > 0 ? (
                    selectionOrderedSteps.map((step, stepIdx) => {
                        if (step.type === "fixed") {
                            const cp = step.coursePlace;
                            return (
                                <div key={`fixed-${cp.id}`} className="relative">
                                    <div
                                        onClick={() => setSelectedPlace(cp.place)}
                                        className="flex gap-4 p-4 rounded-xl bg-white dark:bg-[#1a241b] shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer"
                                    >
                                        <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                                            {stepIdx + 1}
                                        </div>
                                        <div className="relative w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                                            {cp.place?.imageUrl && (
                                                <Image
                                                    src={cp.place.imageUrl}
                                                    alt=""
                                                    fill
                                                    className="object-cover"
                                                    sizes="96px"
                                                />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">
                                                {cp.place?.category ?? ""}
                                            </span>
                                            <h3 className="font-bold text-lg truncate mt-0.5">
                                                {cp.place?.name ?? ""}
                                            </h3>
                                            <p className="text-xs text-gray-500 truncate">
                                                {cp.place?.address ?? ""}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        const label = SEGMENT_LABELS[step.segment] ?? step.segment;
                        const icon = SEGMENT_ICONS[step.segment] ?? "📍";
                        return (
                            <div key={`seg-${step.segment}`} className="space-y-2">
                                <div className="flex items-center gap-2 py-1">
                                    <span className="text-lg">{icon}</span>
                                    <span className="font-bold text-gray-700 dark:text-gray-200">
                                        {stepIdx + 1}. {label}
                                    </span>
                                    <span className="text-xs text-gray-500">(택 1)</span>
                                </div>
                                {step.options.map((cp) => (
                                    <div
                                        key={cp.id}
                                        onClick={() => setSelectedPlace(cp.place)}
                                        className="flex gap-4 p-4 rounded-xl bg-white dark:bg-[#1a241b] shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer"
                                    >
                                        <div className="shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold text-sm">
                                            ?
                                        </div>
                                        <div className="relative w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                                            {cp.place?.imageUrl && (
                                                <Image
                                                    src={cp.place.imageUrl}
                                                    alt=""
                                                    fill
                                                    className="object-cover"
                                                    sizes="96px"
                                                />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">
                                                {cp.place?.category ?? ""}
                                            </span>
                                            <h3 className="font-bold text-lg truncate mt-0.5">
                                                {cp.place?.name ?? ""}
                                            </h3>
                                            <p className="text-xs text-gray-500 truncate">
                                                {cp.place?.address ?? ""}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })
                ) : (
                    sortedPlaces.map((cp, idx) => {
                        const prev = idx > 0 ? sortedPlaces[idx - 1] : null;
                        const walkingMin =
                            prev?.place?.latitude != null &&
                            prev.place.longitude != null &&
                            cp.place?.latitude != null &&
                            cp.place.longitude != null
                                ? getWalkingMinutes(
                                      prev.place.latitude,
                                      prev.place.longitude,
                                      cp.place.latitude,
                                      cp.place.longitude
                                  )
                                : null;

                        return (
                            <div key={cp.id} className="relative">
                                {walkingMin != null && (
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-600" />
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                            도보 약 {walkingMin}분
                                        </span>
                                        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-600" />
                                    </div>
                                )}
                                <div
                                    onClick={() => setSelectedPlace(cp.place)}
                                    className="flex gap-4 p-4 rounded-xl bg-white dark:bg-[#1a241b] shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer"
                                >
                                    <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                                        {idx + 1}
                                    </div>
                                    <div className="relative w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                                        {cp.place?.imageUrl && (
                                            <Image
                                                src={cp.place.imageUrl}
                                                alt=""
                                                fill
                                                className="object-cover"
                                                sizes="96px"
                                            />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">
                                            {cp.place?.category ?? ""}
                                        </span>
                                        <h3 className="font-bold text-lg truncate mt-0.5">
                                            {cp.place?.name ?? ""}
                                        </h3>
                                        <p className="text-xs text-gray-500 truncate">
                                            {cp.place?.address ?? ""}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </main>

            <div className="fixed bottom-0 left-0 right-0 max-w-[900px] mx-auto p-4 bg-white dark:bg-[#0f1710] border-t border-gray-200 dark:border-gray-800 flex gap-3">
                <button
                    type="button"
                    onClick={() => setShowMapModal(true)}
                    className="flex-1 py-3 px-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium"
                >
                    지도 보기
                </button>
                <button
                    type="button"
                    onClick={handleOpenInApp}
                    className="flex-1 py-3 px-4 rounded-lg bg-emerald-500 text-white font-bold"
                >
                    앱에서 보기
                </button>
            </div>

            {showMapModal && (
                <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#0f1710]">
                    <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
                        <h2 className="font-bold">코스 지도</h2>
                        <button
                            type="button"
                            onClick={() => setShowMapModal(false)}
                            className="p-2 text-gray-500"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 relative" style={{ minHeight: "400px" }}>
                        <NaverMap
                            key={isSelectionModeUnselected ? "select" : "path"}
                            places={
                                isSelectionModeUnselected && selectionMapPlaces.length > 0
                                    ? selectionMapPlaces
                                    : mapPlaces
                            }
                            pathPlaces={
                                isSelectionModeUnselected
                                    ? selectionPathPlaces.length > 0
                                        ? selectionPathPlaces
                                        : undefined
                                    : pathPlaces.length > 0
                                      ? pathPlaces
                                      : undefined
                            }
                            dottedPathSegments={
                                isSelectionModeUnselected ? selectionDottedSegments : undefined
                            }
                            userLocation={null}
                            selectedPlace={
                                selectedPlace &&
                                selectedPlace.latitude != null &&
                                selectedPlace.longitude != null
                                    ? {
                                          id: selectedPlace.id,
                                          name: selectedPlace.name,
                                          latitude: selectedPlace.latitude,
                                          longitude: selectedPlace.longitude,
                                          address: selectedPlace.address ?? undefined,
                                          category: selectedPlace.category ?? undefined,
                                          imageUrl: selectedPlace.imageUrl ?? undefined,
                                          orderIndex: isSelectionModeUnselected
                                              ? selectionMapPlaces.findIndex((x) => x.id === selectedPlace.id)
                                              : sortedPlaces.findIndex((x) => x.place?.id === selectedPlace.id),
                                      }
                                    : null
                            }
                            onPlaceClick={(p) => {
                                const cp = places.find((x) => x.place?.id === p.id);
                                if (cp?.place) setSelectedPlace(cp.place);
                            }}
                            drawPath={
                                isSelectionModeUnselected
                                    ? selectionPathPlaces.length > 1
                                    : pathPlaces.length > 1
                            }
                            pathStraightOnly={false}
                            numberedMarkers
                            showControls={false}
                            className="w-full h-full"
                            style={{ minHeight: "400px" }}
                        />
                    </div>
                </div>
            )}

            {showDownloadAppModal && (
                <div
                    className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
                    onClick={() => setShowDownloadAppModal(false)}
                >
                    <div
                        className="bg-white dark:bg-[#1a241b] rounded-2xl w-full max-w-[380px] p-6 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="font-bold text-xl text-gray-900 dark:text-white text-center">
                            {t("sharePreview.downloadModalTitle")}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
                            {t("sharePreview.downloadModalDesc")}
                        </p>
                        <div className="flex gap-3 mt-6">
                            <a
                                href={isIOS() ? APP_STORE_URL : PLAY_STORE_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 py-3 px-4 rounded-lg bg-emerald-500 text-white font-bold text-center text-sm hover:bg-emerald-600 transition-colors"
                            >
                                {t("sharePreview.downloadApp")}
                            </a>
                            <button
                                type="button"
                                onClick={() => setShowDownloadAppModal(false)}
                                className="flex-1 py-3 px-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium text-sm"
                            >
                                {t("common.close")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedPlace && (
                <div
                    className="fixed inset-0 z-60 bg-black/50 flex items-end justify-center p-4"
                    onClick={() => setSelectedPlace(null)}
                >
                    <div
                        className="bg-white dark:bg-[#1a241b] rounded-t-2xl w-full max-w-[500px] max-h-[70vh] overflow-y-auto p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-end mb-2">
                            <button
                                type="button"
                                onClick={() => setSelectedPlace(null)}
                                className="text-gray-500"
                            >
                                ✕
                            </button>
                        </div>
                        {selectedPlace.imageUrl ? (
                            <div className="relative w-full h-48 rounded-lg overflow-hidden mb-4">
                                <Image
                                    src={selectedPlace.imageUrl}
                                    alt=""
                                    fill
                                    className="object-cover"
                                    sizes="500px"
                                />
                            </div>
                        ) : (
                            <div className="w-full h-32 rounded-lg bg-gray-100 dark:bg-gray-800 mb-4 flex items-center justify-center">
                                <span className="text-gray-400 text-sm">No Image</span>
                            </div>
                        )}
                        <h3 className="font-bold text-xl">{selectedPlace.name}</h3>
                        {selectedPlace.category && (
                            <p className="text-sm text-gray-500 mt-1">{selectedPlace.category}</p>
                        )}
                        {selectedPlace.address && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                {selectedPlace.address}
                            </p>
                        )}
                        {(() => {
                            const cp = data.coursePlaces.find((c) => c.place?.id === selectedPlace.id);
                            const freeTips = parseTipsFromDb(cp?.coaching_tip_free);
                            if (freeTips.length === 0) return null;
                            return (
                                <div className="mt-4">
                                    <TipSection tips={freeTips} variant="free" compact={false} />
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}
