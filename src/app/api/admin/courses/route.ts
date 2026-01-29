import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// 관리자 인증 체크 헬퍼 함수
function ensureAdmin(req: NextRequest) {
    const ok = req.cookies.get("admin_auth")?.value === "true";
    if (!ok) {
        throw new Error("ADMIN_ONLY");
    }
}

// Budget 파싱 헬퍼 함수
function parseBudget(budgetString: string | undefined) {
    if (!budgetString) return null;

    // "3~6만원" 형식 파싱
    const match = budgetString.match(/(\d+)~(\d+)만원?/);
    if (match) {
        const min = parseInt(match[1]) * 10000;
        const max = parseInt(match[2]) * 10000;

        // budget_level 자동 계산 (1인 기준)
        let level = "low";
        const avg = (min + max) / 2;
        if (avg >= 50000) level = "high";
        else if (avg >= 30000) level = "mid";

        return { min, max, range: budgetString, level };
    }

    // "5만원" 단일 값 형식
    const singleMatch = budgetString.match(/(\d+)만원?/);
    if (singleMatch) {
        const value = parseInt(singleMatch[1]) * 10000;
        let level = "low";
        if (value >= 50000) level = "high";
        else if (value >= 30000) level = "mid";

        return { min: value, max: value, range: budgetString, level };
    }

    return null;
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

        const formattedCourses = courses.map((course: any) => {
            // 🔥 Admin UI 호환성: 컬럼 데이터를 tags 형식으로 변환
            const tagsForAdmin = {
                ...(course.tags || {}),
                mood: course.mood || [],
                goal: course.goal || undefined,
                budget: course.budget_range || undefined,
            };

            return {
                ...course,
                placesCount: course.coursePlaces.length,
                // 프론트엔드 코드(formData.places)와 이름을 맞추려면 아래처럼 매핑해줘도 좋습니다.
                // 하지만 프론트에서 coursePlaces를 쓴다면 그대로 두셔도 됩니다.
                places: course.coursePlaces,
                // Admin UI가 기대하는 tags 형식으로 변환
                tags: tagsForAdmin,
            };
        });

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
            region,
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

        // 🟢 [Fix]: region 또는 location 둘 다 처리 (프론트엔드는 region을 보냄)
        const regionValue = region !== undefined ? region : location;

        // 🔥 tags 객체에서 컬럼으로 변환
        let moodValue: string[] = [];
        let goalValue: string | null = null;
        let budgetData = null;

        if (tags && typeof tags === "object") {
            // tags.mood → mood 컬럼 (배열)
            if (Array.isArray(tags.mood)) {
                moodValue = tags.mood;
            }

            // tags.goal → goal 컬럼 (문자열)
            if (typeof tags.goal === "string") {
                goalValue = tags.goal;
            }

            // tags.budget → budget_min, budget_max, budget_level, budget_range
            if (typeof tags.budget === "string") {
                budgetData = parseBudget(tags.budget);
            }
        }

        const created = await (prisma as any).course.create({
            data: {
                title: title || "",
                description: description || "",
                duration: duration || "",
                region: regionValue || "",
                imageUrl: imageUrl || "",
                concept: concept || "",
                sub_title: sub_title || "",
                target_situation: target_situation || "",
                is_editor_pick: is_editor_pick || false,
                grade: grade || "FREE",
                isPublic: isPublic ?? true,

                // 🔥 새 컬럼에 저장
                mood: moodValue,
                goal: goalValue,
                budget_min: budgetData?.min || null,
                budget_max: budgetData?.max || null,
                budget_range: budgetData?.range || null,
                budget_level: budgetData?.level || null,

                // tags는 나머지 정보만 저장 (선택적)
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
