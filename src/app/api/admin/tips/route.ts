import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { REVIEW_STATUSES } from "@/lib/tipPipeline";
import { hasPrice, type TipPrice } from "@/lib/tipPrice";

export const dynamic = "force-dynamic";

/** 팁 검수 장소 목록: ?status=collecting|review|done|recheck / ?status=price → 가격 확인 필요 팁을 장소별로 (사장님 DM 질문 목록) */
export async function GET(req: NextRequest) {
    if (!verifyAdminJwt(req)) return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
    const status = req.nextUrl.searchParams.get("status");
    if (status === "price") return NextResponse.json(await priceCheckList());

    const places = await prisma.place.findMany({
        where: status ? { tip_status: status } : { tip_status: { not: null } },
        select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            tip_status: true,
            updated_at: true,
            tip_candidates: { where: { status: { in: REVIEW_STATUSES } }, select: { status: true } },
        },
        orderBy: { updated_at: "desc" },
        take: 200,
    });

    return NextResponse.json(
        places.map(({ tip_candidates, ...p }) => ({
            ...p,
            candidate: tip_candidates.filter((c) => c.status === "candidate").length,
            official: tip_candidates.filter((c) => c.status === "official").length,
            needsCheck: tip_candidates.filter((c) => c.status === "needs_check").length,
        }))
    );
}

/** 근거에서 가격을 못 찾은 활동 팁 (검수 중 + 승인됨). 문장에 사람이 가격을 넣었으면 해결로 봄 */
async function priceCheckList() {
    const cands = await prisma.tipCandidate.findMany({
        where: { status: { in: [...REVIEW_STATUSES, "approved"] }, price: { not: Prisma.AnyNull } },
        select: { id: true, content: true, status: true, price: true, place: { select: { id: true, name: true, address: true, instagram_handle: true } } },
        orderBy: { place_id: "asc" },
    });
    const byPlace = new Map<number, { id: number; name: string; address: string | null; instagram_handle: string | null; tips: { id: number; content: string; approved: boolean; unverified: TipPrice["unverified"] }[] }>();
    for (const c of cands) {
        const price = c.price as TipPrice | null;
        if (!price || price.value || hasPrice(c.content)) continue;
        if (!byPlace.has(c.place.id)) byPlace.set(c.place.id, { ...c.place, tips: [] });
        byPlace.get(c.place.id)!.tips.push({ id: c.id, content: c.content, approved: c.status === "approved", unverified: price.unverified ?? [] });
    }
    return [...byPlace.values()];
}
