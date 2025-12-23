import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { extractBearerToken, verifyJwtAndGetUserId } from "@/lib/auth";
import { PaymentStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// 1. 쿠폰 상품 이름과 개수 매핑 (사장님의 플랜과 일치해야 합니다)
const COUPON_PLAN_MAPPING: Record<string, number> = {
    "AI 추천 쿠폰 3개 (Light)": 3,
    "AI 추천 쿠폰 5개 (Standard)": 5,
    "AI 추천 쿠폰 10개 (Pro)": 10,
};

/**
 * 슬랙 알림 전송 함수
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
        console.error("슬랙 알림 실패:", err);
    }
}

export async function POST(request: NextRequest) {
    try {
        // [인증] 토큰 확인
        const token = extractBearerToken(request);
        if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        const userId = verifyJwtAndGetUserId(token);
        const numericUserId = Number(userId);

        // [데이터] 요청에서 주문번호 추출
        const { orderId, cancelReason } = await request.json().catch(() => ({}));

        // 2. 환불 대상 조회 (최근 결제 건)
        const payment = await prisma.payment.findFirst({
            where: {
                userId: numericUserId,
                status: PaymentStatus.PAID,
                ...(orderId ? { orderId } : {}),
            },
            orderBy: { approvedAt: "desc" },
            include: { user: true },
        });

        if (!payment) return NextResponse.json({ error: "환불 가능한 내역이 없습니다." }, { status: 404 });

        // 3. 상품 종류 판별
        const isCoupon = payment.orderName.includes("쿠폰");
        let retrieveCount = 0;

        if (isCoupon) {
            retrieveCount = COUPON_PLAN_MAPPING[payment.orderName] || 0;
            // 쿠폰을 이미 써버렸다면 환불 불가
            if (payment.user.couponCount < retrieveCount) {
                return NextResponse.json({ error: "이미 쿠폰을 사용하여 환불이 불가합니다." }, { status: 400 });
            }
        }

        // 4. 토스페이먼츠 환불 요청
        const secretKey = process.env.TOSS_SECRET_KEY || "test_sk_kYG57Eba3GPBnNXMe5d5VpWDOxmA";
        const authHeader = Buffer.from(`${secretKey}:`).toString("base64");

        const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/${payment.paymentKey}/cancel`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${authHeader}`,
                "Content-Type": "application/json",
                "Idempotency-Key": `refund_${payment.orderId}`, // 중복 환불 방지
            },
            body: JSON.stringify({
                cancelReason: cancelReason || "고객 요청 환불",
                cancelAmount: payment.amount,
            }),
        });

        if (!tossRes.ok) throw new Error("토스 API 환불 실패");

        // 5. DB 업데이트 (트랜잭션으로 일관성 보장)
        await prisma.$transaction(async (tx) => {
            // 결제 상태 변경
            await tx.payment.update({
                where: { id: payment.id },
                data: { status: PaymentStatus.CANCELLED },
            });

            if (isCoupon) {
                // 쿠폰 개수 차감
                await tx.user.update({
                    where: { id: numericUserId },
                    data: { couponCount: { decrement: retrieveCount } },
                });
            } else {
                // 구독 등급 강등 및 만료 처리
                await tx.user.update({
                    where: { id: numericUserId },
                    data: {
                        subscriptionTier: "FREE",
                        subscriptionExpiresAt: null,
                        isAutoRenewal: false,
                    },
                });
            }
        });

        // 6. 슬랙 알림 발송 (둘 다 옴!)
        const typeEmoji = isCoupon ? "🎟️" : "💰";
        const msg = `
${typeEmoji} *[두나] ${isCoupon ? "쿠폰" : "멤버십"} 환불 완료*
━━━━━━━━━━━━━━━━━━━━
👤 *유저:* ${payment.user.email} (${numericUserId})
📦 *상품:* ${payment.orderName}
💸 *금액:* ${payment.amount.toLocaleString()}원
━━━━━━━━━━━━━━━━━━━━
✨ ${isCoupon ? `쿠폰 ${retrieveCount}개 회수 완료` : "유저 등급 FREE 변경 완료"}
        `;
        await sendSlackMessage(msg);

        return NextResponse.json({ success: true, message: "환불 완료" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
