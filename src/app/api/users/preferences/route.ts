import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5분 캐싱

// 기존 사용자 데이터를 새로운 구조로 마이그레이션하는 함수
function migratePreferences(oldPrefs: any): any {
    // 이미 새로운 구조인 경우 그대로 반환 (concept, companion, mood, regions)
    if (oldPrefs.concept || oldPrefs.companion || oldPrefs.mood || oldPrefs.regions) {
        return oldPrefs;
    }

    const newPrefs: any = {};

    // 이전 구조 (companionType, vibe, budgetRange) → 새로운 구조로 마이그레이션
    if (oldPrefs.companionType) {
        // companionType → companion 매핑
        const companionMap: Record<string, string> = {
            solo: "혼자",
            couple: "연인",
            friends: "친구",
            family: "가족",
            blinddate: "소개팅",
        };
        newPrefs.companion = companionMap[oldPrefs.companionType] || oldPrefs.companionType;
    }

    // vibe → mood 배열로 변환
    if (oldPrefs.vibe) {
        const vibeMoodMap: Record<string, string[]> = {
            romantic: ["감성적", "로맨틱"],
            calm: ["조용한", "감성적"],
            hip: ["트렌디한"],
            private: ["조용한", "프라이빗"],
            active: ["활동적인", "활기찬"],
        };
        newPrefs.mood = vibeMoodMap[oldPrefs.vibe] || [oldPrefs.vibe];
    }

    // concept는 기본값으로 설정 (기존 데이터가 없으므로)
    if (!newPrefs.concept) {
        newPrefs.concept = [];
    }

    // regions는 기본값으로 설정
    if (!newPrefs.regions) {
        newPrefs.regions = [];
    }

    return newPrefs;
}

export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        // ✅ [수정됨] prisma.user_preferences -> prisma.userPreference
        const preferences = await prisma.userPreference.findUnique({
            where: { userId: Number(userId) },
        });

        if (!preferences) {
            return NextResponse.json({ preferences: {} }, { status: 200 });
        }

        // 기존 데이터를 새로운 구조로 마이그레이션
        const prefsData = preferences.preferences as any;
        const migratedPrefs = migratePreferences(prefsData);

        // preferences 객체의 preferences 필드를 반환 (클라이언트에서 일관되게 접근할 수 있도록)
        return NextResponse.json({ preferences: migratedPrefs }, { status: 200 });
    } catch (error) {
        console.error("사용자 선호도 가져오기 오류:", error);
        return NextResponse.json({ error: "사용자 선호도를 가져오는 중 오류 발생" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        // 요청 본문 읽기 (빈 요청 처리)
        let body: any = {};
        try {
            const text = await request.text();
            if (text && text.trim().length > 0) {
                body = JSON.parse(text);
            }
        } catch (parseError) {
            console.error("JSON 파싱 오류:", parseError);
            return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
        }

        // body.preferences 또는 body 자체가 preferences 객체일 수 있음
        const preferencesData = body.preferences || body;

        // preferencesData가 비어있거나 유효하지 않은 경우 처리
        if (!preferencesData || (typeof preferencesData === "object" && Object.keys(preferencesData).length === 0)) {
            return NextResponse.json({ error: "선호도 데이터가 없습니다." }, { status: 400 });
        }

        // ✅ [수정됨] prisma.user_preferences -> prisma.userPreference
        const updatedPreferences = await prisma.userPreference.upsert({
            where: { userId: Number(userId) },
            update: { preferences: preferencesData },
            create: {
                userId: Number(userId),
                preferences: preferencesData,
            },
        });

        return NextResponse.json(updatedPreferences, { status: 200 });
    } catch (error) {
        console.error("사용자 선호도 저장 오류:", error);
        return NextResponse.json({ error: "사용자 선호도 저장 중 오류 발생" }, { status: 500 });
    }
}
