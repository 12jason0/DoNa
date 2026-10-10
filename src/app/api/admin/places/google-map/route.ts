import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";
import { findGooglePlace } from "@/lib/googlePlaces";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? "";
const DELAY_MS = 150;

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
    try {
        if (!verifyAdminJwt(req)) {
            return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
        }
        if (!GOOGLE_API_KEY) {
            return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY 환경변수가 없습니다." }, { status: 500 });
        }

        const places = await (prisma as any).place.findMany({
            where: { google_place_id: null },
            select: { id: true, name: true, address: true, latitude: true, longitude: true },
        });

        let mapped = 0, failed = 0, coordsFilled = 0;
        const failedPlaces: { id: number; name: string; address: string | null }[] = [];

        for (const place of places) {
            const result = await findGooglePlace(place.name, place.address ?? "");
            if (result) {
                const updateData: Record<string, unknown> = { google_place_id: result.place_id };
                // 기존 좌표 없을 때만 덮어씀
                if (result.lat !== null && result.lng !== null && place.latitude == null && place.longitude == null) {
                    updateData.latitude = result.lat;
                    updateData.longitude = result.lng;
                    coordsFilled++;
                }
                await (prisma as any).place.update({
                    where: { id: place.id },
                    data: updateData,
                });
                mapped++;
            } else {
                failed++;
                failedPlaces.push({ id: place.id, name: place.name, address: place.address });
            }
            await sleep(DELAY_MS);
        }

        return NextResponse.json({ success: true, total: places.length, mapped, failed, coordsFilled, failedPlaces });
    } catch (error) {
        captureApiError(error);
        return NextResponse.json({ error: "매핑 실패" }, { status: 500 });
    }
}
