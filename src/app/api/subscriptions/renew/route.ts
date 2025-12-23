import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { SubscriptionTier } from "@prisma/client";

// 캐싱을 방지하고 항상 최신 데이터를 가져오도록 설정
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * [Vercel Cron Jobs용 API]
 * 매일 정해진 시간에 실행되어 만료 예정 유저의 결제를 처리합니다.
 */
export async function GET(req: NextRequest) {
    try {
        // 1. 보안 검증: 외부인이 주소를 알아내어 강제로 결제를 실행하는 것을 방지합니다.
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET || "default-secret-change-in-production";

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. 날짜 설정: 현재 시간으로부터 24시간(내일) 내에 만료되는 유저를 찾습니다.
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // 3. 대상 유저 조회: 자동갱신이 켜져 있고, 빌링키가 있는 유료 멤버십 유저만 추출합니다.
        const expiringSubscriptions = await prisma.user.findMany({
            where: {
                isAutoRenewal: true,
                billingKey: { not: null },
                subscriptionExpiresAt: {
                    lte: tomorrow, // 내일까지 만료되는 건
                    gte: now, // 아직 만료되지 않은 건
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

        // 4. 개별 결제 루프: 각 유저별로 토스 API를 호출하여 돈을 인출합니다.
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

                // 결제 실패 시(카드 한도 초과 등) 유저 등급을 FREE로 강등하고 자동갱신을 끕니다.
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
 * 실제 토스 결제를 진행하고 DB를 업데이트하는 핵심 함수
 */
async function processSubscriptionRenewal(userId: number, billingKey: string, currentTier: SubscriptionTier) {
    // 1. 상품 정보 설정: 현재 유저의 등급에 맞춰 결제 금액을 결정합니다.
    const planInfo =
        currentTier === "PREMIUM"
            ? { amount: 9900, name: "프리미엄 멤버십", tier: "PREMIUM" }
            : { amount: 4900, name: "베이직 멤버십", tier: "BASIC" };

    // 2. 토스 API 인증 정보 준비
    const secretKey = process.env.TOSS_SECRET_KEY || "test_sk_kYG57Eba3GPBnNXMe5d5VpWDOxmA";
    const authHeader = Buffer.from(`${secretKey}:`).toString("base64");

    // 3. 고유 주문번호(orderId) 생성: 이 번호는 결제 시마다 항상 고유해야 합니다.
    const orderId = `renew_${currentTier.toLowerCase()}_${userId}_${Date.now()}`;
    const customerKey = `user_${userId}`;

    // 4. 토스페이먼츠 자동결제 요청 실행
    const billingPaymentResponse = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/json",
            // ⭐ 멱등키 적용: 네트워크 문제로 중복 요청이 가더라도 토스 서버가 돈을 중복 인출하지 않게 보호합니다.
            "Idempotency-Key": orderId,
        },
        body: JSON.stringify({
            customerKey: customerKey,
            amount: planInfo.amount,
            orderId: orderId,
            orderName: `${planInfo.name} 자동갱신`,
        }),
    });

    const billingPaymentData = await billingPaymentResponse.json();

    // 토스 서버에서 에러를 보냈을 경우 중단하고 catch 블록으로 넘깁니다.
    if (!billingPaymentResponse.ok) {
        throw new Error(billingPaymentData.message || "빌링 결제 승인 실패");
    }

    // 5. DB 업데이트: '결제 기록 생성'과 '유저 기간 연장'을 하나의 묶음(Transaction)으로 처리합니다.
    const now = new Date();
    const newExpiresAt = new Date(now);
    newExpiresAt.setDate(newExpiresAt.getDate() + 30); // 구독 기간 30일 연장

    await prisma.$transaction(async (tx: any) => {
        // [작업 A] 결제 이력 테이블에 데이터 기록
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

        // [작업 B] 유저 테이블의 구독 만료일 업데이트
        await tx.user.update({
            where: { id: userId },
            data: {
                subscriptionTier: planInfo.tier,
                subscriptionExpiresAt: newExpiresAt,
                isAutoRenewal: true,
            },
        });
        // 트랜잭션 덕분에 A와 B 중 하나라도 실패하면 전체 작업이 취소되어 데이터 꼬임을 방지합니다.
    });

    console.log(
        `[구독 자동갱신 성공] User ${userId}: ${planInfo.name} 갱신 완료 (만료일: ${newExpiresAt.toISOString()})`
    );
}
