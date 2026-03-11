import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth"; // 🟢 쿠키 기반 인증 통일

export const dynamic = "force-dynamic";

// 내 저장된 코스 목록 조회
export async function GET(req: NextRequest) {
    try {
        // 🟢 쿠키 기반 인증: resolveUserId 사용
        const userId = resolveUserId(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const source = searchParams.get("source"); // "ai_recommendation" | null(전체)

        const whereClause: { userId: number; source?: string } = { userId };
        if (source === "ai_recommendation") {
            whereClause.source = "ai_recommendation";
        }

        const savedCourses = await prisma.savedCourse.findMany({
            where: whereClause,
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        imageUrl: true,
                        region: true,
                        concept: true,
                        tags: true,
                        sub_title: true,
                        coursePlaces: {
                            orderBy: { order_index: "asc" },
                            take: 1,
                            select: {
                                place: {
                                    select: { imageUrl: true },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { savedAt: "desc" },
        });

        // 이미지 폴백 처리
        const savedCoursesWithImage = savedCourses.map((item: any) => {
            const course = item.course;
            const firstPlaceImage = course.coursePlaces?.[0]?.place?.imageUrl || null;
            return {
                ...item,
                course: {
                    ...course,
                    imageUrl: course.imageUrl || firstPlaceImage || "",
                    coursePlaces: undefined, // 클라이언트에 불필요한 데이터 제외
                },
            };
        });

        return NextResponse.json({ savedCourses: savedCoursesWithImage });
    } catch (error) {
        console.error("Failed to fetch saved courses:", error);
        return NextResponse.json({ error: "Failed to fetch saved courses" }, { status: 500 });
    }
}

// 코스 저장
export async function POST(req: NextRequest) {
    try {
        // 🟢 쿠키 기반 인증: resolveUserId 사용
        const userId = resolveUserId(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { courseId, source } = await req.json();

        if (!courseId) {
            return NextResponse.json({ error: "Course ID is required" }, { status: 400 });
        }

        const uId = userId;
        const cId = Number(courseId);
        const sourceValue = source === "ai_recommendation" ? "ai_recommendation" : "general";

        // 🟢 [상업적 로직] 트랜잭션으로 저장과 잠금 해제를 동시에 처리
        const result = await prisma.$transaction(async (tx) => {
            // 1. 이미 저장되어 있는지 확인 (SavedCourse에는 userId+courseId 복합 unique 없음 → findFirst 사용)
            const existingSave = await tx.savedCourse.findFirst({
                where: {
                    userId: uId,
                    courseId: cId,
                },
            });

            let savedCourse = existingSave;
            if (!existingSave) {
                savedCourse = await tx.savedCourse.create({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma schema source 컬럼 있으나 타입 동기화 지연 시 우회
                    data: { userId: uId, courseId: cId, source: sourceValue } as any,
                });
                await (tx as any).userInteraction.create({
                    data: { userId: uId, courseId: cId, action: "save" },
                });
            } else if (sourceValue === "ai_recommendation") {
                // 🟢 이미 저장된 코스를 AI 추천에서 다시 선택 시 source를 ai_recommendation으로 갱신
                savedCourse = await tx.savedCourse.update({
                    where: { id: existingSave.id },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma schema source 컬럼 있으나 타입 동기화 지연 시 우회
                    data: { source: "ai_recommendation" } as any,
                });
            }

            // 2. 🟢 CourseUnlock 테이블에 권한 기록 (이미 있으면 무시)
            await (tx as any).courseUnlock.upsert({
                where: {
                    userId_courseId: {
                        userId: uId,
                        courseId: cId,
                    },
                },
                update: {}, // 이미 있다면 업데이트할 내용은 없음
                create: {
                    userId: uId,
                    courseId: cId,
                },
            });

            return savedCourse;
        });
        return NextResponse.json({
            message: "코스가 저장되었으며 권한이 부여되었습니다.",
            savedCourse: result,
        });
    } catch (error) {
        console.error("Failed to save and unlock course:", error);
        return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
    }
}
