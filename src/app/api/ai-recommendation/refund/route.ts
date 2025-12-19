import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractBearerToken, verifyJwtAndGetUserId } from "@/lib/auth";
import { PaymentStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// PLAN_DATA와 동일한 구조 (쿠폰 개수 매핑)
const COUPON_PLAN_MAPPING: Record<string, number> = {
    "AI 추천 쿠폰 3개 (Light)": 3,
    "AI 추천 쿠폰 5개 (Standard)": 5,
    "AI 추천 쿠폰 10개 (Pro)": 10,
};

/**
 * 쿠폰 환불 API
 * - 사용자의 최근 쿠폰 결제 내역을 찾아 환불 처리
 * - 토스페이먼츠 환불 API 호출
 * - DB에서 쿠폰 개수 차감 및 결제 상태 변경
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 인증 확인
        const token = extractBearerToken(request);
        if (!token) {
            return NextResponse.json({ error: "인증 토큰이 필요합니다." }, { status: 401 });
        }

        let userId: string;
        try {
            userId = verifyJwtAndGetUserId(token);
        } catch {
            return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });
        }

        const numericUserId = Number(userId);
        if (!Number.isFinite(numericUserId)) {
            return NextResponse.json({ error: "유효하지 않은 사용자 ID입니다." }, { status: 400 });
        }

        // 2. 환불 가능한 최근 쿠폰 결제 내역 조회
        const refundablePayment = await prisma.payment.findFirst({
            where: {
                userId: numericUserId,
                status: PaymentStatus.PAID,
                paymentKey: { not: null },
                orderName: {
                    contains: "쿠폰", // 쿠폰 결제만 환불 가능
                },
            },
            orderBy: {
                approvedAt: "desc", // 최근 결제부터
            },
        });

        if (!refundablePayment) {
            return NextResponse.json({ error: "환불 가능한 쿠폰 결제 내역이 없습니다." }, { status: 404 });
        }

        if (!refundablePayment.paymentKey) {
            return NextResponse.json({ error: "결제 정보가 올바르지 않습니다. (paymentKey 없음)" }, { status: 400 });
        }

        // 3. 쿠폰 개수 추출 (orderName에서)
        const couponCount = COUPON_PLAN_MAPPING[refundablePayment.orderName] || null;
        if (!couponCount) {
            return NextResponse.json({ error: "환불할 쿠폰 개수를 확인할 수 없습니다." }, { status: 400 });
        }

        // 4. 현재 사용자의 쿠폰 개수 확인
        const currentUser = await prisma.user.findUnique({
            where: { id: numericUserId },
            select: { couponCount: true },
        });

        if (!currentUser) {
            return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
        }

        // 5. 환불 가능 여부 확인: 현재 쿠폰 개수가 구매한 쿠폰 개수 이상이어야 함
        if (currentUser.couponCount < couponCount) {
            return NextResponse.json(
                {
                    error: "쿠폰을 사용하여 환불할 수 없습니다.",
                    message: `구매하신 쿠폰 ${couponCount}개 중 일부를 사용하셨습니다. 환불하려면 구매한 쿠폰 개수(${couponCount}개)만큼 보유하고 있어야 합니다.`,
                    currentCoupons: currentUser.couponCount,
                    requiredCoupons: couponCount,
                },
                { status: 400 }
            );
        }

        // 6. 토스페이먼츠 환불 API 호출
        // ✅ API 개별 연동 키 사용: test_sk_... (API 개별 연동용 시크릿 키)
        const secretKey = "test_sk_50WRapdA8djeE7eMOeQAVo1zEqZK";

        const authHeader = Buffer.from(`${secretKey}:`).toString("base64");
        const cancelRes = await fetch(
            `https://api.tosspayments.com/v1/payments/${refundablePayment.paymentKey}/cancel`,
            {
                method: "POST",
                headers: {
                    Authorization: `Basic ${authHeader}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    cancelReason: "고객 요청에 의한 환불",
                    cancelAmount: refundablePayment.amount,
                }),
                cache: "no-store",
            }
        );

        const cancelData = await cancelRes.json().catch(() => ({}));

        if (!cancelRes.ok) {
            console.error("토스페이먼츠 환불 API 오류:", cancelData);
            return NextResponse.json(
                {
                    error: "환불 처리 중 오류가 발생했습니다.",
                    details: cancelData?.message || "UNKNOWN_ERROR",
                },
                { status: 400 }
            );
        }

        // 5. DB 트랜잭션: 쿠폰 개수 차감 및 결제 상태 변경
        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // 결제 상태를 CANCELLED로 변경
            await tx.payment.update({
                where: { id: refundablePayment.id },
                data: { status: PaymentStatus.CANCELLED },
            });

            // 쿠폰 개수 차감 (원자적 연산)
            const updatedUser = await tx.user.update({
                where: { id: numericUserId },
                data: {
                    couponCount: { decrement: couponCount },
                },
                select: { couponCount: true },
            });

            return updatedUser;
        });

        // 8. 성공 응답
        return NextResponse.json({
            success: true,
            message: "환불이 완료되었습니다.",
            refundedCoupons: couponCount,
            ticketsRemaining: Math.max(0, result.couponCount), // 음수 방지
            paymentId: refundablePayment.id,
            refundAmount: refundablePayment.amount,
        });
    } catch (error: any) {
        console.error("쿠폰 환불 API 오류:", error);
        return NextResponse.json(
            { error: "환불 처리 중 오류가 발생했습니다.", details: error?.message || "UNKNOWN_ERROR" },
            { status: 500 }
        );
    }
}
