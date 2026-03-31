"use client";

import type { Locale } from "@/context/LocaleContext";
import { useLocale } from "@/context/LocaleContext";
import type { TranslationKeys } from "@/types/i18n";
import { pickPlaceAddress, pickPlaceDescription, pickPlaceName, translatePlaceCategory } from "@/lib/placeLocalized";
import PlaceStatusBadge from "@/components/PlaceStatusBadge";
import Image from "@/components/ImageFallback";
import NaverMap from "@/components/NaverMap";

export type PlaceDetailClosedDay = {
    day_of_week: number | null;
    specific_date: string | null;
    note?: string | null;
};

export type PlaceDetailSerialized = {
    id: number;
    name: string;
    name_en?: string | null;
    name_ja?: string | null;
    name_zh?: string | null;
    category: string | null;
    address: string | null;
    address_en?: string | null;
    address_ja?: string | null;
    address_zh?: string | null;
    imageUrl: string | null;
    opening_hours: string | null;
    avg_cost_range: string | null;
    phone: string | null;
    website: string | null;
    parking_available: boolean | null;
    reservation_required: boolean | null;
    description: string | null;
    description_en?: string | null;
    description_ja?: string | null;
    description_zh?: string | null;
    latitude: number | null;
    longitude: number | null;
    closed_days: PlaceDetailClosedDay[];
    tags: unknown;
};

function intlLocale(locale: Locale): string {
    return locale === "zh" ? "zh-CN" : locale;
}

function formatSpecificClosedDate(date: Date, locale: Locale): string {
    if (locale === "ko") {
        return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
    }
    return new Intl.DateTimeFormat(intlLocale(locale), {
        year: "numeric",
        month: "long",
        day: "numeric",
    }).format(date);
}

