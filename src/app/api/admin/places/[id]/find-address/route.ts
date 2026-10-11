import { NextRequest, NextResponse } from "next/server";
import { verifyAdminJwt } from "@/lib/auth";
import { findPopupAddress, savePlaceLocation } from "@/lib/popupAddress";
import { runTipPipeline } from "@/lib/tipPipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // 저장 후 구글 자료까지 다시 모으기 (약 30초)

/**
 * 위치 없는 장소의 주소 자동 찾기
 * body 없음: 네이버 지역검색 → 모은 블로그 자료에서 주소 후보 찾기 → { found: {address, lat, lng, via} | null }
 * body { apply: {address, lat, lng} }: 저장 후 구글 자료 포함해 팁 자료 다시 모으기
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!verifyAdminJwt(req)) return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
    const placeId = Number((await params).id);
    const body = await req.json().catch(() => ({}));

    try {
        const a = body?.apply;
        if (!a) return NextResponse.json({ found: await findPopupAddress(placeId) });
        if (typeof a.address !== "string" || !Number.isFinite(a.lat) || !Number.isFinite(a.lng)) {
            return NextResponse.json({ error: "주소·좌표가 올바르지 않아요." }, { status: 400 });
        }
        await savePlaceLocation(placeId, { label: a.address, address: a.address, lat: a.lat, lng: a.lng });
        const tips = await runTipPipeline(placeId).catch(() => null);
        return NextResponse.json({ saved: true, tips: tips && { candidate: tips.candidate, official: tips.official, needsCheck: tips.needsCheck } });
    } catch (e) {
        console.error("주소 자동 찾기 실패:", e);
        return NextResponse.json({ error: e instanceof Error ? e.message : "처리 실패" }, { status: 500 });
    }
}
