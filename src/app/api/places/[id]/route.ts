import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Admin 인증 체크 헬퍼 함수
function ensureAdminOrUser(req: NextRequest): boolean {
    // Admin 인증 확인 (admin_auth 쿠키)
    const adminAuth = req.cookies.get("admin_auth")?.value;
    if (adminAuth === "true") return true;
    
    // 일반 사용자 인증 확인
    const userId = resolveUserId(req);
    return userId !== null;
}

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (!ensureAdminOrUser(request)) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }
        const { id } = await params;
        const placeId = Number(id);
        if (!placeId || isNaN(placeId)) return NextResponse.json({ error: "Invalid place ID" }, { status: 400 });

        const place = await (prisma as any).place.findUnique({
            where: { id: placeId },
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
                closed_days: {
                    select: {
                        id: true,
                        day_of_week: true,
                        specific_date: true,
                        note: true,
                    },
                },
            },
        });
        if (!place) return NextResponse.json({ error: "장소를 찾을 수 없습니다." }, { status: 404 });
        return NextResponse.json({ success: true, place });
    } catch (error) {
        console.error("API: 장소 단건 조회 오류:", error);
        return NextResponse.json({ error: "장소 조회 실패" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (!ensureAdminOrUser(request)) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const { id } = await params;
        const placeId = Number(id);
        if (!placeId || isNaN(placeId)) return NextResponse.json({ error: "Invalid place ID" }, { status: 400 });

        const body = await request.json();
        const {
            name,
            address,
            description,
            category,
            avg_cost_range,
            opening_hours,
            phone,
            parking_available,
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
                    return val; // JSON string 값으로 저장
                }
            }
            if (typeof val === "object") return val;
            return val;
        };

        const updated = await (prisma as any).place.update({
            where: { id: placeId },
            data: {
                ...(name !== undefined ? { name } : {}),
                ...(address !== undefined ? { address } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(category !== undefined ? { category } : {}),
                ...(avg_cost_range !== undefined ? { avg_cost_range } : {}),
                ...(opening_hours !== undefined ? { opening_hours } : {}),
                ...(phone !== undefined ? { phone } : {}),
                ...(parking_available !== undefined ? { parking_available: Boolean(parking_available) } : {}),
                ...(latitude !== undefined ? { latitude } : {}),
                ...(longitude !== undefined ? { longitude } : {}),
                ...(imageUrl !== undefined ? { imageUrl } : {}),
                ...(tags !== undefined ? { tags: coerceTags(tags) } : {}),
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

        if (rawClosedDays !== undefined) {
            await (prisma as any).placeClosedDay.deleteMany({ where: { place_id: placeId } });
            const closedDaysList = normalizeClosedDays(rawClosedDays);
            if (closedDaysList.length > 0) {
                await (prisma as any).placeClosedDay.createMany({
                    data: closedDaysList.map((d: { day_of_week: number | null; specific_date: Date | null; note: string | null }) => ({
                        place_id: placeId,
                        day_of_week: d.day_of_week,
                        specific_date: d.specific_date,
                        note: d.note || null,
                    })),
                });
            }
        }

        return NextResponse.json({ success: true, place: updated });
    } catch (error) {
        console.error("API: 장소 수정 오류:", error);
        return NextResponse.json({ error: "장소 수정 실패" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (!ensureAdminOrUser(request)) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const { id } = await params;
        const placeId = Number(id);
        if (!placeId || isNaN(placeId)) return NextResponse.json({ error: "Invalid place ID" }, { status: 400 });

        await (prisma as any).place.delete({ where: { id: placeId } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("API: 장소 삭제 오류:", error);
        return NextResponse.json({ error: "장소 삭제 실패" }, { status: 500 });
    }
}
