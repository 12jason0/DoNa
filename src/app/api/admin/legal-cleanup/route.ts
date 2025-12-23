import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * [법적 필수] 보관 기간 경과 후 데이터 자동 삭제 스케줄러
 * 
 * 보관 기간:
 * - LoginLog: 통신비밀보호법에 따라 3개월 보관 후 삭제
 * - Payment: 전자상거래법에 따라 5년 보관 후 삭제
 * 
 * 이 API는 Vercel Cron Jobs로 주기적으로 호출됩니다.
 * 예: 매일 자정에 실행
 */
export async function POST(request: NextRequest) {
    try {
        // 보안: API 키 확인 (Vercel Cron은 자동으로 호출하지만, 수동 호출 방지)
        const authHeader = request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET || "default-secret-change-in-production";
        
        // Vercel Cron은 자동으로 호출하지만, 수동 호출 시 API 키 확인
        if (authHeader !== `Bearer ${cronSecret}`) {
            // Vercel Cron에서 호출하는 경우 헤더가 없을 수 있으므로, 환경 변수로 확인
            const isVercelCron = request.headers.get("x-vercel-cron") === "1";
            if (!isVercelCron) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const now = new Date();
        
        // 1. LoginLog 삭제 (3개월 이상 된 데이터)
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        const deletedLoginLogs = await prisma.loginLog.deleteMany({
            where: {
                loginAt: {
                    lt: threeMonthsAgo,
                },
            },
        });

        // 2. Payment 삭제 (5년 이상 된 데이터)
        const fiveYearsAgo = new Date(now);
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
        
        const deletedPayments = await prisma.payment.deleteMany({
            where: {
                approvedAt: {
                    lt: fiveYearsAgo,
                },
            },
        });

        // 3. (선택사항) 탈퇴한 사용자의 Payment/LoginLog 중 보관 기간 경과한 것 삭제
        // deletedAt이 설정된 사용자의 경우, 탈퇴일 기준으로 보관 기간 계산
        const deletedUsersWithOldData = await prisma.user.findMany({
            where: {
                deletedAt: {
                    not: null,
                    lt: fiveYearsAgo, // 5년 이상 전에 탈퇴한 사용자
                },
            },
            select: {
                id: true,
            },
        });

        let deletedOldUserPayments = 0;
        let deletedOldUserLoginLogs = 0;

        for (const user of deletedUsersWithOldData) {
            // 탈퇴한 사용자의 Payment 삭제 (탈퇴일 기준 5년 경과)
            const userPayments = await prisma.payment.deleteMany({
                where: {
                    userId: user.id,
                },
            });
            deletedOldUserPayments += userPayments.count;

            // 탈퇴한 사용자의 LoginLog 삭제 (탈퇴일 기준 3개월 경과)
            const userLoginLogs = await prisma.loginLog.deleteMany({
                where: {
                    userId: user.id,
                },
            });
            deletedOldUserLoginLogs += userLoginLogs.count;
        }

        return NextResponse.json({
            success: true,
            message: "법적 보관 기간 경과 데이터 삭제 완료",
            deleted: {
                loginLogs: deletedLoginLogs.count,
                payments: deletedPayments.count,
                oldUserPayments: deletedOldUserPayments,
                oldUserLoginLogs: deletedOldUserLoginLogs,
            },
            cutoffDates: {
                loginLog: threeMonthsAgo.toISOString(),
                payment: fiveYearsAgo.toISOString(),
            },
        });
    } catch (error: any) {
        console.error("[법적 데이터 정리] 오류:", error);
        return NextResponse.json(
            {
                error: "법적 데이터 정리 중 오류가 발생했습니다.",
                details: error?.message || "알 수 없는 오류",
            },
            { status: 500 }
        );
    }
}

/**
 * 현재 보관 중인 데이터 개수 확인용 GET 엔드포인트
 */
export async function GET(request: NextRequest) {
    try {
        const now = new Date();
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const fiveYearsAgo = new Date(now);
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

        const loginLogsCount = await prisma.loginLog.count({
            where: {
                loginAt: {
                    lt: threeMonthsAgo,
                },
            },
        });

        const paymentsCount = await prisma.payment.count({
            where: {
                approvedAt: {
                    lt: fiveYearsAgo,
                },
            },
        });

        const deletedUsersCount = await prisma.user.count({
            where: {
                deletedAt: {
                    not: null,
                },
            },
        });

        return NextResponse.json({
            status: "ok",
            retention: {
                loginLogs: {
                    total: await prisma.loginLog.count(),
                    expired: loginLogsCount,
                    cutoffDate: threeMonthsAgo.toISOString(),
                    retentionPeriod: "3개월",
                },
                payments: {
                    total: await prisma.payment.count(),
                    expired: paymentsCount,
                    cutoffDate: fiveYearsAgo.toISOString(),
                    retentionPeriod: "5년",
                },
                deletedUsers: deletedUsersCount,
            },
        });
    } catch (error: any) {
        console.error("[법적 데이터 조회] 오류:", error);
        return NextResponse.json(
            {
                error: "법적 데이터 조회 중 오류가 발생했습니다.",
                details: error?.message || "알 수 없는 오류",
            },
            { status: 500 }
        );
    }
}

