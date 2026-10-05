import { NextRequest, NextResponse } from "next/server";
import { sendPushNotificationToAll, sendPushNotificationToEveryone, sendPushNotificationToUsers } from "@/lib/push-notifications";
import prisma from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export async function POST(req: NextRequest) {
    try {
        // ✅ 1. 관리자 인증 확인
        if (!verifyAdminJwt(req)) {
            return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
        }

        // ✅ 2. 요청 데이터 받기
        const { title, body, imageUrl, screen, url, target, testEmail } = await req.json();

        if (!title || !body) {
            return NextResponse.json({ error: "제목과 내용을 입력해주세요." }, { status: 400 });
        }

        // ✅ 3. 푸시 발송 (이미지 포함)
        const payload = {
            imageUrl: imageUrl || "",
            screen,
            url,
        } as any;

        // 나에게 테스트 발송
        if (target === "me") {
            const me = testEmail ? await prisma.user.findFirst({ where: { email: String(testEmail).trim() }, select: { id: true } }) : null;
            if (!me) return NextResponse.json({ error: "해당 이메일의 사용자가 없습니다." }, { status: 400 });
            const r = await sendPushNotificationToUsers([me.id], title, body, payload);
            if (!r.sent) return NextResponse.json({ error: "발송 대상 토큰이 없습니다. (앱 로그인·알림 구독·마케팅 수신 동의 확인)" }, { status: 400 });
            return NextResponse.json({ success: true, sent: r.sent, message: `테스트 발송 완료 (기기 ${r.sent}대)` });
        }

        const useAll = target === "all";
        const result = useAll
            ? await sendPushNotificationToEveryone(title, body, payload)
            : await sendPushNotificationToAll(title, body, payload);

        return NextResponse.json({
            success: true,
            sent: result.sent,
            message: `총 ${result.sent}명에게 알림 전송 완료`,
        });
    } catch (err) {

            captureApiError(err);
        console.error("❌ 알림 전송 실패:", err);
        return NextResponse.json({ error: "서버 오류로 알림 전송 실패" }, { status: 500 });
    }
}
