import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// 마이페이지 '구매한 코스' — 열람권으로 연 코스 + 구독 상태
export async function GET(req: NextRequest) {
    try {
        const userId = await resolveUserId(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const [user, unlocks] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: { subscriptionTier: true, subscriptionExpiresAt: true, isAutoRenewal: true },
            }),
            prisma.courseUnlock.findMany({
                where: { userId },
                orderBy: { unlockedAt: "desc" },
                select: {
                    unlockedAt: true,
                    course: {
                        select: {
                            id: true,
                            title: true,
                            title_en: true,
                            title_ja: true,
                            title_zh: true,
                            imageUrl: true,
                            region: true,
                            concept: true,
                            grade: true,
                            coursePlaces: {
                                orderBy: { order_index: "asc" },
                                take: 1,
                                select: { place: { select: { imageUrl: true } } },
                            },
                        },
                    },
                },
            }),
        ]);

        const courses = unlocks
            .map(({ unlockedAt, course: { coursePlaces, ...c } }) => ({
                ...c,
                imageUrl: c.imageUrl || coursePlaces[0]?.place?.imageUrl || "",
                unlockedAt,
            }));

        return NextResponse.json({
            courses,
            subscription: {
                tier: user?.subscriptionTier ?? "FREE",
                expiresAt: user?.subscriptionExpiresAt ?? null,
                isAutoRenewal: user?.isAutoRenewal ?? false,
            },
        });
    } catch (error) {
        captureApiError(error);
        return NextResponse.json({ error: "Failed to fetch unlocked courses" }, { status: 500 });
    }
}
