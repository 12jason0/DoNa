// src/app/api/course-tags/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// course_tags 테이블 제거 후 빈 배열 반환 (하위 호환성 유지)
export async function GET() {
    return NextResponse.json({ success: true, tags: [] });
}
