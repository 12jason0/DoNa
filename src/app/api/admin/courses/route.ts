import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// 관리자 인증 체크 헬퍼 함수
function ensureAdmin(req: NextRequest) {
    const ok = req.cookies.get("admin_auth")?.value === "true";
    if (!ok) {
        throw new Error("ADMIN_ONLY");
    }
}

export async function GET() {
    try {
        const courses = await prisma.course.findMany({
            orderBy: {
                createdAt: "desc",
            },
            include: {
                // ✅ 수정된 부분: coursePlaces 안에서 place를 또 include 해야 합니다.
                coursePlaces: {
                    orderBy: {
                        order_index: "asc", // 기왕이면 순서대로 가져오기
                    },
                    include: {
                        place: true, // 👈 핵심! 이걸 해야 장소 이름(name), 카테고리 등을 가져옵니다.
                    },
                },
            },
        });

        const formattedCourses = courses.map((course) => ({
            ...course,
            placesCount: course.coursePlaces.length,
            // 프론트엔드 코드(formData.places)와 이름을 맞추려면 아래처럼 매핑해줘도 좋습니다.
            // 하지만 프론트에서 coursePlaces를 쓴다면 그대로 두셔도 됩니다.
            places: course.coursePlaces,
        }));

        return NextResponse.json(formattedCourses);
    } catch (error: any) {
        if (error.message === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
        }
        console.error("코스 목록 불러오기 실패:", error);
        return NextResponse.json({ error: "코스 목록을 가져오지 못했습니다." }, { status: 500 });
    }
}

// 🟢 코스 생성 API (관리자 전용)
export async function POST(req: NextRequest) {
    try {
        // 관리자 인증 체크
        ensureAdmin(req);

        const body = await req.json().catch(() => ({}));
        const {
            title,
            description,
            duration,
            location,
            imageUrl,
            concept,
            sub_title,
            target_situation,
            is_editor_pick,
            grade,
            isPublic,
            tags,
        } = body || {};

        if (!title) {
            return NextResponse.json({ error: "제목은 필수입니다." }, { status: 400 });
        }

        const created = await prisma.course.create({
            data: {
                title: title || "",
                description: description || "",
                duration: duration || "",
                region: location || "",
                imageUrl: imageUrl || "",
                concept: concept || "",
                sub_title: sub_title || "",
                target_situation: target_situation || "",
                is_editor_pick: is_editor_pick || false,
                grade: grade || "FREE",
                isPublic: isPublic ?? true,
                tags: tags || {},
            },
            select: {
                id: true,
                title: true,
                description: true,
                duration: true,
                region: true,
                imageUrl: true,
                concept: true,
                createdAt: true,
            },
        });

        return NextResponse.json({ success: true, course: created });
    } catch (error: any) {
        if (error.message === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
        }
        console.error("API: 코스 생성 오류:", error);
        return NextResponse.json({ error: "코스 생성 실패" }, { status: 500 });
    }
}
