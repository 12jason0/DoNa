import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

function ensureAdmin(req: NextRequest) {
    if (!verifyAdminJwt(req)) throw new Error("ADMIN_ONLY");
}

/**
 * 🟢 관리자 환불 요청 목록 조회
 */
export async function GET(request: NextRequest) {
    try {
        ensureAdmin(request);

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status"); // PENDING, APPROVED, REJECTED

        const where: any = {};
        if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
            where.status = status;
        }

        // 🟢 Prisma Client에서 모델 접근 (RefundRequest -> refundRequest)
        // 테이블이 없을 수 있으므로 안전하게 처리
        let refundRequests: any[] = [];
        try {
            // refundRequest 모델이 존재하는지 먼저 확인
            if ((prisma as any).refundRequest) {
                refundRequests = await (prisma as any).refundRequest.findMany({
                    where,
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                username: true,
                            },
                        },
                        payment: {
                            select: {
                                id: true,
                                paymentKey: true,
                                method: true,
                                approvedAt: true,
                            },
                        },
                    },
                    // 🟢 orderBy 제거: 필드명이 정확하지 않을 수 있으므로 클라이언트에서 정렬
                });
            } else {
                console.warn("[환불 요청] refundRequest 모델이 존재하지 않습니다. 마이그레이션을 실행해주세요.");
            }
        } catch (err: any) {

                captureApiError(err);
            console.error("[환불 요청 조회 Prisma 에러]:", err);
            // 테이블이 없거나 모델이 없는 경우 빈 배열 반환
            if (
                err.code === "P2001" || 
                err.code === "P2025" ||
                err.code === "P1001" ||
                err.message?.includes("does not exist") || 
                err.message?.includes("Unknown model") ||
                err.message?.includes("Cannot find model") ||
                err.message?.includes("Unknown arg") ||
                err.message?.includes("table") ||
                err.message?.includes("doesn't exist")
            ) {
                console.warn("[환불 요청] 테이블이 아직 생성되지 않았습니다. 마이그레이션을 실행해주세요.");
                refundRequests = [];
            } else {
                // 다른 에러는 그대로 throw
                throw err;
            }
        }
        
        // 🟢 클라이언트에서 id 기준 역순 정렬 (최신순)
        if (refundRequests && refundRequests.length > 0) {
            refundRequests.sort((a, b) => (b.id || 0) - (a.id || 0));
        }

        return NextResponse.json({
            success: true,
            refundRequests: refundRequests || [],
        });
    } catch (error: any) {

            captureApiError(error);
        if (error.message === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
        }
        console.error("[관리자 환불 요청 목록 API 오류]:", {
            message: error.message,
            code: error.code,
            stack: error.stack,
            name: error.name,
        });
        return NextResponse.json({ 
            error: error.message || "서버 오류가 발생했습니다.",
            details: process.env.NODE_ENV === "development" ? error.stack : undefined,
        }, { status: 500 });
    }
}
