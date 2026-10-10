import { NextResponse } from "next/server";
import { listPopups } from "@/lib/popups";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/** 팝업·전시 목록 (앱 팝업 화면용, 웹 /popups 와 같은 내용) */
export async function GET() {
    try {
        return NextResponse.json(await listPopups(), { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
    } catch (error) {
        captureApiError(error);
        return NextResponse.json({ error: "팝업 목록 조회 실패" }, { status: 500 });
    }
}
