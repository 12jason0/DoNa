"use client";

import { useState, useMemo, useEffect } from "react";
import { useLocale } from "@/context/LocaleContext";
import Image from "@/components/ImageFallback";
import dynamic from "next/dynamic";
import { Place as MapPlace } from "@/types/map";
import { isIOS, isAndroid } from "@/lib/platform";
import { useAppLayout } from "@/context/AppLayoutContext";
import { TipSection } from "@/components/TipSection";
import { parseTipsFromDb } from "@/types/tip";
import PlaceStatusBadge from "@/components/PlaceStatusBadge";
import { getPlaceStatus } from "@/lib/placeStatus";

const NaverMap = dynamic(() => import("@/components/NaverMap"), { ssr: false });

const Icons = {
    Lock: ({ className }: { className?: string }) => (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    ),
    ExternalLink: ({ className }: { className?: string }) => (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" x2="21" y1="14" y2="3" />
        </svg>
    ),
};

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

interface PlaceClosedDay {
    day_of_week?: number | null;
    specific_date?: string | null;
    note?: string | null;
}

function normalizeClosedDays(
    closed_days: PlaceClosedDay[] | undefined | null
): { day_of_week: number | null; specific_date: Date | string | null; note?: string | null }[] {
    return (closed_days ?? []).map((d) => ({
        day_of_week: d.day_of_week ?? null,
        specific_date: d.specific_date ?? null,
        note: d.note ?? null,
    }));
}

