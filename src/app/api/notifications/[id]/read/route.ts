import { NextRequest, NextResponse } from "next/server";
import { captureApiError } from "@/lib/sentry";
export const dynamic = "force-dynamic";
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // 실제로는 데이터베이스에서 특정 알림을 읽음 처리
        console.log(`Marking notification ${id} as read`);

        return NextResponse.json({
            success: true,
            message: `Notification ${id} marked as read`,
        });
    } catch {
        console.error("Failed to mark notification as read");
        return NextResponse.json({ error: "Failed to mark notification as read" }, { status: 500 });
    }
}
