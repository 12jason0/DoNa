import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// GET /api/escape/place-options?storyId=123
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const storyId = Number(searchParams.get("storyId"));
        if (!Number.isFinite(storyId)) {
            return NextResponse.json({ error: "storyId가 필요합니다." }, { status: 400 });
        }
        const items = await prisma.placeOption.findMany({
            where: { storyId },
            orderBy: { id: "asc" },
        });
        return NextResponse.json({ items });
    } catch (err) {

            captureApiError(err);
        return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }
}

function ensureAdmin(req: NextRequest) {
    if (!verifyAdminJwt(req)) throw new Error("ADMIN_ONLY");
}

// POST /api/escape/place-options
export async function POST(request: NextRequest) {
    try {
        ensureAdmin(request);
        const body = await request.json().catch(() => ({}));
        const { storyId, name, address, latitude, longitude, description, imageUrl, category, signature } = body || {};

        if (!Number.isFinite(Number(storyId)) || !name) {
            return NextResponse.json({ error: "storyId와 name은 필수입니다." }, { status: 400 });
        }

        const created = await prisma.placeOption.create({
            data: {
                storyId: Number(storyId),
                name: String(name),
                address: address ?? null,
                description: description ?? null,
                category: category ?? null,
                imageUrl: imageUrl ?? null,
                signature: signature ?? null,
                latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : null,
                longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : null,
            },
        });
        return NextResponse.json({ success: true, item: created }, { status: 201 });
    } catch (err: any) {

            captureApiError(err);
        if (String(err?.message) === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
        }
        return NextResponse.json({ error: "생성 실패" }, { status: 500 });
    }
}

// PUT /api/escape/place-options
export async function PUT(request: NextRequest) {
    try {
        ensureAdmin(request);
        const body = await request.json().catch(() => ({}));
        const { id, ...patch } = body || {};
        if (!Number.isFinite(Number(id))) {
            return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
        }
        const updated = await prisma.placeOption.update({
            where: { id: Number(id) },
            data: {
                ...(patch.name != null ? { name: String(patch.name) } : {}),
                ...(patch.address !== undefined ? { address: patch.address } : {}),
                ...(patch.description !== undefined ? { description: patch.description } : {}),
                ...(patch.category !== undefined ? { category: patch.category } : {}),
                ...(patch.imageUrl !== undefined ? { imageUrl: patch.imageUrl } : {}),
                ...(patch.signature !== undefined ? { signature: patch.signature } : {}),
                ...(patch.latitude !== undefined
                    ? { latitude: Number.isFinite(Number(patch.latitude)) ? Number(patch.latitude) : null }
                    : {}),
                ...(patch.longitude !== undefined
                    ? { longitude: Number.isFinite(Number(patch.longitude)) ? Number(patch.longitude) : null }
                    : {}),
            },
        });
        return NextResponse.json({ success: true, item: updated });
    } catch (err: any) {

            captureApiError(err);
        if (String(err?.message) === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
        }
        return NextResponse.json({ error: "수정 실패" }, { status: 500 });
    }
}

// DELETE /api/escape/place-options?id=123
export async function DELETE(request: NextRequest) {
    try {
        ensureAdmin(request);
        const { searchParams } = new URL(request.url);
        const id = Number(searchParams.get("id"));
        if (!Number.isFinite(id)) {
            return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
        }
        await prisma.placeOption.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (err: any) {

            captureApiError(err);
        if (String(err?.message) === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
        }
        return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
    }
}
