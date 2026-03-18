import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RecomputeBody = {
    userId?: number;
    days?: number;
    minCount?: number;
    minShare?: number;
};

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json().catch(() => ({}))) as RecomputeBody;
        const userId = Number.isFinite(Number(body?.userId)) ? Number(body?.userId) : undefined;
        const days = Math.max(1, Math.min(180, Number(body?.days ?? 30))); // 기본 30일, 1~180일 허용
        const minCount = Math.max(1, Math.min(1000, Number(body?.minCount ?? 3))); // 최소 3회 이상 상호작용
        const minShare = Math.max(0, Math.min(1, Number(body?.minShare ?? 0.5))); // 해당 지역 비중 50% 이상

        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // 최근 N일 상호작용 가져오기 (선택적 단일 유저 필터)
        const interactions = await prisma.userInteraction.findMany({
            where: {
                createdAt: { gte: cutoff },
                ...(userId ? { userId } : {}),
            },
            select: {
                userId: true,
                course: { select: { region: true } },
            },
        });

        // userId -> region -> count 집계
        const byUser: Map<number, Map<string, number>> = new Map();
        for (const it of interactions) {
            const uid = it.userId;
            const region = String(it.course?.region || "").trim();
            if (!region) continue;
            if (!byUser.has(uid)) byUser.set(uid, new Map());
            const regionMap = byUser.get(uid)!;
            regionMap.set(region, (regionMap.get(region) || 0) + 1);
        }

        let processedUsers = 0;
        let updatedCount = 0;
        const updates: Array<Promise<any>> = [];

        for (const [uid, regionMap] of byUser.entries()) {
            processedUsers += 1;
            // 총 상호작용 수
            const total = Array.from(regionMap.values()).reduce((a, b) => a + b, 0);
            if (total < minCount) continue;

            // 최다 지역 및 비중 계산
            let topRegion = "";
            let topCount = 0;
            for (const [region, cnt] of regionMap.entries()) {
                if (cnt > topCount) {
                    topCount = cnt;
                    topRegion = region;
                }
            }
            const share = topCount / total;
            if (!topRegion || topCount < minCount || share < minShare) continue;

            // 기존 값과 다를 때만 업데이트
            updates.push(
                prisma.user
                    .update({
                        where: { id: uid },
                        data: { location: topRegion },
                        select: { id: true },
                    })
                    .then(() => {
                        updatedCount += 1;
                    })
                    .catch(() => {
                        /* 무시하고 진행 */
                    })
            );
        }

        if (updates.length > 0) {
            await Promise.all(updates);
        }

        return NextResponse.json({
            ok: true,
            days,
            minCount,
            minShare,
            processedUsers,
            updatedCount,
        });
    } catch (error) {

            captureApiError(error);
        console.error("Failed to recompute user.location:", error);
        return NextResponse.json({ error: "Failed to recompute user.location" }, { status: 500 });
    }
}


