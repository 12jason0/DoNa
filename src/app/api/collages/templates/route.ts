import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const storyIdStr = searchParams.get("storyId");
		const storyId = storyIdStr != null ? Number(storyIdStr) : null;

		if (storyIdStr != null && !Number.isFinite(Number(storyIdStr))) {
			return NextResponse.json({ error: "Invalid storyId" }, { status: 400 });
		}

		// 스토리별 1:1 템플릿 정책
		if (storyId) {
			const t = await prisma.collageTemplate.findFirst({
				where: { storyId },
				select: {
					id: true,
					name: true,
					imageUrl: true,
					framesJson: true,
					isPublic: true,
					storyId: true,
					createdAt: true,
				},
			});
			return NextResponse.json({ templates: t ? [t] : [] }, {
				headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
			});
		}

		// storyId가 없을 때만 공개 템플릿 목록 반환
		const sorted = await prisma.collageTemplate.findMany({
			where: { isPublic: true },
			orderBy: [{ id: "asc" }],
			select: {
				id: true,
				name: true,
				imageUrl: true,
				framesJson: true,
				isPublic: true,
				storyId: true,
				createdAt: true,
			},
		});

		return NextResponse.json(
			{ templates: sorted },
			{
				headers: {
					"Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
				},
			}
		);
	} catch (error) {
	        captureApiError(error);
		console.error("Failed to fetch collage templates:", error);
		return NextResponse.json({ error: "Failed to fetch collage templates" }, { status: 500 });
	}
}

 
