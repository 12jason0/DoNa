import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// Bearer 토큰 또는 'auth' 쿠키에서 사용자 ID를 가져오는 헬퍼 함수
// 통합 인증 사용

// 로그인한 사용자의 모든 배지를 가져오는 GET 엔드포인트
export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ message: "인증이 필요합니다." }, { status: 401 });
        }

        const userBadges = await prisma.userBadge.findMany({
            where: { user_id: userId },
            orderBy: { awarded_at: "desc" },
            include: {
                badge: true,
            },
        });

        if (userBadges.length === 0) {
            return NextResponse.json([]);
        }

        const result = userBadges
            .filter((userBadge) => userBadge.badge)
            .map((userBadge) => ({
                id: userBadge.badge.id,
                name: userBadge.badge.name,
                image_url: userBadge.badge.image_url ?? null,
                description: userBadge.badge.description ?? null,
                awarded_at: userBadge.awarded_at,
            }));

        return NextResponse.json(result);
    } catch (error: any) {

            captureApiError(error);
        console.error("Badge 조회 실패:", error);
        return NextResponse.json({ message: error?.message || "배지 조회에 실패했습니다." }, { status: 500 });
    }
}

// --- ⬇️ 추가된 부분: 새로운 배지를 수여하는 POST 엔드포인트 ⬇️ ---
export async function POST(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ message: "인증이 필요합니다." }, { status: 401 });
        }

        const { badgeId } = await request.json();
        if (!badgeId) {
            return NextResponse.json({ message: "badgeId가 필요합니다." }, { status: 400 });
        }

        // 이미 해당 배지가 있는지 확인 (중복 방지)
        const existing = await prisma.userBadge.findFirst({
            where: { user_id: userId, badge_id: Number(badgeId) },
        });

        if (existing) {
            return NextResponse.json({ message: "이미 획득한 배지입니다." });
        }

        // 새 배지 추가
        await prisma.userBadge.create({
            data: {
                user_id: userId,
                badge_id: Number(badgeId),
            },
        });

        return NextResponse.json({ success: true, message: "배지가 수여되었습니다." }, { status: 201 });
    } catch (error: any) {

            captureApiError(error);
        console.error("배지 수여 실패:", error);
        return NextResponse.json({ message: error?.message || "배지 수여에 실패했습니다." }, { status: 500 });
    }
}
// --- ⬆️ 여기까지 추가되었습니다 ⬆️ ---
