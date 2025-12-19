import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const { userId, title, body, data } = await req.json();

        // 1. 필수 값 확인
        if (!userId || !title || !body) {
            return NextResponse.json({ error: "userId, title, body가 필요합니다" }, { status: 400 });
        }

        // 2. DB에서 해당 유저의 푸시 토큰 가져오기
        const pushToken = await prisma.pushToken.findUnique({
            where: {
                userId: parseInt(userId),
            },
        });

        if (!pushToken) {
            return NextResponse.json({ error: "푸시 토큰이 없습니다. 앱에서 토큰을 등록해주세요." }, { status: 404 });
        }

        // 3. 구독 취소한 유저는 건너뛰기
        if (pushToken.subscribed === false) {
            return NextResponse.json({
                success: false,
                message: "알림 수신을 거부한 사용자입니다",
            });
        }

        // [법적 필수] 마케팅 수신 동의 확인 (정보통신망법 준수)
        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) },
            select: { isMarketingAgreed: true },
        });

        if (!user || !user.isMarketingAgreed) {
            return NextResponse.json({
                success: false,
                message: "마케팅 수신 동의가 필요한 알림입니다",
            });
        }

        // 4. Expo Push Notification 메시지 구성
        const message = {
            to: pushToken.token,
            sound: "default",
            title: title,
            body: body,
            data: data || {},
            badge: 1,
        };

        console.log("푸시 알림 전송:", message);

        // 5. Expo Push API 헤더 생성 (Access Token 포함)
        const headers: Record<string, string> = {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
        };

        // Access Token이 있으면 헤더에 추가 (선택사항)
        const accessToken = process.env.EXPO_ACCESS_TOKEN;
        if (accessToken) {
            headers.Authorization = `Bearer ${accessToken}`;
        }

        // 6. Expo Push API로 전송
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers,
            body: JSON.stringify(message),
        });

        const result = await response.json();

        // 7. 결과 확인 (단건/배열 모두 대응)
        const payload = result?.data;
        const first = Array.isArray(payload) ? payload[0] : payload;

        if (first?.status === "ok") {
            console.log("✅ 푸시 알림 전송 성공:", result);
            return NextResponse.json({
                success: true,
                message: "알림이 전송되었습니다",
                result,
            });
        } else if (first?.status === "error") {
            // 토큰이 유효하지 않은 경우
            const details = first?.details;
            if (details?.error === "DeviceNotRegistered") {
                // DB에서 토큰 삭제
                await prisma.pushToken.delete({
                    where: { userId: parseInt(userId) },
                });
                console.log("❌ 유효하지 않은 토큰 삭제됨");
            }

            return NextResponse.json(
                {
                    error: "알림 전송 실패",
                    details: first?.message,
                },
                { status: 400 }
            );
        } else {
            console.error("❌ 푸시 알림 전송 실패:", result);
            return NextResponse.json({ error: "알림 전송 실패", result }, { status: 500 });
        }
    } catch (error) {
        console.error("푸시 알림 에러:", error);
        return NextResponse.json({ error: "서버 오류" }, { status: 500 });
    }
}
