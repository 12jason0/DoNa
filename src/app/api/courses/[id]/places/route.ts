import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
export const dynamic = "force-dynamic";

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

        const formatted = cps.map((cp: any) => ({
            id: cp.id,
            course_id: cp.course_id,
            place_id: cp.place_id,
            order_index: cp.order_index,
            estimated_duration: cp.estimated_duration,
            recommended_time: cp.recommended_time,
            coaching_tip: cp.coaching_tip || null,
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
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const { id: courseIdParam } = await params;
        const course_id = Number(courseIdParam);
        const body = await request.json();
        const { place_id, order_index, estimated_duration, recommended_time, coaching_tip } = body || {};

        if (!course_id || !place_id || !order_index) {
            return NextResponse.json({ error: "course_id, place_id, order_index는 필수입니다." }, { status: 400 });
        }

        // 생성
        const created = await (prisma as any).coursePlace.create({
            data: {
                course_id,
                place_id: Number(place_id),
                order_index: Number(order_index),
                estimated_duration: typeof estimated_duration === "number" ? estimated_duration : null,
                recommended_time: recommended_time || null,
                coaching_tip: coaching_tip || null,
            },
        });

        return NextResponse.json({ success: true, course_place: created }, { status: 201 });
    } catch (error) {
        console.error("API: 코스-장소 연결 생성 오류:", error);
        return NextResponse.json({ error: "코스-장소 연결 생성 실패" }, { status: 500 });
    }
}
