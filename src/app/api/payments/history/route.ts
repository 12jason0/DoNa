import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractBearerToken, verifyJwtAndGetUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * 사용자의 결제 내역 조회 API
 */
export async function GET(request: NextRequest) {
    try {
        // 인증 확인
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

        // 결제 내역 조회 (최신순)
        const payments = await prisma.payment.findMany({
            where: {
                userId: numericUserId,
            },
            orderBy: {
                approvedAt: "desc",
            },
            select: {
                id: true,
                orderId: true,
                orderName: true,
                amount: true,
                status: true,
                paymentKey: true,
                method: true,
                approvedAt: true,
                requestedAt: true,
            },
        });

        return NextResponse.json({
            success: true,
            payments: payments.map((p) => ({
                id: p.id,
                orderId: p.orderId,
                orderName: p.orderName,
                amount: p.amount,
                status: p.status,
                paymentKey: p.paymentKey,
                method: p.method,
                approvedAt: p.approvedAt?.toISOString() || p.requestedAt.toISOString(),
            })),
        });
    } catch (error: any) {
        console.error("결제 내역 조회 오류:", error);
        return NextResponse.json(
            { error: "결제 내역을 불러오는 중 오류가 발생했습니다.", details: error?.message },
            { status: 500 }
        );
    }
}
