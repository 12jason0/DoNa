import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/sentry";
export const dynamic = "force-dynamic";
export async function PUT() {
    try {
        // 실제로는 데이터베이스에서 모든 알림을 읽음 처리
        console.log("Marking all notifications as read");

        return NextResponse.json({
            success: true,
            message: "All notifications marked as read",
        });
    } catch (error) {
            captureApiError(error);
        console.error("Failed to mark all notifications as read:", error);
        return NextResponse.json({ error: "Failed to mark all notifications as read" }, { status: 500 });
    }
}
