import { api } from "../../lib/api";
import { resolveImageUrl } from "../../lib/imageUrl";
import type { PlaceStatus as CoursePlaceOpenStatus } from "../../../../src/lib/placeStatus";
import type { CoursePlaceTipsRow } from "../../../../src/types/tip";
import type { PlaceData, CoursePlace } from "./types";

export function getWalkingMinutes(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const distM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.max(1, Math.round((distM * 1.4) / 80));
}

export function getPlaceImageUrl(place?: PlaceData): string | undefined {
    if (!place) return undefined;
    const raw = place.imageUrl ?? place.image_url;
    return resolveImageUrl(raw);
}

export function getPlaceLatLng(place?: PlaceData): { lat: number; lng: number } | null {
    if (!place) return null;
    const lat = Number(place.latitude ?? place.lat);
    const lng = Number(place.longitude ?? place.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

export function getPlaceReservationUrl(place?: PlaceData): string | undefined {
    if (!place) return undefined;
    return place.reservationUrl ?? place.reservation_url ?? undefined;
}

export function getPlaceMapUrl(place?: PlaceData): string {
    if (!place) return "https://map.naver.com";
    const direct = place.maps_link ?? place.mapUrl;
    if (direct) return direct;
    const coords = getPlaceLatLng(place);
    if (coords) return `https://map.naver.com/v5/search/${coords.lng},${coords.lat}`;
    const query = encodeURIComponent(place.name || place.address || "");
    return `https://map.naver.com/v5/search/${query}`;
}

export function getRouteMapUrl(from?: PlaceData, to?: PlaceData, routeNames?: { origin: string; dest: string }): string {
    if (!from || !to) return getPlaceMapUrl(to ?? from);
    const f = getPlaceLatLng(from);
    const t = getPlaceLatLng(to);
    const fromName = encodeURIComponent(from.name || routeNames?.origin || "");
    const toName = encodeURIComponent(to.name || routeNames?.dest || "");
    if (f && t) {
        return `https://map.naver.com/index.nhn?slng=${f.lng}&slat=${f.lat}&stext=${fromName}&elng=${t.lng}&elat=${t.lat}&etext=${toName}&menu=route`;
    }
    return getPlaceMapUrl(to);
}

export function getNaverAppRouteUrl(place?: PlaceData, destinationFallback?: string): string | null {
    if (!place) return null;
    const c = getPlaceLatLng(place);
    if (!c) return null;
    const dname = encodeURIComponent(place.name || destinationFallback || "");
    // 네이버 지도 앱 딥링크: 현재 위치 -> 목적지 빠른 길찾기
    return `nmap://route/public?dlat=${c.lat}&dlng=${c.lng}&dname=${dname}&appname=kr.io.dona`;
}

export async function uploadImageViaPresign(
    uri: string,
    courseId: string,
    err: { presign: string; putFail: string },
): Promise<string> {
    const filename = uri.split("/").pop() ?? "photo.jpg";
    const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
    const contentType = ext === "png" ? "image/png" : "image/jpeg";

    // 서버 설정 차이를 고려해 review -> memory 순으로 fallback
    const requestPresign = async (type: "review" | "memory") =>
        api.post<{ success: boolean; uploads: { uploadUrl: string; publicUrl: string }[] }>(
            "/api/upload/presign",
            { type, courseId: String(courseId), files: [{ filename, contentType, size: 0 }] },
        );

    let presignRes: { success: boolean; uploads: { uploadUrl: string; publicUrl: string }[] };
    try {
        presignRes = await requestPresign("review");
    } catch {
        presignRes = await requestPresign("memory");
    }

    if (!presignRes.success || !presignRes.uploads?.[0]) {
        throw new Error(err.presign);
    }

    const { uploadUrl, publicUrl } = presignRes.uploads[0];
    const blobRes = await fetch(uri);
    const blob = await blobRes.blob();
    const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": contentType },
    });
    if (!putRes.ok) throw new Error(err.putFail);
    return publicUrl;
}

/** getPlaceStatus(웹과 동일)에 맞게 휴무 배열 정규화 */
export function closedDaysForPlaceStatus(
    raw?: PlaceData["closed_days"],
): { day_of_week: number | null; specific_date: Date | string | null; note?: string | null }[] {
    return (raw ?? []).map((d) => ({
        day_of_week: d.day_of_week != null ? d.day_of_week : null,
        specific_date: d.specific_date ?? null,
        note: d.note ?? null,
    }));
}

export function isPlaceClosedForReserve(st: CoursePlaceOpenStatus): boolean {
    return st === "휴무" || st === "영업종료";
}

export function coursePlaceToTipsRow(cp?: CoursePlace | null): CoursePlaceTipsRow {
    if (!cp) return { tips: null };
    return {
        tips: cp.tips ?? null,
        tips_en: cp.tips_en ?? null,
        tips_ja: cp.tips_ja ?? null,
        tips_zh: cp.tips_zh ?? null,
    };
}
