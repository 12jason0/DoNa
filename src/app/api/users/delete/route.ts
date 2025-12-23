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

        // 사용자 삭제 (Cascade로 관련 데이터도 함께 삭제됨)
        // Prisma 스키마에서 onDelete: Cascade로 설정된 관계 데이터들이 자동으로 삭제됩니다.
        await prisma.user.delete({
            where: { id: userId },
        });

        // 로그인 로그는 별도로 삭제 (Cascade가 없을 수 있음)
        try {
            await prisma.loginLog.deleteMany({
                where: { userId: userId },
            });
        } catch (error) {
            console.error("로그인 로그 삭제 실패:", error);
            // 로그 삭제 실패해도 계정 삭제는 계속 진행
        }

        return NextResponse.json({
            success: true,
            message: "계정이 성공적으로 삭제되었습니다.",
        });
    } catch (error) {
        console.error("계정 삭제 오류:", error);
        return NextResponse.json(
            {
                error: "계정 삭제 중 오류가 발생했습니다.",
                details: error instanceof Error ? error.message : "알 수 없는 오류",
            },
            { status: 500 }
        );
    }
}

