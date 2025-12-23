import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
    try {
        // 사용자 인증 확인
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        // 사용자 확인
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, username: true },
        });

        if (!user) {
            return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
        }

        // 트랜잭션으로 사용자 및 관련 데이터 삭제
        // Cascade가 없는 관계나 명시적으로 삭제가 필요한 데이터를 먼저 처리합니다.
        await prisma.$transaction(async (tx) => {
            // 1. 로그인 로그 삭제 (Cascade가 있지만 명시적으로 먼저 삭제)
            await tx.loginLog.deleteMany({
                where: { userId: userId },
            });

            // 2. UserReward 삭제 (onDelete: Cascade가 없을 수 있음)
            await tx.userReward.deleteMany({
                where: { userId: userId },
            });

            // 3. 사용자 삭제 (Cascade로 다른 모든 관련 데이터도 함께 삭제됨)
            await tx.user.delete({
                where: { id: userId },
            });
        });

        return NextResponse.json({
            success: true,
            message: "계정이 성공적으로 삭제되었습니다.",
        });
    } catch (error) {
        console.error("계정 삭제 오류:", error);
        
        // 더 자세한 에러 정보 로깅
        if (error instanceof Error) {
            console.error("에러 메시지:", error.message);
            console.error("에러 스택:", error.stack);
        }
        
        // Prisma 에러인 경우 더 자세한 정보 제공
        if ((error as any).code) {
            console.error("Prisma 에러 코드:", (error as any).code);
            console.error("Prisma 에러 메타:", (error as any).meta);
        }
        
        return NextResponse.json(
            {
                error: "계정 삭제 중 오류가 발생했습니다.",
                details: error instanceof Error ? error.message : "알 수 없는 오류",
            },
            { status: 500 }
        );
    }
}

