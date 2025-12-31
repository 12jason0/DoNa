import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyJwtAndGetUserId } from "@/lib/auth";
import { Prisma } from "@prisma/client";

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
        // 🟢 [인증] 쿠키 기반 인증으로 변경
        const cookieStore = await cookies();
        const token = cookieStore.get("auth")?.value;
        if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

        let userId: string;
        try {
            userId = verifyJwtAndGetUserId(token);
        } catch {
            return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });
        }
        const numericUserId = Number(userId);

        // [데이터] 요청에서 주문번호 추출
        const { orderId, cancelReason } = await request.json().catch(() => ({}));

        // 2. 환불 대상 조회 (최근 결제 건)
        const payment = await prisma.payment.findFirst({
            where: {
                userId: numericUserId,
                status: "PAID",
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
        // 🟢 환불은 일반 결제와 빌링 결제 모두 가능하므로, orderName으로 결제 타입 판단
        // 일반 결제(쿠폰): orderName에 "쿠폰" 포함 → TOSS_SECRET_KEY_GENERAL (donaudy2at MID)
        // 빌링 결제(구독): orderName에 "구독" 또는 "멤버십" 포함 → TOSS_SECRET_KEY_BILLING (bill_donaoc44v MID)
        const isBillingPayment = payment.orderName.includes("구독") || payment.orderName.includes("멤버십");
        const secretKey = isBillingPayment ? process.env.TOSS_SECRET_KEY_BILLING : process.env.TOSS_SECRET_KEY_GENERAL;

        if (!secretKey) {
            return NextResponse.json(
                {
                    error: `환불 시크릿 키가 설정되지 않았습니다. (${isBillingPayment ? "빌링" : "일반"} 결제)`,
                },
                { status: 500 }
            );
        }
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
        const updatedUser = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // 결제 상태 변경
            await tx.payment.update({
                where: { id: payment.id },
                data: { status: "CANCELLED" },
            });

            if (isCoupon) {
                // 쿠폰 개수 차감 후 최신 값 반환
                const updated = await tx.user.update({
                    where: { id: numericUserId },
                    data: { couponCount: { decrement: retrieveCount } },
                    select: { couponCount: true },
                });
                return updated;
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
                // 구독 환불 시에도 쿠폰 개수 반환
                const user = await tx.user.findUnique({
                    where: { id: numericUserId },
                    select: { couponCount: true },
                });
                return user;
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

        // 🟢 [수정]: 쿠폰 환불 시 최신 쿠폰 개수 반환
        return NextResponse.json({
            success: true,
            message: "환불 완료",
            ticketsRemaining: updatedUser?.couponCount ?? 0,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
