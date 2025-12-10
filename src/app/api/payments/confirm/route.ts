import { NextRequest, NextResponse } from "next/server";
// 👇 [수정됨] lib/prisma가 아니라 lib/db에서 가져옵니다.
import { prisma } from "@/lib/db";
import { PaymentStatus, SubscriptionTier, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type PlanKey = "ticket_light" | "ticket_standard" | "ticket_pro" | "sub_basic" | "sub_premium";

interface PlanInfo {
    amount: number;
    type: "COUPON" | "SUBSCRIPTION";
    value: number;
    name: string;
    tier?: SubscriptionTier;
}

const PLAN_DATA: Record<PlanKey, PlanInfo> = {
    ticket_light: { amount: 2900, type: "COUPON", value: 3, name: "AI 추천 쿠폰 3개 (Light)" },
    ticket_standard: { amount: 4500, type: "COUPON", value: 5, name: "AI 추천 쿠폰 5개 (Standard)" },
    ticket_pro: { amount: 7900, type: "COUPON", value: 10, name: "AI 추천 쿠폰 10개 (Pro)" },
    sub_basic: {
        amount: 4900,
        type: "SUBSCRIPTION",
        value: 30,
        name: "AI 베이직 구독 (월 4,900원)",
        tier: SubscriptionTier.BASIC,
    },
    sub_premium: {
        amount: 9900,
        type: "SUBSCRIPTION",
        value: 30,
        name: "AI 프리미엄 구독 (월 9,900원)",
        tier: SubscriptionTier.PREMIUM,
    },
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { paymentKey, orderId, amount, plan, userId } = body as {
            paymentKey?: string;
            orderId?: string;
            amount?: number;
            plan?: PlanKey;
            userId?: number | string;
        };

        if (!paymentKey || !orderId || !amount || !plan || !userId || !(plan in PLAN_DATA)) {
            return NextResponse.json({ success: false, error: "INVALID_REQUEST" }, { status: 400 });
        }

        const planInfo = PLAN_DATA[plan];

        if (Number(amount) !== planInfo.amount) {
            return NextResponse.json({ success: false, error: "INVALID_AMOUNT" }, { status: 400 });
        }

        const secretKey = process.env.TOSS_SECRET_KEY;
        if (!secretKey) {
            return NextResponse.json({ success: false, error: "SERVER_NOT_CONFIGURED" }, { status: 500 });
        }

        const authHeader = Buffer.from(`${secretKey}:`).toString("base64");
        const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
            method: "POST",
            headers: {
                Authorization: `Basic ${authHeader}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ paymentKey, orderId, amount }),
            cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            return NextResponse.json(
                { success: false, error: data?.message || "PAYMENT_CONFIRM_FAILED", details: data },
                { status: 400 }
            );
        }

        const numericUserId = Number(userId);

        // 👇 tx 타입을 명시하여 빨간 줄 제거
        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // 결제 기록 생성
            const newPayment = await tx.payment.create({
                data: {
                    orderId: orderId,
                    userId: numericUserId,
                    orderName: planInfo.name,
                    amount: planInfo.amount,
                    status: PaymentStatus.PAID,
                    paymentKey: paymentKey,
                    method: data.method || "CARD",
                    approvedAt: new Date(data.approvedAt) || new Date(),
                },
            });

            // 유저 혜택 지급
            let updatedUser;

            if (planInfo.type === "COUPON") {
                updatedUser = await tx.user.update({
                    where: { id: numericUserId },
                    data: {
                        couponCount: { increment: planInfo.value },
                    },
                });
            } else if (planInfo.type === "SUBSCRIPTION") {
                const currentUser = await tx.user.findUnique({ where: { id: numericUserId } });
                const now = new Date();

                let newExpireDate = now;
                if (currentUser?.subscriptionExpiresAt && currentUser.subscriptionExpiresAt > now) {
                    newExpireDate = new Date(currentUser.subscriptionExpiresAt);
                }
                newExpireDate.setDate(newExpireDate.getDate() + planInfo.value);

                const targetTier = planInfo.tier || SubscriptionTier.BASIC;

                updatedUser = await tx.user.update({
                    where: { id: numericUserId },
                    data: {
                        subscriptionTier: targetTier,
                        subscriptionExpiresAt: newExpireDate,
                        isAutoRenewal: true,
                    },
                });
            }

            return { payment: newPayment, user: updatedUser };
        });

        return NextResponse.json({
            success: true,
            orderId,
            planName: planInfo.name,
            updatedUser: {
                coupons: result.user?.couponCount,
                subscriptionTier: result.user?.subscriptionTier,
                subscriptionExpiresAt: result.user?.subscriptionExpiresAt,
            },
        });
    } catch (e) {
        console.error("Payment Confirm Error:", e);
        return NextResponse.json({ success: false, error: "UNKNOWN_ERROR" }, { status: 500 });
    }
}
