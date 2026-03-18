import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await request.json().catch(() => ({}));
        const { placeId, missionId, isCorrect } = body || {};
        if (!Number.isFinite(Number(placeId)) || !Number.isFinite(Number(missionId))) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        // 간단 저장: MissionSubmission에 재사용 (chapterId 없이 placeId만 메타로 저장)
        await prisma.missionSubmission.create({
            data: {
                userId: Number(userId),
                chapterId: 0, // place-mission 전용
                textAnswer: isCorrect ? "OK" : null,
                isCorrect: Boolean(isCorrect),
            },
        });

        // 완료 카운트 계산 (최근 4개 중 2개 성공 여부 등은 클라이언트에서 판정)
        return NextResponse.json({ ok: true });
    } catch (error) {

            captureApiError(error);
        return NextResponse.json({ error: "Submit failed" }, { status: 500 });
    }
}


