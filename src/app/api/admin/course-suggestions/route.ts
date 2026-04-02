import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

function ensureAdmin(req: NextRequest) {
    if (!verifyAdminJwt(req)) throw new Error("ADMIN_ONLY");
}

export async function GET(req: NextRequest) {
    try {
        ensureAdmin(req);

        const suggestions = await (prisma as any).courseSuggestion.findMany({
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
                id: true,
                placeName: true,
                placeAddress: true,
                description: true,
                concept: true,
                imageUrl: true,
                status: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        nickname: true,
                        email: true,
                    },
                },
                course: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
        });

        return NextResponse.json({ suggestions });
    } catch (error: any) {
        captureApiError(error);
        if (error.message === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
        }
        console.error("/api/admin/course-suggestions GET error:", error);
        return NextResponse.json({ error: "제보 목록 조회 실패" }, { status: 500 });
    }
}

