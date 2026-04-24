import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!verifyAdminJwt(req)) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

    const { id } = await params;
    const regionId = parseInt(id);
    if (!regionId || isNaN(regionId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    await (prisma as any).region.delete({ where: { id: regionId } });
    return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!verifyAdminJwt(req)) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

    const { id } = await params;
    const regionId = parseInt(id);
    if (!regionId || isNaN(regionId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const { display_order } = await req.json();
    const region = await (prisma as any).region.update({
        where: { id: regionId },
        data: { display_order },
    });
    return NextResponse.json(region);
}
