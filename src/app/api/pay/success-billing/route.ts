import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
// 사용자님이 언급한 세션 검증 함수 (예시 경로)
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        // 🔴 [401 에러 해결 핵심] 서버 세션 검증
        // 토스에서 리다이렉트될 때 쿠키가 함께 와야 합니다.
        const sessionUserId = await resolveUserId(req);

        if (!sessionUserId) {
            return NextResponse.json(
                { success: false, error: "unauthorized", message: "로그인이 필요합니다." },
                { status: 401 } // 여기서 401이 발생함
            );
        }

        const { searchParams } = new URL(req.url);
        const customerKey = searchParams.get("customerKey");
        const authKey = searchParams.get("authKey");
        const planId = searchParams.get("planId");

        // 1. 필수 파라미터 확인
        if (!customerKey || !authKey) {
            return NextResponse.json(
                { success: false, error: "missing_params", message: "필수 파라미터가 누락되었습니다." },
                { status: 400 }
            );
        }

        // 2. 사용자 ID 검증 (고객 키와 세션 ID 대조)
        const userIdStr = customerKey.replace("user_", "");
        const userId = Number(userIdStr);

        if (userId !== sessionUserId) {
            return NextResponse.json(
                { success: false, error: "forbidden", message: "권한이 없습니다." },
                { status: 403 }
            );
        }

        // 3. 빌링키 발급 요청 (이후 로직은 사용자님 코드와 동일)
        const secretKey = process.env.TOSS_SECRET_KEY_BILLING;
        if (!secretKey) {
            return NextResponse.json(
                { success: false, error: "MISSING_SECRET_KEY", message: "시크릿 키 설정 누락" },
                { status: 500 }
            );
        }

        const authHeader = Buffer.from(`${secretKey}:`).toString("base64");
        const response = await fetch("https://api.tosspayments.com/v1/billing/authorizations/issue", {
            method: "POST",
            headers: {
                Authorization: `Basic ${authHeader}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ authKey, customerKey }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "빌링키 발급 실패");

        const billingKey = data.billingKey;

        // 4. 첫 결제 승인 요청 (금액 설정 로직 포함)
        const planInfo =
            planId === "sub_premium"
                ? { amount: 9900, name: "프리미엄 멤버십", tier: "PREMIUM" }
                : { amount: 4900, name: "베이직 멤버십", tier: "BASIC" };

        const orderId = `billing_${planId}_${userId}_${Date.now()}`;
        const billingPaymentResponse = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${authHeader}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                customerKey,
                amount: planInfo.amount,
                orderId,
                orderName: planInfo.name,
            }),
        });

        const billingPaymentData = await billingPaymentResponse.json();
        if (!billingPaymentResponse.ok) throw new Error(billingPaymentData.message || "결제 승인 실패");

        // 5. DB 업데이트 (Prisma 트랜잭션 유지)
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + 30);

        await prisma.$transaction(async (tx) => {
            await tx.payment.create({
                data: {
                    orderId,
                    userId,
                    orderName: planInfo.name,
                    amount: planInfo.amount,
                    status: "PAID",
                    paymentKey: billingPaymentData.paymentKey,
                    method: billingPaymentData.method || "CARD",
                    approvedAt: new Date(billingPaymentData.approvedAt || now),
                },
            });

            await tx.user.update({
                where: { id: userId },
                data: {
                    billingKey,
                    subscriptionTier: planInfo.tier as any,
                    subscriptionExpiresAt: expiresAt,
                    isAutoRenewal: true,
                },
            });
        });

        return NextResponse.json({ success: true, message: "구독 결제 완료" });
    } catch (error: any) {
        console.error("[Billing Error]", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
