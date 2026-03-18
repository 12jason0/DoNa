import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const placeIdStr = searchParams.get("placeId");
        const placeId = Number(placeIdStr);
        if (!Number.isFinite(placeId) || placeId <= 0) {
            return NextResponse.json({ error: "Invalid placeId" }, { status: 400 });
        }

        const missions = await (prisma as any).placeMission.findMany({
            where: { placeId },
            orderBy: [{ missionNumber: "asc" }],
            take: 4,
            select: {
                id: true,
                missionNumber: true,
                missionType: true,
                missionPayload: true,
                description: true,
            },
        });

        return NextResponse.json({ missions });
    } catch (error) {

            captureApiError(error);
        return NextResponse.json({ error: "Failed to load missions" }, { status: 500 });
    }
}

function ensureAdmin(req: NextRequest) {
    if (!verifyAdminJwt(req)) throw new Error("ADMIN_ONLY");
}

// Create mission (admin)
export async function POST(request: NextRequest) {
    try {
        ensureAdmin(request);
        const body = await request.json().catch(() => ({}));
        const {
            placeId,
            missionNumber,
            missionType,
            missionPayload,
            description,
            question,
            hint,
        } = body || {};
        if (!Number.isFinite(Number(placeId))) {
            return NextResponse.json({ error: "placeId가 필요합니다." }, { status: 400 });
        }
        const allowed = ["quiz", "photo", "gps", "puzzle", "text", "choice"];
        const typeNorm = allowed.includes(String(missionType)) ? String(missionType) : "quiz";
        const created = await (prisma as any).placeMission.create({
            data: {
                placeId: Number(placeId),
                missionNumber: Number.isFinite(Number(missionNumber)) ? Number(missionNumber) : 1,
                missionType: typeNorm,
                missionPayload: missionPayload ?? null,
                description: description ?? null,
                question: question ?? null,
                hint: hint ?? null,
            },
        });
        return NextResponse.json({ success: true, mission: created }, { status: 201 });
    } catch (error: any) {

            captureApiError(error);
        if (String(error?.message) === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
        }
        return NextResponse.json({ error: "생성 실패" }, { status: 500 });
    }
}

// Update mission (admin)
export async function PUT(request: NextRequest) {
    try {
        ensureAdmin(request);
        const body = await request.json().catch(() => ({}));
        const { id, ...patch } = body || {};
        if (!Number.isFinite(Number(id))) {
            return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
        }
        const allowed = ["quiz", "photo", "gps", "puzzle", "text", "choice"];
        const updated = await (prisma as any).placeMission.update({
            where: { id: Number(id) },
            data: {
                ...(patch.missionNumber !== undefined
                    ? { missionNumber: Number.isFinite(Number(patch.missionNumber)) ? Number(patch.missionNumber) : 1 }
                    : {}),
                ...(patch.missionType !== undefined
                    ? { missionType: allowed.includes(String(patch.missionType)) ? String(patch.missionType) : "quiz" }
                    : {}),
                ...(patch.missionPayload !== undefined ? { missionPayload: patch.missionPayload } : {}),
                ...(patch.description !== undefined ? { description: patch.description } : {}),
                ...(patch.question !== undefined ? { question: patch.question } : {}),
                ...(patch.hint !== undefined ? { hint: patch.hint } : {}),
            },
        });
        return NextResponse.json({ success: true, mission: updated });
    } catch (error: any) {

            captureApiError(error);
        if (String(error?.message) === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
        }
        return NextResponse.json({ error: "수정 실패" }, { status: 500 });
    }
}

// Delete mission (admin)
export async function DELETE(request: NextRequest) {
    try {
        ensureAdmin(request);
        const { searchParams } = new URL(request.url);
        const id = Number(searchParams.get("id"));
        if (!Number.isFinite(id)) {
            return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
        }
        await (prisma as any).placeMission.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {

            captureApiError(error);
        if (String(error?.message) === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
        }
        return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
    }
}


