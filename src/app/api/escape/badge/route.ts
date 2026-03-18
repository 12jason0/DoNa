import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const storyId = Number(searchParams.get("storyId"));
        if (!Number.isFinite(storyId)) {
            return NextResponse.json({ message: "storyId가 필요합니다." }, { status: 400 });
        }

        const story = await prisma.story.findUnique({
            where: { id: storyId },
            include: { reward_badge: true },
        });

        if (!story?.reward_badge) {
            return NextResponse.json({ success: true, badge: null });
        }

        const b = story.reward_badge;
        return NextResponse.json({
            success: true,
            badge: {
                id: b.id,
                name: b.name,
                description: b.description ?? null,
                image_url: b.image_url ?? null,
            },
        });
    } catch (error: any) {

            captureApiError(error);
        return NextResponse.json({ message: error?.message || "배지 조회 실패" }, { status: 500 });
    }
}
