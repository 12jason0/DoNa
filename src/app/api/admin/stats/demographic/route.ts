import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getExcludedStatsUserIds } from "@/lib/statsExclude";
import { verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

function ensureAdmin(req: NextRequest) {
    if (!verifyAdminJwt(req)) throw new Error("ADMIN_ONLY");
}

export async function GET(request: NextRequest) {
    try {
        // 관리자 권한 확인
        ensureAdmin(request);

        // 쿼리 파라미터에서 연령대와 성별 가져오기
        const ageRange = request.nextUrl.searchParams.get("ageRange");
        const gender = request.nextUrl.searchParams.get("gender");

        // 필수 파라미터 검증
        if (!ageRange || !gender) {
            return NextResponse.json(
                { error: "연령대와 성별을 모두 선택해주세요." },
                { status: 400 }
            );
        }

        // 성별 값 검증
        if (gender !== "M" && gender !== "F") {
            return NextResponse.json(
                { error: "올바른 성별 값을 입력해주세요. (M 또는 F)" },
                { status: 400 }
            );
        }

        // 연령대 값 검증
        const validAgeRanges = ["10대", "20대", "30대", "40대", "50대 이상"];
        if (!validAgeRanges.includes(ageRange)) {
            return NextResponse.json(
                { error: "올바른 연령대를 입력해주세요." },
                { status: 400 }
            );
        }

        const excludedUserIds = await getExcludedStatsUserIds(prisma);

        // 1. 해당 연령대/성별의 사용자 ID 목록 조회 (테스트 계정 제외)
        const targetUsers = await prisma.user.findMany({
            where: {
                ageRange,
                gender,
                deletedAt: null,
                ...(excludedUserIds.length > 0 ? { id: { notIn: excludedUserIds } } : {}),
            },
            select: {
                id: true,
            },
        });

        const userIds = targetUsers.map((u) => u.id);

        if (userIds.length === 0) {
            return NextResponse.json({
                courses: [],
                totalUsers: 0,
                message: "해당 조건에 맞는 사용자가 없습니다.",
            });
        }

        // 2. 해당 사용자들이 본 코스 통계 (조회수 기준)
        const courseStats = await prisma.userInteraction.groupBy({
            by: ["courseId"],
            where: {
                userId: { in: userIds },
                action: "view",
            },
            _count: {
                id: true,
            },
            orderBy: {
                _count: {
                    id: "desc",
                },
            },
            take: 10,
        });

        // 3. 코스 상세 정보 한 번에 조회 (N+1 방지)
        const courseIds = courseStats.map((s) => s.courseId);
        const courseList = await prisma.course.findMany({
            where: { id: { in: courseIds } },
            select: {
                id: true,
                title: true,
                sub_title: true,
                region: true,
                tags: true,
                concept: true,
                duration: true,
                rating: true,
                view_count: true,
                courseTags: {
                    include: {
                        tag: {
                            select: { name: true },
                        },
                    },
                },
            },
        });
        const courseById = new Map(courseList.map((c) => [c.id, c]));

        const validCourses = courseStats
            .map((stat) => {
                const course = courseById.get(stat.courseId);
                if (!course) return null;

                let tagNames: string[] = [];
                if (course.tags && typeof course.tags === "object") {
                    const tagsObj = course.tags as any;
                    if (tagsObj.concept && Array.isArray(tagsObj.concept)) tagNames.push(...tagsObj.concept);
                    if (tagsObj.mood && Array.isArray(tagsObj.mood)) tagNames.push(...tagsObj.mood);
                }
                if (course.courseTags?.length) {
                    course.courseTags.forEach((ct) => {
                        if (ct.tag && !tagNames.includes(ct.tag.name)) tagNames.push(ct.tag.name);
                    });
                }

                return {
                    courseId: course.id,
                    title: course.title,
                    subTitle: course.sub_title,
                    region: course.region || "지역 미지정",
                    tags: tagNames,
                    concept: course.concept || "컨셉 미지정",
                    duration: course.duration || "시간 미지정",
                    rating: course.rating || 0,
                    viewCount: course.view_count || 0,
                    demographicViewCount: stat._count.id,
                };
            })
            .filter((c) => c !== null);

        return NextResponse.json({
            ageRange,
            gender: gender === "M" ? "남성" : "여성",
            totalUsers: userIds.length,
            courses: validCourses,
        });
    } catch (error: any) {

            captureApiError(error);
        if (error.message === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
        }
        console.error("[Admin Demographic Stats API Error]:", error);
        return NextResponse.json(
            { error: "통계 데이터를 불러오는 중 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}

