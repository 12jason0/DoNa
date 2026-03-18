import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { SubscriptionTier } from "@prisma/client";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * [Vercel Cron Jobs용 API]
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET || "default-secret-change-in-production";

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const expiringSubscriptions = await prisma.user.findMany({
            where: {
                isAutoRenewal: true,
                billingKey: { not: null },
                subscriptionExpiresAt: {
                    lte: tomorrow,
                    gte: now,
                },
                subscriptionTier: {
                    in: ["BASIC", "PREMIUM"],
                },
            },
            select: {
                id: true,
                billingKey: true,
                subscriptionTier: true,
                subscriptionExpiresAt: true,
            },
        });

        console.log(`[구독 자동갱신] 만료 예정 구독 ${expiringSubscriptions.length}개 발견`);

        const results = {
            total: expiringSubscriptions.length,
            success: 0,
            failed: 0,
            errors: [] as Array<{ userId: number; error: string }>,
        };

        for (const user of expiringSubscriptions) {
            try {
                await processSubscriptionRenewal(user.id, user.billingKey!, user.subscriptionTier);
                results.success++;
            } catch (error: any) {

                    captureApiError(error);
                console.error(`[구독 자동갱신 실패] User ${user.id}:`, error);

                // ❌ [슬랙 알림] 결제 실패 시 즉시 전송
                const planName = user.subscriptionTier === "PREMIUM" ? "프리미엄 멤버십" : "베이직 멤버십";
                const failureMessage = `
⚠️ *[두나] 정기 결제 실패*
━━━━━━━━━━━━━━━━━━━━
👤 *유저 ID:* ${user.id}
📦 *상품명:* ${planName}
❌ *실패사유:* ${error.message || "알 수 없는 오류"}
🛠️ *조치:* 유저 등급이 FREE로 변경되었습니다.
━━━━━━━━━━━━━━━━━━━━
확인 후 유저에게 안내가 필요할 수 있습니다.
                `;
                await sendSlackMessage(failureMessage);

                results.failed++;
                results.errors.push({
                    userId: user.id,
                    error: error.message || "Unknown error",
                });

                try {
                    // 🟢 [트랜잭션 일관성] 결제 실패 시 등급 강등만 수행 (단일 업데이트이므로 별도 트랜잭션 불필요)
                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            subscriptionTier: "FREE",
                            isAutoRenewal: false,
                            subscriptionExpiresAt: null,
                        },
                    });
                } catch (updateError) {

                        captureApiError(updateError);
                    console.error(`[등급 변경 실패] User ${user.id}:`, updateError);
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `구독 자동갱신 완료: 성공 ${results.success}개, 실패 ${results.failed}개`,
            results,
        });
    } catch (error) {

            captureApiError(error);
        console.error("[구독 자동갱신 전체 오류]:", error);
        return NextResponse.json(
            { success: false, error: "구독 자동갱신 처리 중 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}

/**
 * 실제 토스 결제를 진행하고 DB를 업데이트하는 핵심 함수
 */
async function processSubscriptionRenewal(userId: number, billingKey: string, currentTier: SubscriptionTier) {
    const planInfo =
        currentTier === "PREMIUM"
            ? { amount: 9900, name: "프리미엄 멤버십", tier: "PREMIUM" }
            : { amount: 4900, name: "베이직 멤버십", tier: "BASIC" };

    // 🟢 빌링/구독 결제용 시크릿 키 (환경변수에서 로드)
    const secretKey = process.env.TOSS_SECRET_KEY_BILLING;
    if (!secretKey) {
        throw new Error("빌링 시크릿 키가 설정되지 않았습니다. TOSS_SECRET_KEY_BILLING 환경변수를 확인하세요.");
    }
    const authHeader = Buffer.from(`${secretKey}:`).toString("base64");

    const orderId = `renew_${currentTier.toLowerCase()}_${userId}_${Date.now()}`;
    const customerKey = `user_${userId}`;

    const billingPaymentResponse = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/json",
            "Idempotency-Key": orderId, // 멱등성 보장
        },
        body: JSON.stringify({
            customerKey: customerKey,
            amount: planInfo.amount,
            orderId: orderId,
            orderName: `${planInfo.name} 자동갱신`,
        }),
    });

    const billingPaymentData = await billingPaymentResponse.json();

    if (!billingPaymentResponse.ok) {
        throw new Error(billingPaymentData.message || "빌링 결제 승인 실패");
    }

    const now = new Date();
    const newExpiresAt = new Date(now);
    newExpiresAt.setDate(newExpiresAt.getDate() + 30);

    // DB 트랜잭션 처리
    await prisma.$transaction(async (tx: any) => {
        await tx.payment.create({
            data: {
                orderId: orderId,
                userId: userId,
                orderName: `${planInfo.name} 자동갱신`,
                amount: planInfo.amount,
                status: "PAID",
                paymentKey: billingPaymentData.paymentKey || billingKey,
                method: billingPaymentData.method || "CARD",
                approvedAt: new Date(billingPaymentData.approvedAt || now),
            },
        });

        await tx.user.update({
            where: { id: userId },
            data: {
                subscriptionTier: planInfo.tier,
                subscriptionExpiresAt: newExpiresAt,
                isAutoRenewal: true,
            },
        });
    });

    // ✅ [슬랙 알림] 결제 성공 시 DB 업데이트 후 전송
    const successMessage = `
🚀 *[두나] 정기 결제 성공*
━━━━━━━━━━━━━━━━━━━━
👤 *유저 ID:* ${userId}
📦 *상품명:* ${planInfo.name}
💰 *결제금액:* ${planInfo.amount.toLocaleString()}원
🆔 *주문번호:* ${orderId}
📅 *다음 만료일:* ${newExpiresAt.toLocaleDateString()}
━━━━━━━━━━━━━━━━━━━━
✨ 오늘도 두나가 한 건 했습니다!
    `;
    await sendSlackMessage(successMessage);

    console.log(`[구독 자동갱신 성공] User ${userId}: 갱신 완료`);
}

/**
 * 슬랙으로 알림을 보내는 도우미 함수
 */
async function sendSlackMessage(text: string) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
        await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });
    } catch (err) {

            captureApiError(err);
        console.error("슬랙 전송 에러:", err);
    }
}
