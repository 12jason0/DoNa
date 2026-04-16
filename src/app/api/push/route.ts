import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth"; // 🔐 서버 세션 검증 유틸
import { captureApiError } from "@/lib/sentry";

// GET: 현재 알림 상태 조회
export async function GET(req: NextRequest) {
    try {
        // 🟢 [보안] URL 쿼리 대신 서버 쿠키에서 userId를 안전하게 추출
        const userIdNum = await resolveUserId(req);

        if (!userIdNum) {
            return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
        }

        // 🟢 성능 최적화: 병렬 쿼리로 2030이 원하는 속도 구현 [cite: 2025-12-14]
        const [pushToken, user] = await Promise.all([
            prisma.pushToken.findUnique({
                where: { userId: userIdNum },
                select: { subscribed: true },
            }),
            prisma.user.findUnique({
                where: { id: userIdNum },
                select: { isMarketingAgreed: true },
            }),
        ]);

        return NextResponse.json({
            subscribed: pushToken?.subscribed ?? false,
            isMarketingAgreed: user?.isMarketingAgreed ?? false,
            canReceiveNotifications: (pushToken?.subscribed ?? false) && (user?.isMarketingAgreed ?? false),
        });
    } catch (error) {
            captureApiError(error);
        console.error("조회 실패:", error);
        return NextResponse.json({ error: "조회 중 오류 발생" }, { status: 500 });
    }
}

// POST: 푸시 토큰 등록 및 상태 변경
export async function POST(req: NextRequest) {
    try {
        // 🟢 [보안] 바디에서 userId를 받지 않고 세션에서 가져옴
        const userIdNum = await resolveUserId(req);
        if (!userIdNum) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

        const { pushToken, platform, subscribed } = await req.json();

        // 🟢 성능 최적화: 병렬 쿼리로 빠른 응답
        const [existingToken, user] = await Promise.all([
            prisma.pushToken.findUnique({
            where: { userId: userIdNum },
            }),
            prisma.user.findUnique({
            where: { id: userIdNum },
            select: { isMarketingAgreed: true },
            }),
        ]);

        // 토큰 검증 로직
        const hasValidPushToken = pushToken && typeof pushToken === "string" && pushToken.trim() !== "";
        if (!hasValidPushToken && !existingToken) {
            return NextResponse.json({ error: "pushToken이 필요합니다." }, { status: 400 });
        }

        const shouldAutoEnable =
            !existingToken && hasValidPushToken && typeof subscribed !== "boolean" && user?.isMarketingAgreed === true;

        const updateData: any = { updatedAt: new Date() };
        if (hasValidPushToken) updateData.token = pushToken;
        if (platform) updateData.platform = platform;

        // 알림 설정 변경 시 법적 동의 날짜 기록 및 유저 정보 업데이트
        const userUpdatePromise = typeof subscribed === "boolean"
            ? subscribed
                ? prisma.user.update({
                      where: { id: userIdNum },
                      data: { isMarketingAgreed: true, marketingAgreedAt: new Date() },
                  })
                : // 🟢 알림을 끌 때 BenefitConsentModal이 다시 나타나도록 설정
                  prisma.user.update({
                      where: { id: userIdNum },
                      data: { hasSeenConsentModal: false },
                  })
            : Promise.resolve(null);

        if (typeof subscribed === "boolean") {
            updateData.subscribed = subscribed;
            if (subscribed) {
                updateData.alarmEnabledAt = new Date();
            } else {
                updateData.alarmDisabledAt = new Date();
            }
        } else if (shouldAutoEnable) {
            updateData.subscribed = true;
            updateData.alarmEnabledAt = new Date();
        }

        // 같은 토큰을 가진 다른 userId 레코드 삭제 (중복 알림 방지)
        if (hasValidPushToken) {
            await prisma.pushToken.deleteMany({
                where: {
                    token: pushToken,
                    userId: { not: userIdNum },
                },
            });
        }

        // 🟢 성능 최적화: user.update와 pushToken.upsert를 병렬로 처리
        await Promise.all([
            userUpdatePromise,
            prisma.pushToken.upsert({
            where: { userId: userIdNum },
            update: updateData,
            create: {
                userId: userIdNum,
                token: pushToken || "",
                platform: platform || "expo",
                subscribed: updateData.subscribed ?? false,
                alarmEnabledAt: updateData.alarmEnabledAt,
            },
            }),
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
            captureApiError(error);
        return NextResponse.json({ error: "저장 실패" }, { status: 500 });
    }
}
