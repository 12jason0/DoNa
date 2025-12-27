import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveUserId } from "@/lib/auth"; // 🟢 12.24 개편된 보안 세션 유틸 사용

export const dynamic = "force-dynamic";

/**
 * 사용자의 결제 내역 조회 API
 */
export async function GET(request: NextRequest) {
    try {
        // 1. 인증 확인 (Bearer 토큰 대신 보안 쿠키 세션 사용)
        // 🟢 [보안] 클라이언트가 보낸 토큰을 신뢰하지 않고 서버 세션에서 직접 ID를 추출합니다.
        const numericUserId = await resolveUserId(request);

        if (!numericUserId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        // 2. 결제 내역 조회 (기존 로직 100% 유지)
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

        // 3. 데이터 반환 (기존 매핑 로직 100% 유지)
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
