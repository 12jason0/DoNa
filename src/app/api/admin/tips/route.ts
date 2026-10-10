import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { PENDING_STATUSES } from "@/lib/tipPipeline";

export const dynamic = "force-dynamic";

/** 팁 검수 장소 목록: ?status=collecting|review|done|recheck */
export async function GET(req: NextRequest) {
    if (!verifyAdminJwt(req)) return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
    const status = req.nextUrl.searchParams.get("status");

    const places = await prisma.place.findMany({
        where: status ? { tip_status: status } : { tip_status: { not: null } },
        select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            tip_status: true,
            updated_at: true,
            tip_candidates: { where: { status: { in: PENDING_STATUSES } }, select: { status: true } },
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
