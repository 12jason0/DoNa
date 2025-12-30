import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const customerKey = searchParams.get("customerKey");
        const authKey = searchParams.get("authKey"); // 토스가 준 인증 키

        // 1. 필수 파라미터 확인
        const planId = searchParams.get("planId"); // "sub_basic" 또는 "sub_premium"
        if (!customerKey || !authKey) {
            return NextResponse.json(
                { success: false, error: "missing_params", message: "필수 파라미터가 누락되었습니다." },
                { status: 400 }
            );
        }

        // 2. 사용자 ID 추출 (customerKey: "user_123" -> 123)
        const userIdStr = customerKey.replace("user_", "");
        const userId = Number(userIdStr);

        if (!userId || !Number.isFinite(userId)) {
            return NextResponse.json(
                { success: false, error: "invalid_user", message: "유효하지 않은 사용자 ID입니다." },
                { status: 400 }
            );
        }

        // 🟢 플랜 정보에 따른 등급 결정
        const targetTier = planId === "sub_premium" ? "PREMIUM" : planId === "sub_basic" ? "BASIC" : "BASIC"; // 기본값 BASIC

        // 3. 토스 API에 authKey를 보내서 '빌링키' 발급 요청
        // 🟢 빌링/구독 결제용 시크릿 키 (환경변수에서 로드)
        const secretKey = process.env.TOSS_SECRET_KEY_BILLING;
        if (!secretKey) {
            return NextResponse.json(
                { success: false, error: "MISSING_SECRET_KEY", message: "빌링 시크릿 키가 설정되지 않았습니다." },
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

        if (!response.ok) {
            console.error("[빌링키 발급 실패]", data);
            return NextResponse.json(
                {
                    success: false,
                    error: "billing_key_failed",
                    message: data.message || "빌링키 발급에 실패했습니다.",
                },
                { status: 400 }
            );
        }

        const billingKey = data.billingKey;

        // 🟢 플랜 정보에 따른 금액 및 상품명 결정
        const planInfo =
            planId === "sub_premium"
                ? { amount: 9900, name: "프리미엄 멤버십", tier: "PREMIUM" }
                : { amount: 4900, name: "베이직 멤버십", tier: "BASIC" };

        // 4. 🟢 빌링키로 첫 결제 승인 요청 (실제 돈이 빠져나가는 단계)
        const orderId = `billing_${planId}_${userId}_${Date.now()}`;
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
                orderName: planInfo.name,
            }),
        });

        const billingPaymentData = await billingPaymentResponse.json();

        if (!billingPaymentResponse.ok) {
            console.error("[빌링 결제 승인 실패]", billingPaymentData);
            // 빌링키는 발급되었으므로 저장하되, 결제는 실패로 처리
            await prisma.user.update({
                where: { id: userId },
                data: { billingKey: billingKey } as any,
            });
            return NextResponse.json(
                {
                    success: false,
                    error: "billing_payment_failed",
                    message: billingPaymentData.message || "첫 결제 승인에 실패했습니다.",
                },
                { status: 400 }
            );
        }

        // 5. 🟢 Prisma로 DB 업데이트 (결제 완료 후 등급 업데이트)
        try {
            const now = new Date();
            // 구독 만료일 계산 (30일 후)
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + 30);

            // 트랜잭션으로 결제 기록 생성 및 유저 등급 업데이트
            await prisma.$transaction(async (tx: any) => {
                // 결제 기록 생성
                await tx.payment.create({
                    data: {
                        orderId: orderId,
                        userId: userId,
                        orderName: planInfo.name,
                        amount: planInfo.amount,
                        status: "PAID",
                        paymentKey: billingPaymentData.paymentKey || billingKey,
                        method: billingPaymentData.method || "CARD",
                        approvedAt: new Date(billingPaymentData.approvedAt || now),
                    },
                });

                // User 테이블에 billingKey 저장 및 등급 업데이트
                await tx.user.update({
                    where: { id: userId },
                    data: {
                        billingKey: billingKey,
                        subscriptionTier: planInfo.tier,
                        subscriptionExpiresAt: expiresAt,
                        isAutoRenewal: true,
                    },
                });

                // PushToken 테이블에 subscribed 업데이트 (알림 활성화)
                await tx.pushToken.upsert({
                    where: { userId },
                    update: {
                        subscribed: true,
                        alarmEnabledAt: new Date(),
                    },
                    create: {
                        userId,
                        token: "",
                        platform: "web",
                        subscribed: true,
                        alarmEnabledAt: new Date(),
                    },
                });
            });
        } catch (dbError) {
            console.error("[DB 업데이트 실패]", dbError);
            return NextResponse.json(
                {
                    success: false,
                    error: "db_update_failed",
                    message: "데이터베이스 업데이트에 실패했습니다.",
                },
                { status: 500 }
            );
        }

        // 6. 성공 응답 반환 (페이지에서 처리)
        return NextResponse.json({
            success: true,
            message: `${planInfo.name} 결제가 완료되었습니다.`,
            billingKey: billingKey,
            paymentKey: billingPaymentData.paymentKey,
            orderId: orderId,
            amount: planInfo.amount,
        });
    } catch (error) {
        console.error("[정기 결제 성공 처리 전체 오류]", error);
        return NextResponse.json(
            {
                success: false,
                error: "server_error",
                message: "서버 오류가 발생했습니다.",
            },
            { status: 500 }
        );
    }
}
