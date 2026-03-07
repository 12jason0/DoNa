"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import Image from "@/components/ImageFallback";
import dynamic from "next/dynamic";
import { Place as MapPlace } from "@/types/map";
import { isIOS } from "@/lib/platform";

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

export default function CourseSharePreviewClient({
    data,
    shareId,
}: {
    data: ShareData;
    shareId: string;
}) {
    const router = useRouter();
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

    const pathPlaces = mapPlaces;

    return (
        <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0f1710] text-gray-900 dark:text-white pb-24">
            <header className="relative w-full max-w-[900px] mx-auto h-[280px] overflow-hidden">
                <Image
                    src={data.imageUrl || "/images/placeholder-course.jpg"}
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
                {sortedPlaces.map((cp, idx) => {
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
                })}
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
                    onClick={() => router.push(`/courses/${data.templateCourseId}`)}
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
                            places={mapPlaces}
                            pathPlaces={pathPlaces.length > 0 ? pathPlaces : undefined}
                            userLocation={null}
                            selectedPlace={null}
                            onPlaceClick={(p) => {
                                const cp = sortedPlaces.find((x) => x.place?.id === p.id);
                                if (cp?.place) setSelectedPlace(cp.place);
                            }}
                            drawPath={pathPlaces.length > 1}
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
                        {selectedPlace.imageUrl && (
                            <div className="relative w-full h-48 rounded-lg overflow-hidden mb-4">
                                <Image
                                    src={selectedPlace.imageUrl}
                                    alt=""
                                    fill
                                    className="object-cover"
                                    sizes="500px"
                                />
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
                        {data.coursePlaces.find((cp) => cp.place?.id === selectedPlace.id)
                            ?.coaching_tip_free && (
                            <div className="mt-4 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    {
                                        data.coursePlaces.find(
                                            (cp) => cp.place?.id === selectedPlace.id
                                        )?.coaching_tip_free
                                    }
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
