import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const userIdStr = resolveUserId(request);
        if (!userIdStr) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        const userId = Number(userIdStr);
        if (!Number.isFinite(userId) || userId <= 0) return NextResponse.json({ error: "BAD_USER" }, { status: 400 });

        const body = await request.json().catch(() => ({}));
        const storyId = Number(body?.storyId ?? body?.story_id ?? body?.id);
        if (!Number.isFinite(storyId) || storyId <= 0) {
            return NextResponse.json({ error: "INVALID_STORY_ID" }, { status: 400 });
        }

        // 이미 완료되었는지 확인
        const existing = await prisma.completedEscape.findFirst({ where: { userId, storyId } });
        if (existing) {
            // 진행 상태도 보정
            await prisma.userStoryProgress.upsert({
                where: { user_id_story_id: { user_id: userId, story_id: storyId } },
                create: {
                    user_id: userId,
                    story_id: storyId,
                    current_chapter: 0,
                    status: "completed",
                    completed_at: new Date(),
                },
                update: { status: "completed", completed_at: new Date() },
            });
            return NextResponse.json({ success: true, already: true });
        }

        const created = await prisma.$transaction(async (tx) => {
            // 완료 기록 생성
            const item = await tx.completedEscape.create({ data: { userId, storyId } });
            // 진행 상태 보정(upsert) - 제약 조건 준수: current_chapter >= 1, started_at 존재 보장
            const now = new Date();
            await tx.userStoryProgress.upsert({
                where: { user_id_story_id: { user_id: userId, story_id: storyId } },
                create: {
                    user_id: userId,
                    story_id: storyId,
                    current_chapter: 1,
                    status: "completed",
                    started_at: now,
                    completed_at: now,
                },
                update: {
                    current_chapter: 1,
                    status: "completed",
                    started_at: now,
                    completed_at: now,
                },
            });
            return item;
        });

        return NextResponse.json({ success: true, item: created });
    } catch (e: any) {

            captureApiError(e);
        console.error("[/api/escape/complete] POST error:", e);
        return NextResponse.json({ error: "SERVER_ERROR", message: e?.message || String(e) }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const userIdStr = resolveUserId(request);
        if (!userIdStr) return NextResponse.json({ completed: false }, { status: 200 });
        const userId = Number(userIdStr);
        const { searchParams } = new URL(request.url);
        const storyId = Number(searchParams.get("storyId"));
        if (!Number.isFinite(storyId) || storyId <= 0) {
            return NextResponse.json({ error: "INVALID_STORY_ID" }, { status: 400 });
        }

        const existing = await prisma.completedEscape.findFirst({ where: { userId, storyId } });
        return NextResponse.json({ completed: !!existing, item: existing || null });
    } catch (e: any) {

            captureApiError(e);
        console.error("[/api/escape/complete] GET error:", e);
        return NextResponse.json({ error: "SERVER_ERROR", message: e?.message || String(e) }, { status: 500 });
    }
}
