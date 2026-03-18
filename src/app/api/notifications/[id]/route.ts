import { NextRequest, NextResponse } from "next/server";
import { captureApiError } from "@/lib/sentry";
export const dynamic = "force-dynamic";
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // 실제로는 데이터베이스에서 특정 알림을 삭제
        console.log(`Deleting notification ${id}`);

        return NextResponse.json({
            success: true,
            message: `Notification ${id} deleted`,
        });
    } catch {
        console.error("Failed to delete notification");
        return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
    }
}
