import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyJwtAndGetUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * 🟢 구독권 환불 요청 API
 * 사용자가 구독권 환불을 요청하면 관리자가 승인할 수 있도록 요청을 저장합니다.
 */
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

        const { orderId, cancelReason } = await request.json().catch(() => ({}));

        if (!orderId) {
            return NextResponse.json({ error: "orderId가 필요합니다." }, { status: 400 });
        }

        // 환불 대상 조회
        const payment = await prisma.payment.findFirst({
            where: {
                userId: numericUserId,
                orderId: orderId,
                status: "PAID",
            },
            include: { user: true },
        });

        if (!payment) {
            return NextResponse.json({ error: "환불 가능한 결제 내역이 없습니다." }, { status: 404 });
        }

        // 구독권인지 확인
        const isSubscription = payment.orderName.includes("구독") || payment.orderName.includes("멤버십") || payment.orderName.includes("프리미엄");
        if (!isSubscription) {
            return NextResponse.json({ error: "구독권만 환불 요청이 가능합니다. 쿠폰은 즉시 환불이 가능합니다." }, { status: 400 });
        }

        // 이미 환불 요청이 있거나 환불된 경우
        if (payment.status === "CANCELLED") {
            return NextResponse.json({ error: "이미 환불 처리된 결제입니다." }, { status: 400 });
        }

        // 이미 환불 요청이 있는지 확인
        let existingRequest = null;
        try {
            existingRequest = await (prisma as any).refundRequest.findUnique({
                where: { paymentId: payment.id },
            });
        } catch (err: any) {
            // 테이블이 없는 경우 에러 로깅 후 계속 진행 (마이그레이션 필요)
            if (err.code === "P2001" || err.message?.includes("does not exist") || err.message?.includes("Unknown model")) {
                console.error("[환불 요청] refund_requests 테이블이 아직 생성되지 않았습니다. 마이그레이션을 실행해주세요:", err);
                return NextResponse.json({ 
                    error: "환불 요청 기능을 사용할 수 없습니다. 관리자에게 문의해주세요.",
                    code: "MIGRATION_REQUIRED",
                }, { status: 503 });
            }
            throw err;
        }

        if (existingRequest) {
            if (existingRequest.status === "PENDING") {
                return NextResponse.json({ error: "이미 환불 요청이 접수되었습니다. 관리자 검토 중입니다." }, { status: 400 });
            }
            if (existingRequest.status === "APPROVED" || existingRequest.status === "REJECTED") {
                return NextResponse.json({ error: "이미 처리된 환불 요청입니다." }, { status: 400 });
            }
        }

        // 🟢 환불 요청 저장
        try {
            await (prisma as any).refundRequest.create({
                data: {
                    paymentId: payment.id,
                    userId: numericUserId,
                    orderId: payment.orderId,
                    orderName: payment.orderName,
                    amount: payment.amount,
                    cancelReason: cancelReason || "고객 요청 환불",
                    status: "PENDING",
                },
            });
        } catch (err: any) {
            if (err.code === "P2001" || err.message?.includes("does not exist") || err.message?.includes("Unknown model")) {
                console.error("[환불 요청] refund_requests 테이블이 아직 생성되지 않았습니다. 마이그레이션을 실행해주세요:", err);
                return NextResponse.json({ 
                    error: "환불 요청 기능을 사용할 수 없습니다. 관리자에게 문의해주세요.",
                    code: "MIGRATION_REQUIRED",
                }, { status: 503 });
            }
            throw err;
        }

        return NextResponse.json({
            success: true,
            message: "환불 요청이 접수되었습니다. 관리자 검토 후 처리됩니다.",
            orderId: orderId,
        });
    } catch (error: any) {
        console.error("[환불 요청 API 오류]:", error);
        return NextResponse.json({ error: error.message || "환불 요청 처리 중 오류가 발생했습니다." }, { status: 500 });
    }
}
