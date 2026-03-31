import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

function ensureAdmin(req: NextRequest) {
    if (!verifyAdminJwt(req)) throw new Error("ADMIN_ONLY");
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

function buildTargetSituationFromTags(tags: unknown): string {
    if (!tags || typeof tags !== "object") return "";
    const target = (tags as { target?: unknown }).target;
    if (!Array.isArray(target)) return "";
    return target.map((v) => String(v).trim()).filter(Boolean).join(", ");
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }, // Next.js 15+ 에서는 params가 Promise일 수 있음
) {
    try {
        const { id } = await params;
        const courseId = parseInt(id);

        // 코스 기본 정보 + 장소 목록(Place 정보 포함)을 한 번에 조회
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: {
                coursePlaces: {
                    orderBy: { order_index: "asc" }, // 순서대로 정렬
                    include: {
                        place: true, // 장소 상세 정보(이름, 좌표 등) 포함
                    },
                },
            },
        });

        if (!course) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        // 🔥 Admin UI 호환성: 컬럼 데이터를 tags 형식으로 변환
        const courseAny = course as any;
        const tagsForAdmin = {
            ...(courseAny.tags || {}),
            mood: courseAny.mood || [],
            target: courseAny.target || [],
            goal: courseAny.goal || undefined,
            budget: courseAny.budget_range || undefined,
        };

        // 프론트엔드 편의를 위해 데이터 구조 정리 (선택 사항)
        const formattedCourse = {
            ...courseAny,
            // 프론트엔드 formData.places가 기대하는 형태는 coursePlaces 배열 그대로입니다.
            // 필요하다면 여기서 필드명을 places로 바꿔서 보내도 됩니다.
            places: courseAny.coursePlaces,
            // Admin UI가 기대하는 tags 형식으로 변환
            tags: tagsForAdmin,
        };

        return NextResponse.json(formattedCourse);
    } catch (error) {

            captureApiError(error);
        console.error("코스 상세 조회 실패:", error);
        return NextResponse.json({ error: "Failed to fetch course" }, { status: 500 });
    }
}

// 🟢 코스 수정 API (관리자 전용)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // 관리자 인증 체크
        ensureAdmin(req);

        const { id } = await params;
        const courseId = parseInt(id);

        if (!courseId || isNaN(courseId)) {
            return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
        }

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
            isSelectionType,
            tags,
        } = body || {};

        // 🟢 [Fix]: region 또는 location 둘 다 처리 (프론트엔드는 region을 보냄)
        const regionValue = region !== undefined ? region : location;

        // 🔥 tags 객체에서 컬럼으로 변환 (tags가 있을 때만)
        const targetSituation = buildTargetSituationFromTags(tags);
        const updateData: any = {
            ...(title !== undefined ? { title } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(duration !== undefined ? { duration } : {}),
            ...(regionValue !== undefined ? { region: regionValue } : {}),
            ...(imageUrl !== undefined ? { imageUrl } : {}),
            ...(concept !== undefined ? { concept } : {}),
            ...(sub_title !== undefined ? { sub_title } : {}),
            ...(target_situation !== undefined || targetSituation ? { target_situation: targetSituation || target_situation } : {}),
            ...(target_situation !== undefined || targetSituation ? { target_audience: targetSituation || null } : {}),
            ...(is_editor_pick !== undefined ? { is_editor_pick } : {}),
            ...(grade !== undefined ? { grade } : {}),
            ...(isPublic !== undefined ? { isPublic } : {}),
            ...(isSelectionType !== undefined ? { isSelectionType } : {}),
            ...(tags !== undefined ? { tags } : {}),
        };

        // 🔥 tags가 있으면 컬럼으로 변환
        if (tags !== undefined && typeof tags === "object") {
            // tags.mood → mood 컬럼 (배열)
            if (Array.isArray(tags.mood)) {
                updateData.mood = tags.mood;
            }

            // tags.target → target 컬럼 (배열)
            if (Array.isArray(tags.target)) {
                updateData.target = tags.target;
            }

            // tags.goal → goal 컬럼 (문자열)
            if (typeof tags.goal === "string") {
                updateData.goal = tags.goal;
            }

            // tags.budget → budget_min, budget_max, budget_level, budget_range
            if (typeof tags.budget === "string") {
                const budgetData = parseBudget(tags.budget);
                if (budgetData) {
                    updateData.budget_min = budgetData.min;
                    updateData.budget_max = budgetData.max;
                    updateData.budget_range = budgetData.range;
                    updateData.budget_level = budgetData.level;
                }
            }
        }

        const updated = await prisma.course.update({
            where: { id: courseId },
            data: updateData,
            select: {
                id: true,
                title: true,
                description: true,
                duration: true,
                region: true,
                imageUrl: true,
                concept: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({ success: true, course: updated });
    } catch (error: any) {

            captureApiError(error);
        if (error.message === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
        }
        console.error("API: 코스 수정 오류:", error);
        return NextResponse.json({ error: "코스 수정 실패" }, { status: 500 });
    }
}
