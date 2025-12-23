import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db"; // ← 이렇게 변경!

// GET: 현재 알림 상태 조회 (알람 설정 + 마케팅 수신 동의 상태 함께 반환)
export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json({ error: "userId가 필요합니다" }, { status: 400 });
        }

        const userIdNum = parseInt(userId);
        
        // 🟢 성능 최적화: 병렬 쿼리로 속도 향상
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
            // 두 조건이 모두 true여야 알림을 받을 수 있음
            canReceiveNotifications: (pushToken?.subscribed ?? false) && (user?.isMarketingAgreed ?? false),
        });
    } catch (error) {
        console.error("푸시 토큰 조회 실패:", error);
        return NextResponse.json({ error: "푸시 토큰 조회 중 오류가 발생했습니다" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { userId, pushToken, platform, subscribed } = await req.json();

        // 필수 값 확인
        if (!userId) {
            return NextResponse.json({ error: "userId가 필요합니다" }, { status: 400 });
        }

        // 기존 토큰 확인
        const existingToken = await prisma.pushToken.findUnique({
            where: { userId: parseInt(userId) },
        });

        // [개선] 회원가입 시 마케팅 동의한 사용자는 푸시 토큰 등록 시 자동으로 알람 켜기
        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) },
            select: { isMarketingAgreed: true },
        });

        // pushToken이 없거나 빈 문자열이고, 기존 토큰도 없으면 에러
        // 단, subscribed 상태만 변경하려는 경우(기존 토큰이 있으면)는 허용
        const hasValidPushToken = pushToken && typeof pushToken === "string" && pushToken.trim() !== "";
        if (!hasValidPushToken && !existingToken) {
            return NextResponse.json(
                { error: "pushToken이 필요합니다. 앱에서 알림 권한을 허용해주세요." },
                { status: 400 }
            );
        }

        // [개선] 새로 토큰을 등록하는 경우, 마케팅 동의한 사용자는 자동으로 subscribed = true
        // subscribed가 명시적으로 전달되지 않았고, 기존 토큰도 없고, 마케팅 동의한 경우
        const shouldAutoEnable =
            !existingToken && hasValidPushToken && typeof subscribed !== "boolean" && user?.isMarketingAgreed === true;

        // 푸시 토큰 저장 또는 업데이트
        const updateData: any = {
            updatedAt: new Date(),
        };
        // pushToken이 유효한 경우에만 업데이트 (빈 문자열이 아닐 때만)
        if (hasValidPushToken) {
            updateData.token = pushToken;
        }
        if (platform) updateData.platform = platform || "expo";

        // subscribed 상태가 변경될 때 시간 기록
        if (typeof subscribed === "boolean" && existingToken) {
            const currentSubscribed = existingToken.subscribed;
            // 상태가 변경되었을 때만 시간 기록 (이전 기록은 유지)
            if (currentSubscribed !== subscribed) {
                if (subscribed === true) {
                    // 알람 켜기: 가장 최근에 켠 시간만 업데이트
                    updateData.alarmEnabledAt = new Date();
                    // alarmDisabledAt은 유지 (이전에 끈 시간 보존)

                    // [법적 필수] 알람을 켤 때 마케팅 수신 동의도 함께 처리
                    // 사용자가 알림을 받겠다는 의사표시로 간주
                    await prisma.user.update({
                        where: { id: parseInt(userId) },
                        data: {
                            isMarketingAgreed: true,
                            marketingAgreedAt: new Date(),
                        },
                    });
                } else {
                    // 알람 끄기: 가장 최근에 끈 시간만 업데이트
                    updateData.alarmDisabledAt = new Date();
                    // alarmEnabledAt은 유지 (이전에 켠 시간 보존)
                    // ⚠️ 마케팅 수신 동의는 유지 (사용자가 명시적으로 철회하지 않는 한)
                }
            }
            updateData.subscribed = subscribed;
        } else if (typeof subscribed === "boolean") {
            updateData.subscribed = subscribed;

            // 새로 생성할 때 알람을 켠다면 마케팅 수신 동의도 함께 처리
            if (subscribed === true) {
                await prisma.user.update({
                    where: { id: parseInt(userId) },
                    data: {
                        isMarketingAgreed: true,
                        marketingAgreedAt: new Date(),
                    },
                });
            }
        } else if (shouldAutoEnable) {
            // [개선] 회원가입 시 마케팅 동의한 사용자는 푸시 토큰 등록 시 자동으로 알람 켜기
            updateData.subscribed = true;
            updateData.alarmEnabledAt = new Date();
        }

        const createData: any = {
            userId: parseInt(userId),
            token: hasValidPushToken ? pushToken : existingToken?.token || "",
            platform: platform || "expo",
        };
        if (typeof subscribed === "boolean") {
            createData.subscribed = subscribed;
            // 새로 생성할 때도 시간 기록
            if (subscribed === true) {
                createData.alarmEnabledAt = new Date();
                // [법적 필수] 알람을 켤 때 마케팅 수신 동의도 함께 처리
                // (이미 위에서 처리했지만, create 시에도 동일하게 처리)
            } else {
                createData.alarmDisabledAt = new Date();
            }
        } else if (shouldAutoEnable) {
            // [개선] 회원가입 시 마케팅 동의한 사용자는 푸시 토큰 등록 시 자동으로 알람 켜기
            createData.subscribed = true;
            createData.alarmEnabledAt = new Date();
        } else {
            // 마케팅 동의 안 한 사용자는 기본적으로 알람 꺼짐
            createData.subscribed = false;
        }

        const savedToken = await prisma.pushToken.upsert({
            where: { userId: parseInt(userId) },
            update: updateData,
            create: createData,
        });

        console.log("푸시 토큰 저장 성공:", savedToken);

        return NextResponse.json({
            success: true,
            message: "푸시 토큰이 저장되었습니다",
        });
    } catch (error) {
        console.error("푸시 토큰 저장 실패:", error);
        return NextResponse.json({ error: "푸시 토큰 저장 중 오류가 발생했습니다" }, { status: 500 });
    }
}
