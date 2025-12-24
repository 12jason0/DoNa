import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// Fetch dialogue messages by ids.
// NOTE: 현재 스키마에서 메시지는 PlaceDialogue 모델을 사용합니다.
// id 배열을 받아 순서를 보존해서 반환합니다.
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const idsParam = searchParams.get("ids");
        if (!idsParam) {
            return NextResponse.json({ messages: [] }, { headers: { "Cache-Control": "no-store" } });
        }
        const ids = idsParam
            .split(",")
            .map((v) => Number(v))
            .filter((n) => Number.isFinite(n));
        if (ids.length === 0) {
            return NextResponse.json({ messages: [] }, { headers: { "Cache-Control": "no-store" } });
        }

        const rows = await (prisma as any).placeDialogue.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                storyId: true,
                speaker: true,
                message: true,
                role: true,
            },
        });
        // 원래 요청한 ids 순서대로 정렬
        const byId = new Map<number, any>(rows.map((r: any) => [Number(r.id), r]));
        const sorted = ids.map((id) => byId.get(id)).filter(Boolean);
        return NextResponse.json(
            {
                messages: sorted.map((m: any) => ({
                    id: m.id,
                    storyId: m.storyId,
                    speaker: m.speaker,
                    text: m.message,
                    role: m.role,
                })),
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (e) {
        return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
    }
}
