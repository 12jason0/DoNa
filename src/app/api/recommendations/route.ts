import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth"; // 🟢 쿠키 기반 인증 통일

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5분 캐싱

// 공공데이터포털 인증 키
const PUBLIC_DATA_API_KEY = process.env.KMA_API_KEY || process.env.AIRKOREA_API_KEY;
const KMA_API_KEY = PUBLIC_DATA_API_KEY;
const AIRKOREA_API_KEY = PUBLIC_DATA_API_KEY;

// ---------------------------------------------
// [날씨 및 점수 계산 헬퍼 함수]
// ---------------------------------------------

function extractWeatherStatus(data: any): string | null {
    const items = data?.response?.body?.items?.item;
    if (!items || items.length === 0) return null;
    let weatherStatus = "맑음";
    let hasRain = false;
    for (const item of items) {
        if (item.category === "PTY" && item.obsrValue !== "0") hasRain = true;
        if (item.category === "SKY") {
            if (item.obsrValue === "4") weatherStatus = "흐림";
            else if (item.obsrValue === "3") weatherStatus = "구름많음";
            else if (item.obsrValue === "1") weatherStatus = "맑음";
        }
    }
    return hasRain ? "비/눈" : weatherStatus;
}

async function fetchWeatherAndCache(nx: number, ny: number): Promise<string | null> {
    if (!KMA_API_KEY) {
        console.error("⚠️ KMA_API_KEY가 설정되지 않았습니다.");
        return null;
    }
    const now = new Date();
    const baseDate = now.toISOString().slice(0, 10).replace(/-/g, "");
    const baseTime = `${now.getHours().toString().padStart(2, "0")}00`;
    const apiUrl = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst?serviceKey=${encodeURIComponent(
        KMA_API_KEY
    )}&numOfRows=10&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) return null;
        const jsonResponse = await response.json();
        const resultCode = jsonResponse?.response?.header?.resultCode;
        if (resultCode && resultCode !== "00") return null;
        return extractWeatherStatus(jsonResponse);
    } catch (error) {
        console.error("❌ 날씨 API 예외:", error);
        return null;
    }
}

async function fetchAirQualityStatus(sidoName: string): Promise<string | null> {
    if (!AIRKOREA_API_KEY || !sidoName) return null;
    try {
        const apiUrl = `https://apis.data.go.kr/B552584/ArpltnInforinquireSvc/getCtprvnRltmMesureDnsty?serviceKey=${encodeURIComponent(
            AIRKOREA_API_KEY
        )}&numOfRows=1&pageNo=1&sidoName=${encodeURIComponent(sidoName)}&ver=1.3&returnType=json`;
        const response = await fetch(apiUrl, { next: { revalidate: 3600 } });
        if (!response.ok) return null;
        const jsonResponse = await response.json();
        const items = jsonResponse?.response?.body?.items;
        if (!Array.isArray(items) || items.length === 0) return null;
        const item = items[0] || {};
        const pm10Value = parseInt(String(item.pm10Value ?? ""), 10);
        const pm25Value = parseInt(String(item.pm25Value ?? ""), 10);
        if (pm10Value > 150 || pm25Value > 75) return "황사";
        if (pm10Value > 75 || pm25Value > 35) return "미세먼지";
        return null;
    } catch (error) {
        return null;
    }
}

function calculateWeatherPenalty(courseTags: any, weatherToday: string): number {
    let penalty = 0;
    if (weatherToday.includes("비") || weatherToday.includes("눈")) {
        const isOutdoor = courseTags.concept?.some((t: string) => t.includes("야외") || t.includes("공원"));
        if (isOutdoor) penalty -= 0.2;
        if (courseTags.concept?.some((t: string) => t.includes("실내"))) penalty += 0.05;
    } else if (weatherToday.includes("미세먼지") || weatherToday.includes("황사")) {
        if (courseTags.concept?.some((t: string) => t.includes("활동적인") || t.includes("야외"))) penalty -= 0.15;
        if (courseTags.concept?.some((t: string) => t.includes("전시") || t.includes("쇼핑"))) penalty += 0.03;
    } else if (weatherToday.includes("맑음")) {
        if (courseTags.concept?.some((t: string) => t.includes("야외") || t.includes("활동적인"))) penalty += 0.1;
    }
    return penalty;
}

