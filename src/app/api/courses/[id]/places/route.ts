import { NextRequest, NextResponse } from "next/server";
import { getCourseWarnings } from "@/lib/contentRules";
import prisma from "@/lib/db";
import { resolveUserId, verifyAdminJwt } from "@/lib/auth";
import { getMergedTipsFromRow } from "@/types/tip";
import { captureApiError } from "@/lib/sentry";
import { NO_TIPS, canSeeCourseTips, lockedPlace } from "@/lib/tipAccess";
export const dynamic = "force-dynamic";

// 인증: 유저 JWT 또는 관리자(admin_auth) 허용
async function isAuthenticated(request: NextRequest): Promise<boolean> {
    if (await resolveUserId(request)) return true;
    return verifyAdminJwt(request);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: courseId } = await params;
        console.log("API: Fetching places for course ID:", courseId);
        console.log("API: Course ID type:", typeof courseId);
        console.log("API: Request URL:", request.url);

        const cps = await (prisma as any).coursePlace.findMany({
            where: { course_id: Number(courseId) },
            orderBy: [{ order_index: "asc" }],
            include: {
                place: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        description: true,
                        category: true,
                        avg_cost_range: true,
                        opening_hours: true,
                        phone: true,
                        parking_available: true,
                        latitude: true,
                        longitude: true,
                        imageUrl: true,
                        tags: true,
                    },
                },
            },
        });

        // 팁(모든 언어)은 관리자·열람 권한 있는 사용자만 — 잠긴 유료 코스 팁이 비로그인에게 새던 문제
        const showTips = await canSeeCourseTips(request, Number(courseId));
        // 장소 정보: FREE 코스는 누구나, 유료 코스는 팁과 같은 권한 — 없으면 순서·카테고리만 (/api/courses/{id}와 같은 자리표시)
        const course = await prisma.course.findUnique({ where: { id: Number(courseId) }, select: { grade: true } });
        const showPlaces = showTips || (course?.grade ?? "FREE") === "FREE";
        if (!showPlaces) {
            return NextResponse.json(
                cps.map((cp: any) => ({
                    id: cp.id,
                    course_id: cp.course_id,
                    place_id: null,
                    order_index: cp.order_index,
                    segment: cp.segment ?? null,
                    order_in_segment: cp.order_in_segment ?? null,
                    estimated_duration: null,
                    recommended_time: null,
                    ...NO_TIPS,
                    place: { ...lockedPlace(cp.place?.category), image_url: null, tags: null },
                }))
            );
        }
        const formatted = cps.map((cp: any) => ({
            id: cp.id,
            course_id: cp.course_id,
            place_id: cp.place_id,
            order_index: cp.order_index,
            segment: cp.segment ?? null,
            order_in_segment: cp.order_in_segment ?? null,
            estimated_duration: cp.estimated_duration,
            recommended_time: cp.recommended_time,
            ...(showTips
                ? {
                      tips: getMergedTipsFromRow(cp),
                      tips_en: cp.tips_en ?? null,
                      tips_ja: cp.tips_ja ?? null,
                      tips_zh: cp.tips_zh ?? null,
                  }
                : NO_TIPS),
            place: {
                id: cp.place_id,
                name: cp.place?.name ?? "",
                address: cp.place?.address ?? "",
                description: cp.place?.description ?? "",
                category: cp.place?.category ?? "",
                avg_cost_range: cp.place?.avg_cost_range ?? "",
                opening_hours: cp.place?.opening_hours ?? "",
                phone: cp.place?.phone ?? "",
                parking_available: Boolean(cp.place?.parking_available),
                latitude: cp.place?.latitude ? Number(cp.place.latitude) : null,
                longitude: cp.place?.longitude ? Number(cp.place.longitude) : null,
                image_url: cp.place?.imageUrl ?? "",
            },
        }));

        return NextResponse.json(formatted);
    } catch (error) {
            captureApiError(error);
        console.error("API: Error fetching course places:", error);
        console.error("API: Error details:", {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : "No stack trace",
        });
        return NextResponse.json(
            {
                error: "Failed to fetch course places",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (!await isAuthenticated(request)) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const { id: courseIdParam } = await params;
        const course_id = Number(courseIdParam);
        const body = await request.json();
        const {
            place_id,
            order_index,
            segment,
            order_in_segment,
            estimated_duration,
            recommended_time,
            tips,
            tips_en,
            tips_ja,
            tips_zh,
        } = body || {};

        if (!course_id || !place_id || !order_index) {
            return NextResponse.json({ error: "course_id, place_id, order_index는 필수입니다." }, { status: 400 });
        }

        const created = await (prisma as any).coursePlace.create({
            data: {
                course_id,
                place_id: Number(place_id),
                order_index: Number(order_index),
                segment: segment && String(segment).trim() ? String(segment).trim() : null,
                order_in_segment: order_in_segment !== undefined && order_in_segment !== null ? Number(order_in_segment) : null,
                estimated_duration: typeof estimated_duration === "number" ? estimated_duration : null,
                recommended_time: recommended_time || null,
                tips: tips && String(tips).trim() ? String(tips).trim() : null,
                tips_en: tips_en !== undefined && tips_en != null && String(tips_en).trim() ? String(tips_en).trim() : null,
                tips_ja: tips_ja !== undefined && tips_ja != null && String(tips_ja).trim() ? String(tips_ja).trim() : null,
                tips_zh: tips_zh !== undefined && tips_zh != null && String(tips_zh).trim() ? String(tips_zh).trim() : null,
            },
        });

        return NextResponse.json({ success: true, course_place: created, warnings: await getCourseWarnings(prisma, course_id) }, { status: 201 });
    } catch (error) {
            captureApiError(error);
        console.error("API: 코스-장소 연결 생성 오류:", error);
        return NextResponse.json({ error: "코스-장소 연결 생성 실패" }, { status: 500 });
    }
}
