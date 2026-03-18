import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const rows = await prisma.course.findMany({
			where: { concept: { not: null } },
			distinct: ["concept"],
			select: { concept: true },
		});

		const concepts = rows
			.map((r) => (r.concept ?? "").trim())
			.filter((v) => v.length > 0)
			.sort((a, b) => a.localeCompare(b, "ko"));

		return NextResponse.json(concepts, {
			headers: {
				"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
			},
		});
	} catch (error) {

	        captureApiError(error);
		console.error("API: Error fetching course concepts:", error);
		return NextResponse.json({ error: "concept 목록을 가져오는 중 오류 발생" }, { status: 500 });
	}
}


