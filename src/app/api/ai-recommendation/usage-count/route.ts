import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyJwtAndGetUserId } from "@/lib/auth";

/**
 * GET: AI 추천 사용 횟수 및 온보딩 완료 여부 조회
 * - usageCount: LocationLog 중 purpose="DATE_COURSE_RECOMMENDATION" 개수
 * - hasOnboardingData: UserPreference에 concept/mood/regions 중 하나라도 존재
 * personalized-home 3회차 시 온보딩 바텀시트 유도에 사용
 */
export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("auth")?.value;
        if (!token) return NextResponse.json({ error: "인증 토큰이 필요합니다." }, { status: 401 });

        let userId: string;
        try {
            userId = verifyJwtAndGetUserId(token);
        } catch {
            return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });
        }

        const uid = Number(userId);
        if (isNaN(uid)) return NextResponse.json({ error: "잘못된 사용자 ID입니다." }, { status: 400 });

        const [usageCount, pref] = await Promise.all([
            (prisma as any).locationLog.count({
                where: {
                    userId: uid,
                    purpose: "DATE_COURSE_RECOMMENDATION",
                },
            }),
            prisma.userPreference.findUnique({
                where: { userId: uid },
                select: { preferences: true },
            }),
        ]);

        const prefs = pref?.preferences as { concept?: string[]; mood?: string[]; regions?: string[] } | null;
        const concept = Array.isArray(prefs?.concept) ? prefs.concept : [];
        const mood = Array.isArray(prefs?.mood) ? prefs.mood : [];
        const regions = Array.isArray(prefs?.regions) ? prefs.regions : [];
        const hasOnboardingData =
            concept.length > 0 || mood.length > 0 || regions.length > 0;

        return NextResponse.json({ usageCount, hasOnboardingData });
    } catch (err) {
        console.error("AI 추천 사용 횟수 조회 오류", err);
        return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
    }
}
