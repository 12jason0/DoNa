import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const storyId = Number(searchParams.get("storyId"));
        if (!Number.isFinite(storyId)) {
            // [수정] 반환 형식을 { messages: [] }로 통일
            return NextResponse.json({ messages: [] });
        }

        // 1) PlaceDialogue의 outro/ending/epilogue를 우선 사용
        const endingTypes = ["outro", "ending", "epilogue"];
        const dialogues = await prisma.placeDialogue.findMany({
            where: {
                storyId,
                type: { in: endingTypes },
            },
            orderBy: { order: "asc" },
            select: { message: true, speaker: true, role: true },
        });

        let messages = (dialogues || [])
            .map((d: any) => ({
                text: String(d?.message || "").trim(),
                role: d?.role ? String(d.role) : undefined,
                speaker: d?.speaker ? String(d.speaker) : undefined,
            }))
            .filter((m: any) => m.text.length > 0);

        // 2) PlaceDialogue가 비어 있으면 기존 PlaceStory(places.stories) 기반으로 폴백
        if (messages.length === 0) {
            const placeOptions = await prisma.placeOption.findMany({
                where: {
                    storyId,
                    category: {
                        in: endingTypes,
                    },
                },
                select: {
                    id: true,
                    category: true,
                    stories: {
                        orderBy: { order: "asc" },
                        select: { dialogue: true, narration: true, speaker: true },
                    },
                },
            });

            const allDialogues = placeOptions.flatMap((option) => option.stories);
            messages = (allDialogues || [])
                .map((d: any) => ({
                    text: String(d?.dialogue || d?.narration || "").trim(),
                    role: undefined,
                    speaker: d?.speaker ? String(d.speaker) : undefined,
                }))
                .filter((m: any) => m.text.length > 0);
        }

        return NextResponse.json({ messages });
    } catch (e: any) {
            captureApiError(e);
        // [수정] 반환 형식을 { messages: [] }로 통일
        return NextResponse.json({ messages: [] });
    }
}