function calculateConceptMatch(courseTags: any, longTermConcepts: string[], goal: string): number {
    if (!courseTags?.concept || !Array.isArray(courseTags.concept)) return 0;
    const courseConcepts = courseTags.concept as string[];
    let matchCount = 0;
    longTermConcepts.forEach((pref) => {
        if (courseConcepts.some((c) => c.includes(pref) || pref.includes(c))) matchCount++;
    });
    const goalConceptMap: Record<string, string[]> = {
        기념일: ["프리미엄", "특별한", "로맨틱"],
        데이트: ["로맨틱", "감성", "데이트"],
        힐링: ["힐링", "감성", "조용한"],
    };
    (goalConceptMap[goal] || []).forEach((gc) => {
        if (courseConcepts.some((c) => c.includes(gc) || gc.includes(c))) matchCount++;
    });
    return Math.min(matchCount / Math.max(longTermConcepts.length + 1, 1), 1.0);
}

function calculateMoodMatch(courseTags: any, longTermMoods: string[], moodToday: string): number {
    if (!courseTags?.mood || !Array.isArray(courseTags.mood)) return 0;
    const courseMoods = courseTags.mood as string[];
    let matchCount = 0;
    longTermMoods.forEach((pref) => {
        if (courseMoods.some((m) => m.includes(pref) || pref.includes(m))) matchCount++;
    });
    const moodMap: Record<string, string[]> = {
        조용한: ["조용한", "프라이빗"],
        트렌디한: ["트렌디한", "핫플"],
    };
    (moodMap[moodToday] || []).forEach((tm) => {
        if (courseMoods.some((m) => m.includes(tm) || tm.includes(m))) matchCount++;
    });
    return Math.min(matchCount / Math.max(longTermMoods.length + 1, 1), 1.0);
}

function calculateRegionMatch(courseRegion: string | null, longTermRegions: string[], regionToday: string): number {
    if (!courseRegion) return 0;
    if (regionToday) return courseRegion.includes(regionToday) || regionToday.includes(courseRegion) ? 1.0 : 0;
    return longTermRegions.some((r) => courseRegion.includes(r) || r.includes(courseRegion)) ? 0.8 : 0.3;
}

function calculateGoalMatch(courseTags: any, goal: string, companionToday: string): number {
    if (!goal) return 0;
    let score = 0;
    if (courseTags) {
        const targetTags = courseTags.target || [];
        const companionMap: Record<string, string[]> = { 연인: ["연인", "커플"], 친구: ["친구"] };
        if ((companionMap[companionToday] || []).some((ct) => targetTags.some((tt: string) => tt.includes(ct))))
            score += 0.5;
        const goalTags: Record<string, string[]> = { 기념일: ["기념일", "특별한"], 데이트: ["데이트", "로맨틱"] };
        if (
            (goalTags[goal] || []).some((gt) =>
                [...targetTags, ...(courseTags.concept || [])].some((tag: string) => tag.includes(gt))
            )
        )
            score += 0.5;
    }
    return score;
}

function calculateNewRecommendationScore(
    courseTags: any,
    courseRegion: string | null,
    longTermPrefs: any,
    todayContext: any
): number {
    let score = 0;
    score += calculateConceptMatch(courseTags, longTermPrefs.concept || [], todayContext.goal || "") * 0.25;
    score += calculateMoodMatch(courseTags, longTermPrefs.mood || [], todayContext.mood_today || "") * 0.25;
    score += calculateRegionMatch(courseRegion, longTermPrefs.regions || [], todayContext.region_today || "") * 0.2;
    score += calculateGoalMatch(courseTags, todayContext.goal || "", todayContext.companion_today || "") * 0.3;
    score += calculateWeatherPenalty(courseTags, todayContext.weather_today || "");
    return Math.min(score, 1.0);
}

// ---------------------------------------------
// 🚀 [메인 GET 핸들러]
// ---------------------------------------------

