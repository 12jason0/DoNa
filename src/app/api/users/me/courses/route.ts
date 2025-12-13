import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 내 저장된 코스 목록 조회
export async function GET(req: NextRequest) {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const savedCourses = await prisma.savedCourse.findMany({
            where: { userId: Number(userId) },
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
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { courseId } = await req.json();

        if (!courseId) {
            return NextResponse.json({ error: "Course ID is required" }, { status: 400 });
        }

        // 이미 저장되어 있는지 확인
        const existing = await prisma.savedCourse.findUnique({
            where: {
                userId_courseId: {
                    userId: Number(userId),
                    courseId: Number(courseId),
                },
            },
        });

        if (existing) {
            return NextResponse.json({ message: "Already saved", savedCourse: existing });
        }

        const savedCourse = await prisma.savedCourse.create({
            data: {
                userId: Number(userId),
                courseId: Number(courseId),
            },
        });

        return NextResponse.json({ message: "Course saved successfully", savedCourse });
    } catch (error) {
        console.error("Failed to save course:", error);
        return NextResponse.json({ error: "Failed to save course" }, { status: 500 });
    }
}
