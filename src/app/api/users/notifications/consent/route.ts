import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const userId = resolveUserId(req);
        if (!userId) {
            return NextResponse.json({ error: "인증 실패" }, { status: 401 });
        }

        const { topics } = await req.json(); // 예: ["COURSE", "NEW_ESCAPE"]

        if (!Array.isArray(topics) || topics.length === 0) {
            return NextResponse.json({ error: "최소 하나의 주제를 선택해주세요" }, { status: 400 });
        }

        // 🟢 트랜잭션으로 한꺼번에 처리 (하나라도 실패하면 취소)
        await prisma.$transaction(async (tx) => {
            // 1. 대문 열기: 전체 알림 활성화
            // PushToken이 없을 수도 있으므로 upsert 사용
            await (tx as any).pushToken.upsert({
                where: { userId },
                update: {
                    subscribed: true,
                    alarmEnabledAt: new Date(),
                },
                create: {
                    userId,
                    token: "", // 모달에서 동의만 받는 경우 토큰은 나중에 등록
                    platform: "web",
                    subscribed: true,
                    alarmEnabledAt: new Date(),
                },
            });

            // 2. 개별 관심사 등록: 선택한 모든 주제를 DB에 저장
            for (const topic of topics) {
                await (tx as any).notificationInterest.upsert({
                    where: {
                        userId_topic: {
                            userId,
                            topic,
                        },
                    },
                    update: {}, // 이미 있으면 업데이트할 내용 없음
                    create: {
                        userId,
                        topic,
                    },
                });
            }

            // 3. 법적 기록 및 다시 안 뜨게 설정
            await tx.user.update({
                where: { id: userId },
                data: {
                    hasSeenConsentModal: true,
                    isMarketingAgreed: true,
                    marketingAgreedAt: new Date(),
                },
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("알림 동의 처리 실패:", error);
        return NextResponse.json({ error: "처리 실패" }, { status: 500 });
    }
}

