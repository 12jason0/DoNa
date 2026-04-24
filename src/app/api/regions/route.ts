import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
    const regions = await (prisma as any).region.findMany({
        orderBy: [{ display_order: "asc" }, { name: "asc" }],
        select: { id: true, name: true, name_en: true, name_ja: true, name_zh: true, display_order: true },
    });
    return NextResponse.json(regions);
}
