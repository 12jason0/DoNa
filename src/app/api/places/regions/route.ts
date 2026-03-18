import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";
export const dynamic = "force-dynamic";
// places.address에서 상위 지역(예: '서울', '경기 광명시', '부산') 후보를 추출
export async function GET(_req: NextRequest) {
    try {
        const rows = await (prisma as any).place.findMany({
            where: { address: { not: null } },
            select: { address: true },
            take: 5000,
        } as any);

        const regions = new Map<string, number>();

        (rows as Array<{ address: string | null }>).forEach(({ address }) => {
            const parts = String(address).trim().split(/\s+/);
            if (parts.length === 0) return;
            // 주소 내에서 'OO구' 형태의 첫 번째 토큰만 추출
            const gu = parts.find((p) => /구$/.test(p));
            if (!gu) return;
            regions.set(gu, (regions.get(gu) || 0) + 1);
        });

        const sorted = Array.from(regions.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 200)
            .map(([name]) => name);

        return NextResponse.json({ success: true, regions: sorted });
    } catch (e) {

            captureApiError(e);
        console.error("GET /api/places/regions error:", e);
        // 실패 시에도 기본 빈 배열을 반환하여 페이지가 계속 동작하도록 함
        return NextResponse.json({ success: true, regions: [] });
    } finally {
    }
}
