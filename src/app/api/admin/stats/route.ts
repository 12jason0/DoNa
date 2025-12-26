import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 관리자 인증 체크 헬퍼 함수
function ensureAdmin(req: NextRequest) {
    const ok = req.cookies.get("admin_auth")?.value === "true";
    if (!ok) {
        throw new Error("ADMIN_ONLY");
    }
}

export async function GET(request: NextRequest) {
    try {
        // 관리자 권한 확인
        ensureAdmin(request);

        // 1. 인기 코스 TOP 5 데이터 (Bar Chart용)
        // 먼저 courseId별 조회수 집계
        let popularCourses: Array<{
            courseId: number;
            courseTitle: string;
            viewCount: number;
        }> = [];

        try {
            const courseStats = await prisma.userInteraction.groupBy({
                by: ["courseId"],
                where: {
                    action: "view", // 조회 액션만 집계
                },
                _count: {
                    id: true,
                },
                orderBy: {
                    _count: {
                        id: "desc",
                    },
                },
                take: 5,
            });

            // 코스 정보를 가져와서 제목과 함께 반환
            if (courseStats.length > 0) {
                popularCourses = await Promise.all(
                    courseStats.map(async (stat) => {
                        const course = await prisma.course.findUnique({
                            where: { id: stat.courseId },
                            select: {
                                id: true,
                                title: true,
                            },
                        });
                        return {
                            courseId: stat.courseId,
                            courseTitle: course?.title || `코스 #${stat.courseId}`,
                            viewCount: stat._count.id,
                        };
                    })
                );
            }
        } catch (courseError: any) {
            console.warn("[Admin Stats] 인기 코스 조회 실패:", courseError);
            // 에러 발생 시 빈 배열 유지
        }

        // 2. 날짜별 활동량 (Line Chart용) - 최근 7일
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0); // 자정으로 설정

        // 날짜별로 그룹화하기 위해 Raw SQL 사용 (Prisma로는 날짜 그룹화가 어려움)
        let dailyActivityMap = new Map<string, number>();
        try {
            const dailyActivityRaw = await prisma.$queryRaw<
                Array<{ date: Date; count: bigint | number }>
            >`
                SELECT 
                    DATE("created_at") as date,
                    COUNT(*)::integer as count
                FROM "user_interactions"
                WHERE "created_at" >= ${sevenDaysAgo}
                    AND "action" = 'view'
                GROUP BY DATE("created_at")
                ORDER BY date ASC
            `;

            // 빈 날짜를 채우기 위해 최근 7일 배열 생성
            dailyActivityRaw.forEach((item) => {
                const dateStr = new Date(item.date).toISOString().split("T")[0];
                dailyActivityMap.set(dateStr, typeof item.count === 'bigint' ? Number(item.count) : item.count);
            });
        } catch (sqlError: any) {
            console.warn("[Admin Stats] Raw SQL 실패, 대체 방법 사용:", sqlError);
            // Raw SQL 실패 시 Prisma로 전체 데이터를 가져와서 그룹화
            const allInteractions = await prisma.userInteraction.findMany({
                where: {
                    createdAt: { gte: sevenDaysAgo },
                    action: "view",
                },
                select: {
                    createdAt: true,
                },
            });

            allInteractions.forEach((interaction) => {
                const dateStr = new Date(interaction.createdAt).toISOString().split("T")[0];
                dailyActivityMap.set(dateStr, (dailyActivityMap.get(dateStr) || 0) + 1);
            });
        }

        // 최근 7일 배열 생성 (빈 날짜는 0으로)
        const dailyActivity = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            const dateStr = date.toISOString().split("T")[0];
            const month = date.getMonth() + 1;
            const day = date.getDate();
            dailyActivity.push({
                date: dateStr,
                dateLabel: `${month}/${day}`,
                count: dailyActivityMap.get(dateStr) || 0,
            });
        }

        // 3. 연령대별 사용자 통계
        let ageRangeStats: Array<{ ageRange: string; count: number }> = [];
        try {
            const ageRangeData = await prisma.user.groupBy({
                by: ["ageRange"],
                where: {
                    deletedAt: null,
                    ageRange: { not: null },
                },
                _count: {
                    id: true,
                },
            });

            ageRangeStats = ageRangeData.map((item) => ({
                ageRange: item.ageRange || "미입력",
                count: item._count.id,
            })).sort((a, b) => {
                // 연령대 순서 정렬 (10대, 20대, 30대, 40대, 50대 이상, 미입력)
                const order = ["10대", "20대", "30대", "40대", "50대 이상", "미입력"];
                const indexA = order.indexOf(a.ageRange) >= 0 ? order.indexOf(a.ageRange) : 999;
                const indexB = order.indexOf(b.ageRange) >= 0 ? order.indexOf(b.ageRange) : 999;
                return indexA - indexB;
            });
        } catch (ageError: any) {
            console.warn("[Admin Stats] 연령대별 통계 조회 실패:", ageError);
        }

        // 4. 성별별 사용자 통계
        let genderStats: Array<{ gender: string; count: number }> = [];
        try {
            const genderData = await prisma.user.groupBy({
                by: ["gender"],
                where: {
                    deletedAt: null,
                    gender: { not: null },
                },
                _count: {
                    id: true,
                },
            });

            genderStats = genderData.map((item) => ({
                gender: item.gender === "M" ? "남성" : item.gender === "F" ? "여성" : item.gender || "미입력",
                count: item._count.id,
            }));
        } catch (genderError: any) {
            console.warn("[Admin Stats] 성별별 통계 조회 실패:", genderError);
        }

        // 5. 전체 통계 요약
        const totalInteractions = await prisma.userInteraction.count();
        const totalUsers = await prisma.user.count({
            where: {
                deletedAt: null, // 탈퇴하지 않은 사용자만
            },
        });
        const totalCourses = await prisma.course.count({
            where: {
                isPublic: true, // 공개된 코스만
            },
        });

        return NextResponse.json({
            popularCourses,
            dailyActivity,
            ageRangeStats,
            genderStats,
            summary: {
                totalInteractions,
                totalUsers,
                totalCourses,
            },
        });
    } catch (error: any) {
        if (error.message === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
        }
        console.error("[Admin Stats API Error]:", error);
        console.error("[Admin Stats API Error Stack]:", error.stack);
        console.error("[Admin Stats API Error Details]:", {
            message: error.message,
            name: error.name,
            code: error.code,
        });
        return NextResponse.json(
            { 
                error: "통계 데이터를 불러오는 중 오류가 발생했습니다.",
                details: process.env.NODE_ENV === "development" ? error.message : undefined
            },
            { status: 500 }
        );
    }
}

