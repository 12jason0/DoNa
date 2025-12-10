import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const placeIdParam = searchParams.get("placeId");
        const placeId = Number(placeIdParam);
        if (!Number.isFinite(placeId)) {
            return NextResponse.json({ stories: [], missions: [] }, { headers: { "Cache-Control": "no-store" } });
        }

        const storiesRaw = await (prisma as any).placeStory.findMany({
            where: { placeId },
            orderBy: { order: "asc" },
            select: {
                id: true,
                speaker: true,
                dialogue: true,
                narration: true,
                nextTrigger: true,
            },
        });

        const stories = storiesRaw.map((s: any) => ({
            id: Number(s.id),
            speaker: String(s.speaker ?? "NPC"),
            dialogue: String(s.dialogue ?? s.narration ?? ""),
            nextTrigger: s.nextTrigger ? String(s.nextTrigger) : null,
        }));

        const missions = await (prisma as any).placeMission.findMany({
            where: { placeId },
            orderBy: { missionNumber: "asc" },
            select: {
                id: true,
                missionNumber: true,
                missionType: true,
                question: true,
                description: true,
                hint: true,
                answer: true,
            },
        });

        return NextResponse.json(
            { stories, missions },
            {
                headers: { "Cache-Control": "no-store" },
            }
        );
    } catch (e) {
        return NextResponse.json({ stories: [], missions: [], error: "SERVER_ERROR" }, { status: 500 });
    }
}




