export default function PlaceDetailView({ place }: { place: PlaceDetailSerialized }) {
    const { t, locale } = useLocale();
    const displayName = pickPlaceName(place, locale);
    const displayDescription = pickPlaceDescription(place, locale);
    const displayAddress = pickPlaceAddress(place, locale);

    const weekdayKey = (idx: number): TranslationKeys =>
        `placeDetail.weekday${idx}` as TranslationKeys;

    return (
        <div className="min-h-screen bg-gray-50">
            <section className="relative h-[300px] overflow-hidden">
                <div className="absolute inset-0">
                    {place.imageUrl ? (
                        <Image
                            src={place.imageUrl}
                            alt={displayName}
                            fill
                            priority
                            sizes="(max-width: 600px) 100vw, 600px"
                            className="object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-linear-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                            <span className="text-6xl">📍</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-r from-black/70 via-black/50 to-transparent" />
                </div>

                <div className="relative h-full max-w-[500px] mx-auto px-4 flex items-end pb-8">
                    <div className="w-full">
                        <div className="mb-4">
                            {place.category && (
                                <span className="inline-block px-4 py-1.5 bg-emerald-600 text-white text-sm font-bold rounded-full mb-2">
                                    {translatePlaceCategory(place.category, t)}
                                </span>
                            )}
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-4">{displayName}</h1>
                        {displayAddress && (
                            <p className="text-white/90 text-base mb-4 flex items-center gap-2">
                                <span>📍</span>
                                <span>{displayAddress}</span>
                            </p>
                        )}
                        <PlaceStatusBadge place={place} closedDays={place.closed_days} size="md" />
                    </div>
                </div>
            </section>

            <section className="py-10">
                <div className="max-w-[500px] mx-auto px-4 space-y-6">
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <h2 className="text-2xl font-bold mb-6">{t("placeDetail.basicInfo")}</h2>
                        <div className="space-y-4">
                            {place.opening_hours && (
                                <div className="flex items-start gap-3">
                                    <span className="text-blue-500 text-xl mt-1">🕒</span>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-800 mb-1">{t("placeDetail.openingHours")}</p>
                                        <p className="text-sm text-gray-600">{place.opening_hours}</p>
                                        <div className="mt-2">
                                            <PlaceStatusBadge place={place} closedDays={place.closed_days} size="sm" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {place.avg_cost_range && (
                                <div className="flex items-start gap-3">
                                    <span className="text-green-500 text-xl mt-1">💰</span>
                                    <div>
                                        <p className="font-medium text-gray-800 mb-1">{t("placeDetail.avgCost")}</p>
                                        <p className="text-sm text-gray-600">{place.avg_cost_range}</p>
                                    </div>
                                </div>
                            )}

                            {place.phone && (
                                <div className="flex items-start gap-3">
                                    <span className="text-purple-500 text-xl mt-1">📞</span>
                                    <div>
                                        <p className="font-medium text-gray-800 mb-1">{t("placeDetail.phone")}</p>
                                        <a href={`tel:${place.phone}`} className="text-sm text-blue-600 hover:underline">
                                            {place.phone}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {place.website && (
                                <div className="flex items-start gap-3">
                                    <span className="text-orange-500 text-xl mt-1">🌐</span>
                                    <div>
                                        <p className="font-medium text-gray-800 mb-1">{t("placeDetail.website")}</p>
                                        <a
                                            href={place.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-600 hover:underline break-all"
                                        >
                                            {place.website}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {place.parking_available !== null && (
                                <div className="flex items-start gap-3">
                                    <span className="text-indigo-500 text-xl mt-1">🅿️</span>
                                    <div>
                                        <p className="font-medium text-gray-800 mb-1">{t("placeDetail.parking")}</p>
                                        <p className="text-sm text-gray-600">
                                            {place.parking_available
                                                ? t("placeDetail.parkingYes")
                                                : t("placeDetail.parkingNo")}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {place.reservation_required !== null && (
                                <div className="flex items-start gap-3">
                                    <span className="text-red-500 text-xl mt-1">📋</span>
                                    <div>
                                        <p className="font-medium text-gray-800 mb-1">{t("placeDetail.reservation")}</p>
                                        <p className="text-sm text-gray-600">
                                            {place.reservation_required
                                                ? t("placeDetail.reservationRequired")
                                                : t("placeDetail.reservationNotRequired")}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {displayDescription && (
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold mb-4">{t("placeDetail.description")}</h2>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{displayDescription}</p>
                        </div>
                    )}

                    {place.latitude && place.longitude && (
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold mb-4">{t("placeDetail.location")}</h2>
                            <div className="rounded-lg overflow-hidden">
                                <NaverMap
                                    places={[
                                        {
                                            id: place.id,
                                            name: displayName,
                                            latitude: place.latitude,
                                            longitude: place.longitude,
                                            address: displayAddress,
                                            imageUrl: place.imageUrl || undefined,
                                            description: displayDescription || undefined,
                                        },
                                    ]}
                                    userLocation={null}
                                    selectedPlace={{
                                        id: place.id,
                                        name: displayName,
                                        latitude: place.latitude,
                                        longitude: place.longitude,
                                        address: displayAddress,
                                        imageUrl: place.imageUrl || undefined,
                                        description: displayDescription || undefined,
                                    }}
                                    onPlaceClick={() => {}}
                                    drawPath={false}
                                    numberedMarkers={false}
                                    className="w-full h-64 rounded-lg"
                                    showControls={true}
                                    showPlaceOverlay={false}
                                />
                            </div>
                            {displayAddress && (
                                <div className="mt-4">
                                    <a
                                        href={`https://map.naver.com/v5/search/${encodeURIComponent(displayName)}?c=${
                                            place.longitude
                                        },${place.latitude},15,0,0,0,dh`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        <span>🗺️</span>
                                        <span>{t("placeDetail.openInNaverMap")}</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {place.closed_days && place.closed_days.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold mb-4">{t("placeDetail.closedDays")}</h2>
                            <div className="space-y-2">
                                {place.closed_days.map((closedDay, idx) => {
                                    let displayText = "";

                                    if (closedDay.specific_date) {
                                        const date = new Date(closedDay.specific_date);
                                        displayText = formatSpecificClosedDate(date, locale);
                                        if (closedDay.note) {
                                            displayText += ` (${closedDay.note})`;
                                        }
                                    } else if (closedDay.day_of_week !== null && closedDay.day_of_week >= 0 && closedDay.day_of_week <= 6) {
                                        displayText = t("placeDetail.closedEveryWeek", {
                                            day: t(weekdayKey(closedDay.day_of_week)),
                                        });
                                        if (closedDay.note) {
                                            displayText += ` (${closedDay.note})`;
                                        }
                                    }

                                    return (
                                        <div key={idx} className="flex items-center gap-2 text-gray-700">
                                            <span className="text-red-500">🚫</span>
                                            <span>{displayText}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {Boolean(place.tags) && (
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold mb-4">{t("placeDetail.tags")}</h2>
                            <div className="flex flex-wrap gap-2">
                                {(() => {
                                    const raw = place.tags as unknown;
                                    let list: string[] = [];
                                    if (Array.isArray(raw)) {
                                        list = raw as string[];
                                    } else if (typeof raw === "string") {
                                        list = raw.split(",");
                                    } else if (raw && typeof raw === "object") {
                                        for (const key of Object.keys(raw)) {
                                            const v = (raw as Record<string, unknown>)[key];
                                            if (Array.isArray(v)) list.push(...v.map(String));
                                            else if (typeof v === "string") list.push(v);
                                        }
                                    }
                                    list = Array.from(new Set(list.map((tag) => tag.trim()).filter(Boolean)));
                                    return list.map((tag, i) => (
                                        <span
                                            key={i}
                                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                                        >
                                            #{tag}
                                        </span>
                                    ));
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
