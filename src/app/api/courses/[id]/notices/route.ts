import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: courseId } = await params;
        console.log("API: Fetching notices for course ID:", courseId);
        const rows = await (prisma as any).courseNotice.findMany({
            where: { course_id: Number(courseId) },
            orderBy: [{ display_order: "asc" }, { id: "asc" }],
            select: { id: true, notice_text: true, display_order: true },
        });
        console.log("API: Found notices:", rows.length);
        return NextResponse.json(rows);
    } catch (error) {
            captureApiError(error);
        console.error("API: Error fetching notices:", error);
        console.error("API: Error details:", {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : "No stack trace",
        });
        return NextResponse.json(
            {
                error: "Failed to fetch notices",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
