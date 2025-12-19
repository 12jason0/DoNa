import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

        const placeId = Number(params.id);
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

        return NextResponse.json({ success: true, place: updated });
    } catch (error) {
        console.error("API: 장소 수정 오류:", error);
        return NextResponse.json({ error: "장소 수정 실패" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

        const placeId = Number(params.id);
        if (!placeId || isNaN(placeId)) return NextResponse.json({ error: "Invalid place ID" }, { status: 400 });

        await (prisma as any).place.delete({ where: { id: placeId } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("API: 장소 삭제 오류:", error);
        return NextResponse.json({ error: "장소 삭제 실패" }, { status: 500 });
    }
}
