import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? "";
const DELAY_MS = 150;

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function findGooglePlaceId(name: string, address: string): Promise<string | null> {
    const query = encodeURIComponent(`${name} ${address}`);
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.candidates?.[0]?.place_id ?? null;
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
            select: { id: true, name: true, address: true },
        });

        let mapped = 0, failed = 0;

        for (const place of places) {
            const placeId = await findGooglePlaceId(place.name, place.address ?? "");
            if (placeId) {
                await (prisma as any).place.update({
                    where: { id: place.id },
                    data: { google_place_id: placeId },
                });
                mapped++;
            } else {
                failed++;
            }
            await sleep(DELAY_MS);
        }

        return NextResponse.json({ success: true, total: places.length, mapped, failed });
    } catch (error) {
        captureApiError(error);
        return NextResponse.json({ error: "매핑 실패" }, { status: 500 });
    }
}
