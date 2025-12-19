import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * [법적 필수] 6개월 이상 된 LocationLog와 LoginLog 자동 삭제
 * 위치정보법 제16조에 따라 6개월 후에는 삭제해야 합니다.
 *
 * 이 API는 스케줄러(cron)나 배치 작업으로 주기적으로 호출해야 합니다.
 * 예: 매일 자정에 실행
 */
export async function POST(request: NextRequest) {
    try {
        // 보안: 관리자만 실행 가능하도록 인증 추가 (필요시)
        // const authHeader = request.headers.get("authorization");
        // if (authHeader !== `Bearer ${process.env.CLEANUP_API_KEY}`) {
        //     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        // }

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // LocationLog 삭제 (6개월 이상 된 데이터)
        const deletedLocationLogs = await (prisma as any).locationLog.deleteMany({
            where: {
                createdAt: {
                    lt: sixMonthsAgo, // 6개월 이전
                },
            },
        });

        // LoginLog 삭제 (6개월 이상 된 데이터)
        const deletedLoginLogs = await (prisma as any).loginLog.deleteMany({
            where: {
                loginAt: {
                    lt: sixMonthsAgo, // 6개월 이전
                },
            },
        });

        return NextResponse.json({
            success: true,
            message: "6개월 이상 된 로그가 삭제되었습니다.",
            deleted: {
                locationLogs: deletedLocationLogs.count,
                loginLogs: deletedLoginLogs.count,
            },
            cutoffDate: sixMonthsAgo.toISOString(),
        });
    } catch (error) {
        console.error("로그 정리 오류:", error);
        return NextResponse.json(
            {
                error: "로그 정리 중 오류가 발생했습니다.",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

/**
 * 현재 보관 중인 로그 개수 확인용 GET 엔드포인트
 */
export async function GET(request: NextRequest) {
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const [locationLogCount, oldLocationLogCount, loginLogCount, oldLoginLogCount] = await Promise.all([
            (prisma as any).locationLog.count(),
            (prisma as any).locationLog.count({
                where: {
                    createdAt: { lt: sixMonthsAgo },
                },
            }),
            (prisma as any).loginLog.count(),
            (prisma as any).loginLog.count({
                where: {
                    loginAt: { lt: sixMonthsAgo },
                },
            }),
        ]);

        return NextResponse.json({
            locationLogs: {
                total: locationLogCount,
                olderThan6Months: oldLocationLogCount,
                willBeDeleted: oldLocationLogCount,
            },
            loginLogs: {
                total: loginLogCount,
                olderThan6Months: oldLoginLogCount,
                willBeDeleted: oldLoginLogCount,
            },
            cutoffDate: sixMonthsAgo.toISOString(),
        });
    } catch (error) {
        console.error("로그 조회 오류:", error);
        return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }
}
