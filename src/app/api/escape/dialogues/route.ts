import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// GET /api/escape/dialogues?storyId=1&placeId=optional&type=intro|main
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const storyId = Number(searchParams.get("storyId"));
        const placeId = searchParams.get("placeId") ? Number(searchParams.get("placeId")) : null;
        const type = searchParams.get("type") || undefined;
        if (!Number.isFinite(storyId)) {
            return NextResponse.json({ error: "storyId가 필요합니다." }, { status: 400 });
        }
        const where: any = { storyId };
        if (Number.isFinite(placeId)) where.placeId = Number(placeId);
        if (type) where.type = String(type);
        const rows = await prisma.placeDialogue.findMany({ where, orderBy: [{ order: "asc" }] });
        return NextResponse.json({ items: rows });
    } catch {
        return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }
}

function ensureAdmin(req: NextRequest) {
    if (!verifyAdminJwt(req)) throw new Error("ADMIN_ONLY");
}

// POST create
export async function POST(request: NextRequest) {
    try {
        ensureAdmin(request);
        const body = await request.json().catch(() => ({}));
        const { storyId, placeId, type, order, speaker, message, role } = body || {};
        if (!Number.isFinite(Number(storyId)) || !message) {
            return NextResponse.json({ error: "storyId와 message는 필수입니다." }, { status: 400 });
        }
        const created = await prisma.placeDialogue.create({
            data: {
                storyId: Number(storyId),
                placeId: Number.isFinite(Number(placeId)) ? Number(placeId) : null,
                type: type || "intro",
                order: Number.isFinite(Number(order)) ? Number(order) : 1,
                speaker: speaker ?? null,
                role: role ?? "npc",
                message: String(message),
            },
        });
        return NextResponse.json({ success: true, item: created }, { status: 201 });
    } catch (e: any) {

            captureApiError(e);
        if (String(e?.message) === "ADMIN_ONLY") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
        return NextResponse.json({ error: "생성 실패" }, { status: 500 });
    }
}

// PUT update
export async function PUT(request: NextRequest) {
    try {
        ensureAdmin(request);
        const body = await request.json().catch(() => ({}));
        const { id, ...patch } = body || {};
        if (!Number.isFinite(Number(id))) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
        const updated = await prisma.placeDialogue.update({
            where: { id: Number(id) },
            data: {
                ...(patch.type !== undefined ? { type: String(patch.type) } : {}),
                ...(patch.order !== undefined ? { order: Number(patch.order) } : {}),
                ...(patch.speaker !== undefined ? { speaker: patch.speaker } : {}),
                ...(patch.role !== undefined ? { role: patch.role } : {}),
                ...(patch.message !== undefined ? { message: String(patch.message) } : {}),
            },
        });
        return NextResponse.json({ success: true, item: updated });
    } catch (e: any) {

            captureApiError(e);
        if (String(e?.message) === "ADMIN_ONLY") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
        return NextResponse.json({ error: "수정 실패" }, { status: 500 });
    }
}

// DELETE /api/escape/dialogues?id=123
export async function DELETE(request: NextRequest) {
    try {
        ensureAdmin(request);
        const { searchParams } = new URL(request.url);
        const id = Number(searchParams.get("id"));
        if (!Number.isFinite(id)) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
        await prisma.placeDialogue.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e: any) {

            captureApiError(e);
        if (String(e?.message) === "ADMIN_ONLY") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
        return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
    }
}


