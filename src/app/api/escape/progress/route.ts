import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const userIdStr = resolveUserId(request);
        // 로그인하지 않은 사용자는 서버 저장을 건너뜀
        if (!userIdStr) {
            return NextResponse.json({ ok: true, skipped: true });
        }
        const userId = Number(userIdStr);
        if (!Number.isFinite(userId) || userId <= 0) {
            return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
        }

        const body = (await request.json()) as {
            story_id: number;
            current_chapter: number;
            status: "in_progress" | "completed" | string;
            started_at?: number | null;
            completed_at?: number | null;
        };

        const startedAt = body.started_at ? new Date(body.started_at) : null;
        const completedAt = body.completed_at ? new Date(body.completed_at) : null;

        // upsert로 저장
        await prisma.userStoryProgress.upsert({
            where: { user_id_story_id: { user_id: userId, story_id: body.story_id } },
            create: {
                user_id: userId,
                story_id: body.story_id,
                current_chapter: body.current_chapter,
                status: body.status,
                started_at: startedAt,
                completed_at: completedAt,
            },
            update: {
                current_chapter: body.current_chapter,
                status: body.status,
                started_at: startedAt ?? undefined,
                completed_at: completedAt ?? undefined,
            },
        });

        // 배지 지급은 아직 미적용 (요청에 따라 보류)

        return NextResponse.json({ ok: true });
    } catch (error) {

            captureApiError(error);
        return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
    }
}
