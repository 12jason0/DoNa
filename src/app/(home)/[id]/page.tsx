import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import PlaceStatusBadge from "@/components/PlaceStatusBadge";
import Image from "@/components/ImageFallback";
import NaverMap from "@/components/NaverMap";

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export const dynamic = "force-dynamic";

/**
 * 장소 상세 페이지
 */
export default async function PlaceDetailPage({ params }: PageProps) {
    const { id } = await params;
    const placeId = parseInt(id);

    if (isNaN(placeId)) {
        notFound();
    }

    // 장소 정보 조회 (휴무일 정보 포함)
    const place = await prisma.place.findUnique({
        where: { id: placeId },
        include: {
            closed_days: {
                orderBy: [{ day_of_week: "asc" }, { specific_date: "asc" }],
            },
        },
    });

    if (!place) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Section */}
            <section className="relative h-[300px] overflow-hidden">
                <div className="absolute inset-0">
                    {place.imageUrl ? (
                        <Image
                            src={place.imageUrl}
                            alt={place.name}
                            fill
                            priority
                            sizes="(max-width: 600px) 100vw, 600px"
                            className="object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                            <span className="text-6xl">📍</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
                </div>

                <div className="relative h-full max-w-[500px] mx-auto px-4 flex items-end pb-8">
                    <div className="w-full">
                        <div className="mb-4">
                            {place.category && (
                                <span className="inline-block px-4 py-1.5 bg-emerald-600 text-white text-sm font-bold rounded-full mb-2">
                                    {place.category}
                                </span>
                            )}
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-4">{place.name}</h1>
                        {place.address && (
                            <p className="text-white/90 text-base mb-4 flex items-center gap-2">
                                <span>📍</span>
                                <span>{place.address}</span>
                            </p>
                        )}
                        {/* 영업 상태 배지 */}
                        <PlaceStatusBadge place={place} closedDays={place.closed_days} size="md" />
                    </div>
                </div>
            </section>

            {/* 상세 정보 섹션 */}
            <section className="py-10">
                <div className="max-w-[500px] mx-auto px-4 space-y-6">
                    {/* 기본 정보 카드 */}
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <h2 className="text-2xl font-bold mb-6">기본 정보</h2>
                        <div className="space-y-4">
                            {/* 영업시간 */}
                            {place.opening_hours && (
                                <div className="flex items-start gap-3">
                                    <span className="text-blue-500 text-xl mt-1">🕒</span>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-800 mb-1">영업시간</p>
                                        <p className="text-sm text-gray-600">{place.opening_hours}</p>
                                        <div className="mt-2">
                                            <PlaceStatusBadge place={place} closedDays={place.closed_days} size="sm" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 평균 비용 */}
                            {place.avg_cost_range && (
                                <div className="flex items-start gap-3">
                                    <span className="text-green-500 text-xl mt-1">💰</span>
                                    <div>
                                        <p className="font-medium text-gray-800 mb-1">평균 비용</p>
                                        <p className="text-sm text-gray-600">{place.avg_cost_range}</p>
                                    </div>
                                </div>
                            )}

                            {/* 전화번호 */}
                            {place.phone && (
                                <div className="flex items-start gap-3">
                                    <span className="text-purple-500 text-xl mt-1">📞</span>
                                    <div>
                                        <p className="font-medium text-gray-800 mb-1">전화번호</p>
                                        <a
                                            href={`tel:${place.phone}`}
                                            className="text-sm text-blue-600 hover:underline"
                                        >
                                            {place.phone}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* 웹사이트 */}
                            {place.website && (
                                <div className="flex items-start gap-3">
                                    <span className="text-orange-500 text-xl mt-1">🌐</span>
                                    <div>
                                        <p className="font-medium text-gray-800 mb-1">웹사이트</p>
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

                            {/* 주차 가능 */}
                            {place.parking_available !== null && (
                                <div className="flex items-start gap-3">
                                    <span className="text-indigo-500 text-xl mt-1">🅿️</span>
                                    <div>
                                        <p className="font-medium text-gray-800 mb-1">주차</p>
                                        <p className="text-sm text-gray-600">
                                            {place.parking_available ? "주차 가능" : "주차 불가"}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* 예약 필요 */}
                            {place.reservation_required !== null && (
                                <div className="flex items-start gap-3">
                                    <span className="text-red-500 text-xl mt-1">📋</span>
                                    <div>
                                        <p className="font-medium text-gray-800 mb-1">예약</p>
                                        <p className="text-sm text-gray-600">
                                            {place.reservation_required ? "예약 필요" : "예약 불필요"}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 설명 카드 */}
                    {place.description && (
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold mb-4">상세 설명</h2>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{place.description}</p>
                        </div>
                    )}

                    {/* 지도 카드 */}
                    {place.latitude && place.longitude && (
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold mb-4">위치</h2>
                            <div className="rounded-lg overflow-hidden">
                                <NaverMap
                                    places={[
                                        {
                                            id: place.id,
                                            name: place.name,
                                            latitude: place.latitude,
                                            longitude: place.longitude,
                                            address: place.address || "",
                                            imageUrl: place.imageUrl || undefined,
                                            description: place.description || undefined,
                                        },
                                    ]}
                                    userLocation={null}
                                    selectedPlace={{
                                        id: place.id,
                                        name: place.name,
                                        latitude: place.latitude,
                                        longitude: place.longitude,
                                        address: place.address || "",
                                        imageUrl: place.imageUrl || undefined,
                                        description: place.description || undefined,
                                    }}
                                    onPlaceClick={() => {}}
                                    drawPath={false}
                                    numberedMarkers={false}
                                    className="w-full h-64 rounded-lg"
                                    showControls={true}
                                    showPlaceOverlay={false}
                                />
                            </div>
                            {place.address && (
                                <div className="mt-4">
                                    <a
                                        href={`https://map.naver.com/v5/search/${encodeURIComponent(place.name)}?c=${
                                            place.longitude
                                        },${place.latitude},15,0,0,0,dh`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        <span>🗺️</span>
                                        <span>네이버 지도에서 보기</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 휴무일 정보 */}
                    {place.closed_days && place.closed_days.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold mb-4">휴무일</h2>
                            <div className="space-y-2">
                                {place.closed_days.map((closedDay, idx) => {
                                    const dayNames = [
                                        "일요일",
                                        "월요일",
                                        "화요일",
                                        "수요일",
                                        "목요일",
                                        "금요일",
                                        "토요일",
                                    ];
                                    let displayText = "";

                                    if (closedDay.specific_date) {
                                        const date = new Date(closedDay.specific_date);
                                        displayText = `${date.getFullYear()}년 ${
                                            date.getMonth() + 1
                                        }월 ${date.getDate()}일`;
                                        if (closedDay.note) {
                                            displayText += ` (${closedDay.note})`;
                                        }
                                    } else if (closedDay.day_of_week !== null) {
                                        displayText = `매주 ${dayNames[closedDay.day_of_week]}`;
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

                    {/* 태그 */}
                    {place.tags && (
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold mb-4">태그</h2>
                            <div className="flex flex-wrap gap-2">
                                {(() => {
                                    const raw = (place as any).tags;
                                    let list: string[] = [];
                                    if (Array.isArray(raw)) {
                                        list = raw as string[];
                                    } else if (typeof raw === "string") {
                                        list = raw.split(",");
                                    } else if (raw && typeof raw === "object") {
                                        for (const key of Object.keys(raw)) {
                                            const v = (raw as any)[key];
                                            if (Array.isArray(v)) list.push(...v.map(String));
                                            else if (typeof v === "string") list.push(v);
                                        }
                                    }
                                    // 고유/정리
                                    list = Array.from(new Set(list.map((t) => t.trim()).filter(Boolean)));
                                    return list.map((tag, idx) => (
                                        <span
                                            key={idx}
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