export async function GET(req: NextRequest) {
    try {
        const userId = resolveUserId(req);
        const { searchParams } = new URL(req.url);
        const mode = searchParams.get("mode");
        const limit = Math.min(Math.max(Number(searchParams.get("limit") || 6), 1), 24);
        const goal = searchParams.get("goal") || "";
        const companionToday = searchParams.get("companion_today") || "";
        const moodToday = searchParams.get("mood_today") || "";
        const regionToday = searchParams.get("region_today") || "";
        const strictRegion = searchParams.get("strict") === "true";

        let user = null;
        let userPrefs = null;
        let recent: any[] = [];

        // 🟢 userId가 있을 때만 DB 조회 (500 에러 방지 핵심)
        if (userId) {
            const [userData, prefsData, interactionData] = await Promise.all([
                prisma.user.findUnique({ where: { id: userId }, select: { subscriptionTier: true } }),
                prisma.userPreference.findUnique({ where: { userId }, select: { preferences: true } }),
                prisma.userInteraction.findMany({
                    where: { userId, action: { in: ["view", "click", "like"] } },
                    orderBy: { createdAt: "desc" },
                    take: 10,
                    include: { course: { select: { id: true, concept: true, region: true } } },
                }),
            ]);
            user = userData;
            userPrefs = prefsData;
            recent = interactionData;
        }

        const whereConditions: any = { isPublic: true };
        if (!userId) {
            whereConditions.grade = "FREE";
        } else if (mode !== "main") {
            whereConditions.grade = "BASIC";
        }

        if (strictRegion && regionToday) {
            whereConditions.region = { contains: regionToday };
        }

        const allCourses = await prisma.course.findMany({
            where: whereConditions,
            select: {
                id: true,
                title: true,
                description: true,
                imageUrl: true,
                region: true,
                concept: true,
                rating: true,
                view_count: true,
                createdAt: true,
                tags: true,
                is_editor_pick: true,
                grade: true,
                coursePlaces: {
                    select: { order_index: true, place: { select: { id: true, imageUrl: true } } },
                    orderBy: { order_index: "asc" },
                },
            },
        });

        // 🟢 비로그인 사용자는 즉시 인기순 반환
        if (!userId) {
            const popular = allCourses.sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, limit);
            return NextResponse.json({ recommendations: popular });
        }

        // 로그인 사용자용 날씨 및 점수 계산 로직
        let weatherToday = "";
        if (regionToday) {
            const sidoName =
                (regionToday.split(" ")[0] || regionToday).replace(/시|도$/g, "") === "서울"
                    ? "서울특별시"
                    : regionToday.split(" ")[0];
            const gridData = await prisma.gridCode.findFirst({
                where: { region_name: { contains: regionToday } },
                select: { nx: true, ny: true },
            });
            const [kma, air] = await Promise.all([
                gridData ? fetchWeatherAndCache(gridData.nx, gridData.ny) : Promise.resolve(null),
                fetchAirQualityStatus(sidoName),
            ]);
            weatherToday = [kma, air].filter(Boolean).join("/");
        }

        const longTermPrefs = (userPrefs?.preferences as any) || {};
        const todayContext = {
            goal,
            companion_today: companionToday,
            mood_today: moodToday,
            region_today: regionToday,
            weather_today: weatherToday,
        };

        const scoredCourses = allCourses.map((course) => {
            const baseScore = calculateNewRecommendationScore(course.tags, course.region, longTermPrefs, todayContext);
            let bonus = 0;
            if (course.is_editor_pick) bonus += 0.1;
            if (recent.some((r) => r.course?.concept === course.concept)) bonus += 0.1;
            return { ...course, matchScore: Math.min(baseScore + bonus, 1.0) };
        });

        // [법적 필수] 위치 로그 저장
        try {
            await (prisma as any).locationLog.create({ data: { userId, purpose: "DATE_COURSE_RECOMMENDATION" } });
        } catch (e) {}

        return NextResponse.json({
            recommendations: scoredCourses.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit),
        });
    } catch (e) {
        console.error("Recommendation error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