interface CoursePlace {
    id: number;
    place_id: number;
    order_index: number;
    segment?: string | null;
    order_in_segment?: number | null;
    tips?: string | null;
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
        opening_hours?: string | null;
        reservationUrl?: string | null;
        closed_days?: PlaceClosedDay[];
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
    const { iosIgnoreSafeAreaBottom } = useAppLayout();
    const [showMapModal, setShowMapModal] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState<CoursePlace["place"] | null>(null);
    const [showDownloadAppModal, setShowDownloadAppModal] = useState(false);
    const [placeModalSlideUp, setPlaceModalSlideUp] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShowDownloadAppModal(true), 10000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (selectedPlace) {
            setPlaceModalSlideUp(false);
            requestAnimationFrame(() => requestAnimationFrame(() => setPlaceModalSlideUp(true)));
        }
    }, [selectedPlace]);

    const places = data.coursePlaces ?? [];
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

    const [selectedBySegment, setSelectedBySegment] = useState<Record<string, number>>({});
    const defaultSelectedBySegment = useMemo(() => {
        const next: Record<string, number> = {};
        selectionOrderedSteps.forEach((step) => {
            if (step.type === "segment" && step.options?.[0]) next[step.segment] = step.options[0].place_id;
        });
        return next;
    }, [selectionOrderedSteps]);
    const effectiveSelectedBySegment =
        Object.keys(selectedBySegment).length > 0 ? selectedBySegment : defaultSelectedBySegment;

    const displayPlaces = useMemo(() => {
        if (!isSelectionModeUnselected) {
            return [...places].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        }
        const result: CoursePlace[] = [];
        for (const step of selectionOrderedSteps) {
            if (step.type === "fixed") {
                result.push(step.coursePlace);
            } else {
                const pid = effectiveSelectedBySegment[step.segment];
                const cp = step.options.find((o) => Number(o.place_id) === Number(pid));
                if (cp) result.push(cp);
            }
        }
        return result;
    }, [isSelectionModeUnselected, places, selectionOrderedSteps, effectiveSelectedBySegment]);

    const sortedPlaces = displayPlaces;

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
                const selectedId = effectiveSelectedBySegment[step.segment];
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
    }, [isSelectionModeUnselected, selectionOrderedSteps, effectiveSelectedBySegment]);

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
                const selectedId = effectiveSelectedBySegment[step.segment];
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
    }, [isSelectionModeUnselected, selectionOrderedSteps, effectiveSelectedBySegment]);

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
                const selectedId = effectiveSelectedBySegment[step.segment];
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
    }, [isSelectionModeUnselected, selectionOrderedSteps, effectiveSelectedBySegment]);

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
                <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
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
                                        <div className="shrink-0 w-10 h-10 rounded-full bg-[#85ad78] flex items-center justify-center text-white font-bold text-sm">
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
                                {step.options.map((cp) => {
                                    const isSelected = Number(effectiveSelectedBySegment[step.segment]) === Number(cp.place_id);
                                    return (
                                    <div
                                        key={cp.id}
                                        onClick={() => {
                                            setSelectedBySegment((prev) => ({ ...prev, [step.segment]: cp.place_id }));
                                            setSelectedPlace(cp.place);
                                        }}
                                        className={`flex gap-4 p-4 rounded-xl bg-white dark:bg-[#1a241b] shadow-sm border cursor-pointer transition-colors ${
                                            isSelected
                                                ? "border-[#85ad78] dark:border-[#85ad78] ring-2 ring-[#85ad78]/30"
                                                : "border-gray-100 dark:border-gray-800"
                                        }`}
                                    >
                                        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                            isSelected ? "bg-[#85ad78] text-white" : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                                        }`}>
                                            {isSelected ? "✓" : "?"}
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
                                    );
                                })}
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
                                    <div className="shrink-0 w-10 h-10 rounded-full bg-[#85ad78] flex items-center justify-center text-white font-bold text-sm">
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
                    className="flex-1 py-3 px-4 rounded-lg bg-[#85ad78] text-white font-bold"
                >
                    앱에서 보기
                </button>
            </div>

            {showMapModal && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end">
                    <div
                        className="absolute inset-0 bg-black/40"
                        aria-hidden
                        onClick={() => setShowMapModal(false)}
                    />
                    <div className="relative z-10 flex flex-col bg-white dark:bg-[#0f1710] rounded-t-2xl max-h-[60vh] shadow-2xl">
                        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
                            <h2 className="font-bold">코스 지도</h2>
                            <button
                                type="button"
                                onClick={() => setShowMapModal(false)}
                                className="p-2 text-gray-500"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 relative" style={{ minHeight: "280px", maxHeight: "calc(60vh - 56px)" }}>
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
                                if (cp?.place) {
                                    if (isSelectionModeUnselected && cp.segment) {
                                        setSelectedBySegment((prev) => ({ ...prev, [cp.segment!]: cp.place_id }));
                                    }
                                    setSelectedPlace(cp.place);
                                }
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
                            style={{ minHeight: "280px" }}
                        />
                        </div>
                    </div>
                </div>
            )}

            {showDownloadAppModal && (
                <div
                    className="fixed inset-0 z-70 bg-black/50 flex items-center justify-center p-4"
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
                                className="flex-1 py-3 px-4 rounded-lg bg-[#85ad78] text-white font-bold text-center text-sm"
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
                    className="fixed inset-0 z-9999 flex flex-col justify-end bg-black/60 animate-fade-in"
                    onClick={() => {
                        setPlaceModalSlideUp(false);
                        setTimeout(() => setSelectedPlace(null), 300);
                    }}
                >
                    <div
                        className="fixed left-0 right-0 top-14 bottom-0 flex flex-col pointer-events-none"
                    >
                        <div
                            className={`pointer-events-auto bg-white dark:bg-[#1a241b] rounded-t-2xl w-full h-full overflow-hidden flex flex-col shadow-2xl ${iosIgnoreSafeAreaBottom ? "pb-0" : "pb-[env(safe-area-inset-bottom)]"}`}
                            style={{
                                transform: placeModalSlideUp ? "translateY(0)" : "translateY(100%)",
                                transition: "transform 0.3s ease-out",
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="relative h-72 shrink-0 bg-gray-100 dark:bg-gray-800">
                                {selectedPlace.imageUrl && (
                                    <Image
                                        src={selectedPlace.imageUrl}
                                        alt={selectedPlace.name}
                                        fill
                                        className="object-cover pointer-events-none"
                                        sizes="100vw"
                                    />
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent pt-12 pb-4 px-4 z-1">
                                    <h3 className="text-lg font-bold text-white drop-shadow-md">
                                        {selectedPlace.name}
                                    </h3>
                                </div>
                                <div
                                    role="button"
                                    tabIndex={0}
                                    className="absolute inset-0 flex flex-col items-center pt-3 touch-none cursor-grab active:cursor-grabbing z-10"
                                    onPointerDown={() => {
                                        setPlaceModalSlideUp(false);
                                        setTimeout(() => setSelectedPlace(null), 300);
                                    }}
                                >
                                    <span className="w-12 h-1.5 rounded-full bg-white/90 shadow-md shrink-0" />
                                </div>
                            </div>
                            <div className="p-5 text-black dark:text-white flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                                <h3 className="text-xl font-bold mb-2 dark:text-white">{selectedPlace.name}</h3>
                                <div className="mb-3">
                                    <PlaceStatusBadge
                                        place={{
                                            opening_hours: selectedPlace.opening_hours ?? null,
                                            closed_days: normalizeClosedDays(selectedPlace.closed_days),
                                        }}
                                        closedDays={normalizeClosedDays(selectedPlace.closed_days)}
                                        showHours={false}
                                        size="sm"
                                    />
                                </div>
                                <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 font-medium truncate">
                                    {selectedPlace.address}
                                </p>
                                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap mb-6">
                                    {selectedPlace.description || "상세 설명이 없습니다."}
                                </p>
                                {(() => {
                                    const cp = data.coursePlaces.find((c) => c.place?.id === selectedPlace.id);
                                    const tips = parseTipsFromDb(cp?.tips);
                                    if (tips.length === 0) return null;
                                    return (
                                        <div className="mb-4 flex flex-col gap-2">
                                            <TipSection tips={tips} variant="free" compact={false} />
                                        </div>
                                    );
                                })()}
                                <div className="flex flex-col gap-2">
                                    {selectedPlace.reservationUrl && (
                                        <a
                                            href={selectedPlace.reservationUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full py-3 rounded-lg bg-[#85ad78] text-white font-bold shadow-lg flex items-center justify-center gap-2 text-sm"
                                        >
                                            <Icons.ExternalLink className="w-4 h-4" />
                                            {getPlaceStatus(
                                                selectedPlace.opening_hours ?? null,
                                                normalizeClosedDays(selectedPlace.closed_days),
                                            ).status === "휴무"
                                                ? t("courses.reserveOtherDay")
                                                : t("courses.reserve")}
                                        </a>
                                    )}
                                    <button
                                        type="button"
                                        className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                        onClick={() => {
                                            setPlaceModalSlideUp(false);
                                            setTimeout(() => setSelectedPlace(null), 300);
                                        }}
                                    >
                                        그냥 닫기
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
