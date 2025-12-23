import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { SubscriptionTier } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 구독권 자동갱신 API
 * Vercel Cron Jobs로 매일 오전 2시에 실행됩니다.
 *
 * 처리 로직:
 * 1. 만료일이 1일 이내인 구독 찾기 (isAutoRenewal: true, billingKey 존재)
 * 2. 각 구독에 대해 빌링키로 자동결제 시도
 * 3. 결제 성공 시 구독 기간 연장 (30일)
 * 4. 결제 실패 시 등급을 FREE로 변경 및 알림
 */
export async function GET(req: NextRequest) {
    try {
        // 🟢 보안: Vercel Cron Jobs에서만 호출 가능하도록 검증
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET || "default-secret-change-in-production";

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // 🟢 만료일이 1일 이내인 구독 찾기 (자동갱신 활성화, 빌링키 존재)
        const expiringSubscriptions = await prisma.user.findMany({
            where: {
                isAutoRenewal: true,
                billingKey: { not: null },
                subscriptionExpiresAt: {
                    lte: tomorrow, // 내일까지 만료되는 구독
                    gte: now, // 아직 만료되지 않은 구독
                },
                subscriptionTier: {
                    in: ["BASIC", "PREMIUM"], // FREE는 제외
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

        // 🟢 각 구독에 대해 자동결제 처리
        for (const user of expiringSubscriptions) {
            try {
                await processSubscriptionRenewal(user.id, user.billingKey!, user.subscriptionTier);
                results.success++;
            } catch (error: any) {
                console.error(`[구독 자동갱신 실패] User ${user.id}:`, error);
                results.failed++;
                results.errors.push({
                    userId: user.id,
                    error: error.message || "Unknown error",
                });

                // 🟢 결제 실패 시 등급을 FREE로 변경
                try {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            subscriptionTier: "FREE",
                            isAutoRenewal: false,
                            subscriptionExpiresAt: null,
                        },
                    });
                } catch (updateError) {
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
        console.error("[구독 자동갱신 전체 오류]:", error);
        return NextResponse.json(
            {
                success: false,
                error: "구독 자동갱신 처리 중 오류가 발생했습니다.",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

/**
 * 개별 구독 갱신 처리 함수
 */
async function processSubscriptionRenewal(userId: number, billingKey: string, currentTier: SubscriptionTier) {
    // 🟢 플랜 정보 결정
    const planInfo =
        currentTier === "PREMIUM"
            ? { amount: 9900, name: "프리미엄 멤버십", tier: "PREMIUM" }
            : { amount: 4900, name: "베이직 멤버십", tier: "BASIC" };

    // 🟢 토스페이먼츠 API 인증
    const secretKey = process.env.TOSS_SECRET_KEY || "test_sk_kYG57Eba3GPBnNXMe5d5VpWDOxmA";
    const authHeader = Buffer.from(`${secretKey}:`).toString("base64");

    // 🟢 주문 ID 생성
    const orderId = `renew_${currentTier.toLowerCase()}_${userId}_${Date.now()}`;
    const customerKey = `user_${userId}`;

    // 🟢 빌링키로 자동결제 요청
    const billingPaymentResponse = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/json",
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

    // 🟢 결제 성공 시 DB 업데이트
    const now = new Date();
    const newExpiresAt = new Date(now);
    newExpiresAt.setDate(newExpiresAt.getDate() + 30); // 30일 연장

    await prisma.$transaction(async (tx: any) => {
        // 결제 기록 생성
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

        // 구독 기간 연장
        await tx.user.update({
            where: { id: userId },
            data: {
                subscriptionTier: planInfo.tier,
                subscriptionExpiresAt: newExpiresAt,
                isAutoRenewal: true, // 자동갱신 유지
            },
        });
    });

    console.log(
        `[구독 자동갱신 성공] User ${userId}: ${planInfo.name} 갱신 완료 (만료일: ${newExpiresAt.toISOString()})`
    );
}
