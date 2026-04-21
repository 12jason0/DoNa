import { NextRequest, NextResponse } from "next/server";
import { verifyAdminJwt } from "@/lib/auth";
import { runPlaceAutofill } from "@/lib/placeAutofill";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    if (!verifyAdminJwt(request)) {
        return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name?.trim()) {
        return NextResponse.json({ error: "장소 이름이 필요합니다." }, { status: 400 });
    }

    const existing = await (prisma as any).place.findFirst({
        where: { name: { equals: name.trim(), mode: "insensitive" } },
        select: { id: true, name: true },
    });
    if (existing) {
        return NextResponse.json(
            { error: "이미 등록된 장소입니다.", existingId: existing.id },
            { status: 409 }
        );
    }

    const data = await runPlaceAutofill(name.trim());
    return NextResponse.json({ success: true, data });
}
