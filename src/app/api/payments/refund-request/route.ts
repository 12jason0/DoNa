import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

async function sendSlackMessage(text: string) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;
    try {
        await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });
    } catch {}
}

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
            where: { id: paymentId, userId, status: "PAID" },
            include: { user: { select: { email: true, username: true } } },
        });

        if (!payment) {
            return NextResponse.json({ error: "유효하지 않은 결제입니다." }, { status: 404 });
        }

        await sendSlackMessage(
            `🔴 *환불 신청*\n` +
            `• 유저: ${payment.user?.username ?? payment.user?.email ?? userId} (ID: ${userId})\n` +
            `• 상품: ${payment.orderName}\n` +
            `• 금액: ${payment.amount.toLocaleString()}원\n` +
            `• 결제일: ${payment.approvedAt?.toLocaleDateString("ko-KR") ?? "-"}\n` +
            `• 사유: ${reason}\n` +
            `• 결제 ID: ${payment.id}`
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        captureApiError(error);
        console.error("[환불 신청 오류]:", error);
        return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
    }
}
