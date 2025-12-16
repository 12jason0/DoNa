import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db"; // ← 이렇게 변경!

// GET: 현재 알림 상태 조회
export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json({ error: "userId가 필요합니다" }, { status: 400 });
        }

        const pushToken = await prisma.pushToken.findUnique({
            where: { userId: parseInt(userId) },
            select: { subscribed: true },
        });

        return NextResponse.json({
            subscribed: pushToken?.subscribed ?? false,
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

        // pushToken이 없고 기존 토큰도 없으면 에러
        if (!pushToken && !existingToken) {
            return NextResponse.json(
                { error: "pushToken이 필요합니다. 앱에서 알림 권한을 허용해주세요." },
                { status: 400 }
            );
        }

        // 푸시 토큰 저장 또는 업데이트
        const updateData: any = {
            updatedAt: new Date(),
        };
        if (pushToken) updateData.token = pushToken;
        if (platform) updateData.platform = platform || "expo";
        if (typeof subscribed === "boolean") updateData.subscribed = subscribed;

        const createData: any = {
            userId: parseInt(userId),
            token: pushToken || existingToken?.token || "",
            platform: platform || "expo",
        };
        if (typeof subscribed === "boolean") createData.subscribed = subscribed;

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
