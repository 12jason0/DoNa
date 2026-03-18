import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // meters
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export async function POST(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const storyId = Number(body?.storyId);
        const lat = Number(body?.lat);
        const lng = Number(body?.lng);
        const placeOptionId = body?.placeOptionId ? Number(body.placeOptionId) : null;
        const RADIUS = Number.isFinite(Number(body?.radius)) ? Number(body.radius) : 150; // meters

        if (!Number.isFinite(storyId) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        // Check if user started the story
        const progress = await prisma.userStoryProgress.findUnique({
            where: { user_id_story_id: { user_id: Number(userId), story_id: storyId } },
        });
        const hasStarted = !!progress && progress.status !== "not_started";
        if (!hasStarted) {
            return NextResponse.json({ inRange: false, started: false });
        }

        // If a specific place option is provided, check only that
        if (placeOptionId && Number.isFinite(placeOptionId)) {
            const opt = await prisma.placeOption.findUnique({ where: { id: placeOptionId } });
            if (opt?.latitude != null && opt?.longitude != null) {
                const d = haversineMeters(lat, lng, Number(opt.latitude), Number(opt.longitude));
                const inRange = d <= RADIUS;
                return NextResponse.json({
                    inRange,
                    started: true,
                    nearest: { type: "placeOption", id: placeOptionId, distance: d },
                });
            }
            return NextResponse.json({
                inRange: false,
                started: true,
                nearest: { type: "placeOption", id: placeOptionId, distance: Infinity },
            });
        }

        // Fetch story station and place options (with coordinates)
        const [story, options] = await Promise.all([
            prisma.story.findUnique({ where: { id: storyId } }),
            prisma.placeOption.findMany({
                where: { storyId: storyId, latitude: { not: null }, longitude: { not: null } },
                select: { id: true, latitude: true, longitude: true },
            }),
        ]);

        let nearest = {
            type: "none" as "none" | "station" | "placeOption",
            id: null as number | null,
            distance: Infinity,
        };

        const stationLat = (story as any)?.stationLat ?? (story as any)?.stationlat ?? null;
        const stationLng = (story as any)?.stationLng ?? (story as any)?.stationlng ?? null;
        if (stationLat != null && stationLng != null) {
            const d = haversineMeters(lat, lng, Number(stationLat), Number(stationLng));
            if (d < nearest.distance) nearest = { type: "station", id: null, distance: d };
        }

        for (const opt of options) {
            const d = haversineMeters(lat, lng, Number(opt.latitude), Number(opt.longitude));
            if (d < nearest.distance) nearest = { type: "placeOption", id: opt.id, distance: d };
        }

        const inRange = nearest.distance <= RADIUS;
        return NextResponse.json({ inRange, started: true, nearest });
    } catch (error) {

            captureApiError(error);
        console.error("Geofence check error", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
