import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// 관리자 인증 체크 헬퍼 함수
function ensureAdmin(req: NextRequest) {
    const ok = req.cookies.get("admin_auth")?.value === "true";
    if (!ok) throw new Error("ADMIN_ONLY");
}

/**
 * 🟢 관리자 환불 처리 (승인/거부)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        ensureAdmin(request);

        const { id } = await params;
        const refundRequestId = Number(id);

        if (!refundRequestId || isNaN(refundRequestId)) {
            return NextResponse.json({ error: "유효하지 않은 환불 요청 ID입니다." }, { status: 400 });
        }

        const { action, adminNote } = await request.json().catch(() => ({}));

        if (!action || !["APPROVE", "REJECT"].includes(action)) {
            return NextResponse.json({ error: "action은 APPROVE 또는 REJECT여야 합니다." }, { status: 400 });
        }

        // 환불 요청 조회
        const refundRequest = await (prisma as any).refundRequest.findUnique({
            where: { id: refundRequestId },
            include: {
                user: true,
                payment: true,
            },
        });

        if (!refundRequest) {
            return NextResponse.json({ error: "환불 요청을 찾을 수 없습니다." }, { status: 404 });
        }

        if (refundRequest.status !== "PENDING") {
            return NextResponse.json({ error: "이미 처리된 환불 요청입니다." }, { status: 400 });
        }

        // 거부 처리
        if (action === "REJECT") {
            const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                // 1. 환불 요청 상태 변경
                const updatedRequest = await (tx as any).refundRequest.update({
                    where: { id: refundRequestId },
                    data: {
                        status: "REJECTED",
                        adminNote: adminNote || "관리자 거부",
                        processedAt: new Date(),
                    },
                });

                // 2. 원래 멤버십으로 복구 (남은 기간 계산)
                const originalTier = updatedRequest.originalSubscriptionTier;
                const originalExpiresAt = updatedRequest.originalSubscriptionExpiresAt 
                    ? new Date(updatedRequest.originalSubscriptionExpiresAt)
                    : null;

                if (originalTier && originalTier !== "FREE") {
                    const now = new Date();
                    
                    // 원래 만료일이 있고 현재보다 미래라면 원래 멤버십으로 복구
                    if (originalExpiresAt && originalExpiresAt > now) {
                        await tx.user.update({
                            where: { id: refundRequest.userId },
                            data: {
                                subscriptionTier: originalTier,
                                subscriptionExpiresAt: originalExpiresAt,
                            },
                        });
                    } else if (originalExpiresAt && originalExpiresAt <= now) {
                        // 원래 만료일이 지났지만, 환불 요청 시점부터 원래 만료일까지의 남은 기간 계산
                        // 환불 요청일을 알기 위해 createdAt 사용 (환불 요청이 생성된 시점)
                        const requestCreatedAt = updatedRequest.createdAt 
                            ? new Date(updatedRequest.createdAt)
                            : now;
                        
                        // 환불 요청 시점부터 원래 만료일까지의 남은 기간 계산
                        const remainingDays = Math.floor((originalExpiresAt.getTime() - requestCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
                        
                        if (remainingDays > 0) {
                            // 남은 기간이 있으면 원래 멤버십 복구 (현재 시점 + 남은 기간)
                            const newExpiresAt = new Date(now.getTime() + remainingDays * 24 * 60 * 60 * 1000);
                            await tx.user.update({
                                where: { id: refundRequest.userId },
                                data: {
                                    subscriptionTier: originalTier,
                                    subscriptionExpiresAt: newExpiresAt,
                                },
                            });
                        }
                    }
                }

                return { success: true };
            });

            return NextResponse.json({
                success: true,
                message: "환불 요청이 거부되었습니다. 원래 멤버십으로 복구되었습니다.",
            });
        }

        // 승인 처리 (실제 환불 진행)
        if (action === "APPROVE") {
            const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                // 1. 환불 요청 상태 변경
                await (tx as any).refundRequest.update({
                    where: { id: refundRequestId },
                    data: {
                        status: "APPROVED",
                        adminNote: adminNote || "관리자 승인",
                        processedAt: new Date(),
                    },
                });

                // 2. 토스페이먼츠 환불 요청 (웹 결제인 경우만)
                const payment = refundRequest.payment;
                if (payment.method !== "IN_APP" && payment.paymentKey) {
                    const secretKey = process.env.TOSS_SECRET_KEY_GENERAL;

                    if (!secretKey) {
                        throw new Error("환불 시크릿 키가 설정되지 않았습니다.");
                    }

                    const authHeader = Buffer.from(`${secretKey}:`).toString("base64");

                    const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/${payment.paymentKey}/cancel`, {
                        method: "POST",
                        headers: {
                            Authorization: `Basic ${authHeader}`,
                            "Content-Type": "application/json",
                            "Idempotency-Key": `admin_refund_${payment.orderId}`,
                        },
                        body: JSON.stringify({
                            cancelReason: adminNote || "관리자 승인 환불",
                            cancelAmount: payment.amount,
                        }),
                    });

                    if (!tossRes.ok) {
                        const tossError = await tossRes.json().catch(() => ({}));
                        throw new Error(`토스 API 환불 실패: ${tossError?.message || "알 수 없는 오류"}`);
                    }
                }

                // 3. 결제 상태 변경
                await tx.payment.update({
                    where: { id: payment.id },
                    data: { status: "CANCELLED" },
                });

                // 4. 사용자 혜택 회수
                const isSubscription = payment.orderName.includes("구독") || payment.orderName.includes("멤버십");

                if (isSubscription) {
                    // 구독 등급 강등
                    await tx.user.update({
                        where: { id: refundRequest.userId },
                        data: {
                            subscriptionTier: "FREE",
                            subscriptionExpiresAt: null,
                            isAutoRenewal: false,
                        },
                    });
                }

                return { success: true };
            });

            return NextResponse.json({
                success: true,
                message: "환불이 완료되었습니다.",
            });
        }

        return NextResponse.json({ error: "알 수 없는 액션입니다." }, { status: 400 });
    } catch (error: any) {
        if (error.message === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
        }
        console.error("[관리자 환불 처리 API 오류]:", error);
        return NextResponse.json({ error: error.message || "서버 오류가 발생했습니다." }, { status: 500 });
    }
}
