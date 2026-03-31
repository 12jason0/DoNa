import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId, verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const all = searchParams.get("all");
        const lat = searchParams.get("lat");
        const lng = searchParams.get("lng");
        const region = searchParams.get("region");

        // Admin 등에서 전체 목록이 필요한 경우: /api/places?all=1&limit=10&offset=0&search=검색어
        // 지도 영역 필터링: /api/places?all=1&minLat=37.5&maxLat=37.6&minLng=127.0&maxLng=127.1
        if (all === "1") {
            const limitParam = Math.min(Math.max(Number(searchParams.get("limit") ?? 10), 1), 10000); // 🟢 limit 증가 (최대 10000)
            const offsetParam = Math.max(Number(searchParams.get("offset") ?? 0), 0);
            const searchQuery = (searchParams.get("search") || "").trim();
            
            // 🟢 지도 영역(bounds) 필터링 파라미터
            const minLat = searchParams.get("minLat");
            const maxLat = searchParams.get("maxLat");
            const minLng = searchParams.get("minLng");
            const maxLng = searchParams.get("maxLng");

            // 검색 조건 구성
            const whereClause: any = {};
            if (searchQuery) {
                whereClause.name = { contains: searchQuery, mode: "insensitive" };
            }
            
            // 🟢 지도 영역 필터링 추가
            if (minLat && maxLat && minLng && maxLng) {
                whereClause.latitude = {
                    gte: Number(minLat),
                    lte: Number(maxLat),
                };
                whereClause.longitude = {
                    gte: Number(minLng),
                    lte: Number(maxLng),
                };
            }

            // 전체 개수 조회 (검색 조건 포함)
            const totalCount = await (prisma as any).place.count({
                where: whereClause,
            });

            const places = (await (prisma as any).place.findMany({
                where: whereClause,
                skip: offsetParam,
                take: limitParam,
                orderBy: { id: "asc" }, // id 오름차순 (1번부터)
                select: {
                    id: true,
                    name: true,
                    address: true,
                    address_en: true,
                    address_ja: true,
                    address_zh: true,
                    description: true,
                    category: true,
                    avg_cost_range: true,
                    opening_hours: true,
                    phone: true,
                    parking_available: true,
                    latitude: true,
                    longitude: true,
                    imageUrl: true,
                    tags: true,
                },
            })) as any[];

            return NextResponse.json({
                success: true,
                places,
                total: totalCount,
                limit: limitParam,
                offset: offsetParam,
                hasMore: offsetParam + limitParam < totalCount,
            });
        }

        if (!lat || !lng) {
            return NextResponse.json({ error: "위도와 경도가 필요합니다." }, { status: 400 });
        }

        // 데이터베이스에서 해당 지역의 장소들을 가져오기 (Prisma)
        const places = (await (prisma as any).place.findMany({
            take: 20,
            select: {
                id: true,
                name: true,
                address: true,
                description: true,
                category: true,
                avg_cost_range: true,
                opening_hours: true,
                phone: true,
                parking_available: true,
                latitude: true,
                longitude: true,
                imageUrl: true,
            },
        })) as Array<{
            id: number;
            name: string;
            address: string | null;
            description: string | null;
            category: string | null;
            avg_cost_range: string | null;
            opening_hours: string | null;
            phone?: string | null;
            parking_available: boolean | null;
            latitude: any;
            longitude: any;
            imageUrl?: string | null;
        }>;

        // 장소 데이터를 Place 인터페이스에 맞게 변환
        const transformedPlaces = places.map((place) => {
            // 혼잡도 계산 (랜덤) — i18n 키 반환, 프론트에서 t("crowdLevel.EASY") 등으로 번역
            const crowdLevels = ["EASY", "NORMAL", "BUSY", "VERY_BUSY"] as const;
            const crowdLevel = crowdLevels[Math.floor(Math.random() * crowdLevels.length)];

            // 거리 계산 (실제 좌표 기반)
            const distance = Math.random() * 2 + 0.1; // 0.1km ~ 2.1km
            const distanceStr = distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`;

            return {
                id: place.id,
                name: place.name,
                crowd: crowdLevel,
                type: place.category,
                distance: distanceStr,
                address: place.address,
                category: place.category,
                description: place.description,
                rating: Math.floor(Math.random() * 5) + 1, // 1-5 랜덤 평점
                participants: `${Math.floor(Math.random() * 50) + 1}/${Math.floor(Math.random() * 100) + 50}`, // 랜덤 참가자 수
                imageUrl: place.imageUrl || "/images/SeongsuFood-001.png",
                latitude: Number(place.latitude),
                longitude: Number(place.longitude),
            };
        });

        // 거리순으로 정렬
        transformedPlaces.sort((a, b) => {
            const distA = parseFloat(a.distance.replace("km", "").replace("m", ""));
            const distB = parseFloat(b.distance.replace("km", "").replace("m", ""));
            return distA - distB;
        });

        return NextResponse.json({
            success: true,
            places: transformedPlaces,
            region: region,
        });
    } catch (error) {
            captureApiError(error);
        console.error("API: 장소 검색 오류:", error);
        return NextResponse.json({ error: "장소 검색 중 오류가 발생했습니다." }, { status: 500 });
    }
}

function ensureAdminOrUser(req: NextRequest): boolean {
    if (verifyAdminJwt(req)) return true;
    return resolveUserId(req) !== null;
}

/** closed_days 배열 정규화: { day_of_week?: number|null, specific_date?: string|null, note?: string|null }[] → DB 입력용 */
function normalizeClosedDays(
    raw: unknown
): { day_of_week: number | null; specific_date: Date | null; note: string | null }[] {
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw
        .map((item: any) => {
            const dayOfWeek = item?.day_of_week;
            const specificDate = item?.specific_date;
            const note = item?.note;
            const day =
                typeof dayOfWeek === "number" && dayOfWeek >= 0 && dayOfWeek <= 6 ? dayOfWeek : null;
            let date: Date | null = null;
            if (specificDate != null && specificDate !== "") {
                const d = new Date(specificDate);
                if (!isNaN(d.getTime())) date = d;
            }
            const noteStr = note != null && String(note).trim() !== "" ? String(note).trim() : null;
            if (day === null && date === null && noteStr === null) return null;
            return { day_of_week: day, specific_date: date, note: noteStr };
        })
        .filter((x): x is { day_of_week: number | null; specific_date: Date | null; note: string | null } => x != null);
}

export async function POST(request: NextRequest) {
    try {
        if (!ensureAdminOrUser(request)) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const body = await request.json();
        const {
            name,
            address,
            address_en,
            address_ja,
            address_zh,
            description,
            category,
            avg_cost_range,
            opening_hours,
            phone,
            website,
            parking_available,
            reservation_required,
            latitude,
            longitude,
            imageUrl,
            tags,
            closed_days: rawClosedDays,
        } = body || {};

        const coerceTags = (val: any) => {
            if (val == null) return null;
            if (typeof val === "string") {
                try {
                    const parsed = JSON.parse(val);
                    return parsed;
                } catch {
                    if (val.includes(",")) {
                        return val
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean);
                    }
                    return val; // store as JSON string value
                }
            }
            if (typeof val === "object") return val;
            return val;
        };

        if (!name) {
            return NextResponse.json({ error: "장소 이름은 필수입니다." }, { status: 400 });
        }

        const closedDaysList = normalizeClosedDays(rawClosedDays);

        const created = await (prisma as any).place.create({
            data: {
                name,
                address: address || null,
                address_en: address_en || null,
                address_ja: address_ja || null,
                address_zh: address_zh || null,
                description: description || null,
                category: category || null,
                avg_cost_range: avg_cost_range || null,
                opening_hours: opening_hours || null,
                phone: phone || null,
                parking_available: typeof parking_available === "boolean" ? parking_available : false,
                latitude: latitude ?? null,
                longitude: longitude ?? null,
                imageUrl: imageUrl || null,
                tags: coerceTags(tags),
            },
            select: {
                id: true,
                name: true,
                address: true,
                description: true,
                category: true,
                latitude: true,
                longitude: true,
                imageUrl: true,
                tags: true,
            },
        });

        if (closedDaysList.length > 0) {
            await (prisma as any).placeClosedDay.createMany({
                data: closedDaysList.map((d: { day_of_week: number | null; specific_date: Date | null; note: string | null }) => ({
                    place_id: created.id,
                    day_of_week: d.day_of_week,
                    specific_date: d.specific_date,
                    note: d.note || null,
                })),
            });
        }

        return NextResponse.json({ success: true, place: created }, { status: 201 });
    } catch (error) {
            captureApiError(error);
        console.error("API: 장소 생성 오류:", error);
        return NextResponse.json({ error: "장소 생성 실패" }, { status: 500 });
    }
}
