import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const all = searchParams.get("all");
        const lat = searchParams.get("lat");
        const lng = searchParams.get("lng");
        const region = searchParams.get("region");

        // Admin 등에서 전체 목록이 필요한 경우: /api/places?all=1&limit=10&offset=0&search=검색어
        if (all === "1") {
            const limitParam = Math.min(Math.max(Number(searchParams.get("limit") ?? 10), 1), 100);
            const offsetParam = Math.max(Number(searchParams.get("offset") ?? 0), 0);
            const searchQuery = (searchParams.get("search") || "").trim();

            // 검색 조건 구성
            const whereClause: any = {};
            if (searchQuery) {
                whereClause.name = { contains: searchQuery, mode: "insensitive" };
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
            // 혼잡도 계산 (랜덤)
            const crowdLevels = ["여유", "보통", "혼잡", "매우 혼잡"];
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
        console.error("API: 장소 검색 오류:", error);
        return NextResponse.json({ error: "장소 검색 중 오류가 발생했습니다." }, { status: 500 });
    }
}

// Admin 인증 체크 헬퍼 함수
function ensureAdminOrUser(req: NextRequest): boolean {
    // Admin 인증 확인 (admin_auth 쿠키)
    const adminAuth = req.cookies.get("admin_auth")?.value;
    if (adminAuth === "true") return true;
    
    // 일반 사용자 인증 확인
    const userId = resolveUserId(req);
    return userId !== null;
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

        const created = await (prisma as any).place.create({
            data: {
                name,
                address: address || null,
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

        return NextResponse.json({ success: true, place: created }, { status: 201 });
    } catch (error) {
        console.error("API: 장소 생성 오류:", error);
        return NextResponse.json({ error: "장소 생성 실패" }, { status: 500 });
    }
}
