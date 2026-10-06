import { NextRequest, NextResponse } from "next/server";
import { captureApiError } from "@/lib/sentry";
import {
    downgradeExpiredSubscriptions,
    fetchRevenueCatSubscriber,
    hasActiveSubscription,
} from "@/lib/subscriptionExpiry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** 매일 1회: 만료일이 지났는데 유료인 사용자를 RevenueCat으로 재확인 후 FREE (src/lib/subscriptionExpiry.ts) */
export async function GET(req: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!process.env.REVENUECAT_SECRET_API_KEY) {
        // 키 없이 돌면 전원 '조회 실패 → 유지'라 의미 없음 — 설정 누락을 알림
        captureApiError(new Error("[구독 만료 점검] REVENUECAT_SECRET_API_KEY 미설정 — 아무도 변경하지 않음"));
        return NextResponse.json({ error: "REVENUECAT_SECRET_API_KEY missing" }, { status: 500 });
    }
    try {
        // 점검 모드 (?dryRun=1&probe=<userId>): DB 변경 없이 대상자 목록 + RevenueCat 조회 가능 여부만 확인
        const { searchParams } = new URL(req.url);
        if (searchParams.get("dryRun") === "1") {
            const result = await downgradeExpiredSubscriptions(undefined, new Date(), true);
            const probe = searchParams.get("probe");
            const probeSub = probe ? await fetchRevenueCatSubscriber(probe) : undefined;
            return NextResponse.json({
                dryRun: true,
                ...result,
                ...(probe && {
                    probe: {
                        userId: probe,
                        revenueCatReachable: !!probeSub,
                        hasActiveSubscription: probeSub ? hasActiveSubscription(probeSub) : null,
                    },
                }),
            });
        }
        const result = await downgradeExpiredSubscriptions();
        console.log("[구독 만료 점검] 완료", {
            checked: result.checked,
            downgraded: result.downgraded.length,
            keptActive: result.keptActive,
            skipped: result.skipped,
        });
        return NextResponse.json(result);
    } catch (e) {
        captureApiError(e);
        return NextResponse.json({ error: "subscription expiry check failed" }, { status: 500 });
    }
}
