import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
    "기능이 불편해요": "기능이 불편해요",
    "원하는 콘텐츠가 없어요": "원하는 콘텐츠가 없어요",
    "다른 앱을 사용하게 되었어요": "다른 앱을 사용하게 되었어요",
    "사용 빈도가 낮아요": "사용 빈도가 낮아요",
    "개인정보 보호가 걱정돼요": "개인정보 보호가 걱정돼요",
};

export async function GET(request: NextRequest) {
    try {
        if (!verifyAdminJwt(request)) {
            return NextResponse.json({ error: "ADMIN_ONLY" }, { status: 401 });
        }

        const logs = await (prisma as any).withdrawalLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 500,
        });

        const reasonCounts: Record<string, number> = {};
        for (const log of logs) {
            const r = log.reason?.trim() || "미입력";
            reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
        }

        return NextResponse.json({
            total: logs.length,
            logs: logs.map((l: any) => ({
                id: l.id,
                userId: l.userId,
                reason: l.reason ?? null,
                createdAt: l.createdAt,
            })),
            reasonCounts: Object.entries(reasonCounts)
                .map(([reason, count]) => ({ reason, count }))
                .sort((a, b) => b.count - a.count),
        });
    } catch (e) {
        captureApiError(e);
        return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
    }
}
