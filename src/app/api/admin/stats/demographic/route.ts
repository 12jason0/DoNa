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

        // 1. 해당 연령대/성별의 사용자 ID 목록 조회
        const targetUsers = await prisma.user.findMany({
            where: {
                ageRange,
                gender,
                deletedAt: null, // 탈퇴하지 않은 사용자만
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

        // 3. 코스 상세 정보 조회
        const courses = await Promise.all(
            courseStats.map(async (stat) => {
                const course = await prisma.course.findUnique({
                    where: { id: stat.courseId },
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
                                    select: {
                                        name: true,
                                    },
                                },
                            },
                        },
                    },
                });

                if (!course) {
                    return null;
                }

                // 태그 정보 정리 (JSON tags와 courseTags 둘 다 처리)
                let tagNames: string[] = [];
                if (course.tags && typeof course.tags === "object") {
                    const tagsObj = course.tags as any;
                    if (tagsObj.concept && Array.isArray(tagsObj.concept)) {
                        tagNames.push(...tagsObj.concept);
                    }
                    if (tagsObj.mood && Array.isArray(tagsObj.mood)) {
                        tagNames.push(...tagsObj.mood);
                    }
                }
                // courseTags에서도 추가
                if (course.courseTags && course.courseTags.length > 0) {
                    course.courseTags.forEach((ct) => {
                        if (ct.tag && !tagNames.includes(ct.tag.name)) {
                            tagNames.push(ct.tag.name);
                        }
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
                    demographicViewCount: stat._count.id, // 해당 그룹의 조회수
                };
            })
        );

        // null 제거
        const validCourses = courses.filter((c) => c !== null);

        return NextResponse.json({
            ageRange,
            gender: gender === "M" ? "남성" : "여성",
            totalUsers: userIds.length,
            courses: validCourses,
        });
    } catch (error: any) {
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

