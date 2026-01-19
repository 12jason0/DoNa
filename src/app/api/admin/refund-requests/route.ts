import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// 관리자 인증 체크 헬퍼 함수
function ensureAdmin(req: NextRequest) {
    const ok = req.cookies.get("admin_auth")?.value === "true";
    if (!ok) throw new Error("ADMIN_ONLY");
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
        const refundRequests = await (prisma as any).refundRequest.findMany({
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
            orderBy: {
                requestedAt: "desc",
            },
        }).catch((err: any) => {
            console.error("[환불 요청 조회 Prisma 에러]:", err);
            // 테이블이 없거나 모델이 없는 경우 빈 배열 반환
            if (err.code === "P2001" || err.message?.includes("does not exist") || err.message?.includes("Unknown model")) {
                console.warn("[환불 요청] 테이블이 아직 생성되지 않았습니다. 마이그레이션을 실행해주세요.");
                return [];
            }
            throw err;
        });

        return NextResponse.json({
            success: true,
            refundRequests: refundRequests || [],
        });
    } catch (error: any) {
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
