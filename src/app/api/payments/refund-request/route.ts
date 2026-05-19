import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const userId = await resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const body = await request.json();
        const { paymentId, reason } = body;

        if (!paymentId || !reason?.trim()) {
            return NextResponse.json({ error: "결제 ID와 환불 사유를 입력해주세요." }, { status: 400 });
        }

        const payment = await prisma.payment.findFirst({
            where: { id: paymentId, userId },
        });

        if (!payment) {
            return NextResponse.json({ error: "유효하지 않은 결제입니다." }, { status: 404 });
        }

        // 이미 환불 신청된 경우 중복 방지
        const existing = await (prisma as any).refundRequest.findFirst({
            where: { paymentId, userId, status: { not: "REJECTED" } },
        });
        if (existing) {
            return NextResponse.json({ error: "이미 환불 신청된 결제입니다." }, { status: 409 });
        }

        // 유저 현재 구독 정보 저장 (거부 시 복구용)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { subscriptionTier: true, subscriptionExpiresAt: true },
        });

        await (prisma as any).refundRequest.create({
            data: {
                paymentId: payment.id,
                userId,
                orderId: payment.orderId,
                orderName: payment.orderName,
                amount: payment.amount,
                cancelReason: reason.trim(),
                status: "PENDING",
                originalSubscriptionTier: user?.subscriptionTier ?? null,
                originalSubscriptionExpiresAt: user?.subscriptionExpiresAt ?? null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        captureApiError(error);
        console.error("[환불 신청 오류]:", error);
        return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
    }
}
