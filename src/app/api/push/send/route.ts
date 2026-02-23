import { NextRequest, NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/push";

export async function POST(req: NextRequest) {
    try {
        const { userId, title, body, data } = await req.json();

        if (!userId || !title || !body) {
            return NextResponse.json({ error: "userId, title, body가 필요합니다" }, { status: 400 });
        }

        const uid = parseInt(String(userId));
        if (Number.isNaN(uid)) {
            return NextResponse.json({ error: "유효한 userId가 필요합니다" }, { status: 400 });
        }

        const result = await sendPushToUser(uid, title, body, data);

        if (result.ok) {
            return NextResponse.json({
                success: true,
                message: "알림이 전송되었습니다",
            });
        }

        if (result.reason === "푸시 토큰 없음") {
            return NextResponse.json({ error: "푸시 토큰이 없습니다. 앱에서 토큰을 등록해주세요." }, { status: 404 });
        }
        if (result.reason === "알림 수신 거부" || result.reason === "마케팅 수신 미동의") {
            return NextResponse.json({ success: false, message: result.reason });
        }
        return NextResponse.json(
            { error: "알림 전송 실패", details: result.reason },
            { status: 400 }
        );
    } catch (error) {
        console.error("푸시 알림 에러:", error);
        return NextResponse.json({ error: "서버 오류" }, { status: 500 });
    }
}
