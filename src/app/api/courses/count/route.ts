import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const concept = searchParams.get("concept");

        // ✅ [수정됨] prisma.courses -> prisma.course
        const count = await prisma.course.count({
            where: {
                ...(concept ? { concept } : {}),
            },
        });

        return NextResponse.json({ count });
    } catch (error) {

            captureApiError(error);
        return NextResponse.json({ error: "Failed to fetch course count" }, { status: 500 });
    }
}
