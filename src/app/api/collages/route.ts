import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { getAlbumLimit } from "@/constants/subscription";

export const dynamic = "force-dynamic";

// GET /api/collages?storyId=123 → 사용자의 해당 스토리 콜라주 목록 (albumCount, albumLimit 포함)
export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { subscriptionTier: true },
        });
        const tier = user?.subscriptionTier ?? "FREE";
        const albumLimit = getAlbumLimit(tier);
        const albumCount = await prisma.userCollage.count({ where: { userId } });

        const { searchParams } = new URL(request.url);
        const storyId = Number(searchParams.get("storyId"));

        const where: any = { userId };
        if (Number.isFinite(storyId)) where.storyId = storyId;

        const rows = await prisma.userCollage.findMany({
            where,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                collageUrl: true,
                thumbnailUrl: true,
                storyId: true,
                templateId: true,
                createdAt: true,
                template: { select: { id: true, name: true, imageUrl: true, framesJson: true, storyId: true } },
            },
        });

        return NextResponse.json({
            items: rows,
            albumCount,
            albumLimit: Number.isFinite(albumLimit) ? albumLimit : null,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "FAILED" }, { status: 500 });
    }
}

// POST /api/collages { storyId, collageUrl, thumbnailUrl?, templateId? }
export async function POST(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { subscriptionTier: true },
        });
        const tier = user?.subscriptionTier ?? "FREE";
        const limit = getAlbumLimit(tier);

        if (Number.isFinite(limit)) {
            const count = await prisma.userCollage.count({ where: { userId } });
            if (count >= limit) {
                const message =
                    tier === "FREE"
                        ? "FREE 등급은 추억 앨범 5개까지 가능합니다. 업그레이드 후 더 많이 저장할 수 있어요."
                        : "BASIC 등급은 추억 앨범 10개까지 가능합니다. PREMIUM으로 업그레이드하면 무제한이에요.";
                return NextResponse.json({ error: "ALBUM_LIMIT_REACHED", message }, { status: 403 });
            }
        }

        const body = await request.json();
        const storyId = Number(body?.storyId);
        const collageUrl = String(body?.collageUrl || "").trim();
        const thumbnailUrl = body?.thumbnailUrl ? String(body.thumbnailUrl) : null;
        const templateId = body?.templateId != null ? Number(body.templateId) : null;

        if (!collageUrl) return NextResponse.json({ error: "collageUrl required" }, { status: 400 });

        const created = await prisma.userCollage.create({
            data: {
                userId,
                storyId: Number.isFinite(storyId) ? storyId : null,
                collageUrl,
                thumbnailUrl,
                templateId: Number.isFinite(templateId as any) ? (templateId as number) : null,
            },
            select: {
                id: true,
                collageUrl: true,
                thumbnailUrl: true,
                storyId: true,
                templateId: true,
                createdAt: true,
            },
        });

        return NextResponse.json({ success: true, item: created });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "FAILED" }, { status: 500 });
    }
}
