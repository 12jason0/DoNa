import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5분 캐싱
// 공공데이터포털 인증 키 (기상청 API와 미세먼지 API 모두 동일한 키 사용)
// KMA_API_KEY 또는 AIRKOREA_API_KEY 중 하나만 설정하면 됨
const PUBLIC_DATA_API_KEY = process.env.KMA_API_KEY || process.env.AIRKOREA_API_KEY;
const KMA_API_KEY = PUBLIC_DATA_API_KEY;
const AIRKOREA_API_KEY = PUBLIC_DATA_API_KEY;

// ---------------------------------------------
// [날씨/점수 계산 함수들은 기존과 동일 - 생략 없이 전체 코드 유지]
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
        if (!response.ok) {
            console.error(`❌ 날씨 API HTTP 오류: ${response.status} ${response.statusText}`);
            return null;
        }
        const jsonResponse = await response.json();

        // 공공데이터포털 API는 에러 시에도 200을 반환하므로 resultCode 확인
        const resultCode = jsonResponse?.response?.header?.resultCode;
        if (resultCode && resultCode !== "00") {
            const resultMsg = jsonResponse?.response?.header?.resultMsg || "알 수 없는 오류";
            console.error(`❌ 날씨 API 오류 (resultCode: ${resultCode}): ${resultMsg}`);
            return null;
        }

        return extractWeatherStatus(jsonResponse);
    } catch (error) {
        console.error("❌ 날씨 API 호출 중 예외 발생:", error);
        return null;
    }
}

async function fetchAirQualityStatus(sidoName: string): Promise<string | null> {
    if (!AIRKOREA_API_KEY || !sidoName) {
        if (!AIRKOREA_API_KEY) console.error("⚠️ AIRKOREA_API_KEY가 설정되지 않았습니다.");
        if (!sidoName) console.error("⚠️ sidoName이 없습니다.");
        return null;
    }
    try {
        const encodedServiceKey = encodeURIComponent(AIRKOREA_API_KEY);
        const encodedSidoName = encodeURIComponent(sidoName);
        const apiUrl = `https://apis.data.go.kr/B552584/ArpltnInforinquireSvc/getCtprvnRltmMesureDnsty?serviceKey=${encodedServiceKey}&numOfRows=1&pageNo=1&sidoName=${encodedSidoName}&ver=1.3&returnType=json`;

        const response = await fetch(apiUrl, { next: { revalidate: 3600 } });

        if (!response.ok) {
            // 500 오류인 경우 응답 본문 확인
            let errorBody = "";
            try {
                errorBody = await response.text();
                console.error(`❌ 미세먼지 API HTTP 오류: ${response.status} ${response.statusText}`);
                console.error(`❌ 응답 본문: ${errorBody.substring(0, 500)}`); // 처음 500자만 출력
            } catch (e) {
                console.error(
                    `❌ 미세먼지 API HTTP 오류: ${response.status} ${response.statusText} (응답 본문 읽기 실패)`
                );
            }
            return null;
        }

        const jsonResponse = await response.json().catch(() => null as any);
        if (!jsonResponse) {
            console.error("❌ 미세먼지 API JSON 파싱 실패");
            return null;
        }

        // 공공데이터포털 API는 에러 시에도 200을 반환하므로 resultCode 확인
        const resultCode = jsonResponse?.response?.header?.resultCode;
        if (resultCode && resultCode !== "00") {
            const resultMsg = jsonResponse?.response?.header?.resultMsg || "알 수 없는 오류";
            console.error(`❌ 미세먼지 API 오류 (resultCode: ${resultCode}): ${resultMsg}`);
            return null;
        }

        const items = jsonResponse?.response?.body?.items;
        if (!Array.isArray(items) || items.length === 0) return null;
        const item = items[0] || {};
        const pm10Grade = String(item.pm10Grade || "");
        const pm25Grade = String(item.pm25Grade || "");
        const pm10Value = parseInt(String(item.pm10Value ?? ""), 10);
        const pm25Value = parseInt(String(item.pm25Value ?? ""), 10);
        const isExtremelyBad =
            pm10Grade === "4" ||
            pm25Grade === "4" ||
            (Number.isFinite(pm10Value) && pm10Value > 150) ||
            (Number.isFinite(pm25Value) && pm25Value > 75);
        if (isExtremelyBad) return "황사";
        const isBad =
            pm10Grade === "3" ||
            pm25Grade === "3" ||
            (Number.isFinite(pm10Value) && pm10Value > 75) ||
            (Number.isFinite(pm25Value) && pm25Value > 35);
        if (isBad) return "미세먼지";
        return null;
    } catch (error) {
        console.error("❌ 미세먼지 API 호출 중 예외 발생:", error);
        return null;
    }
}

function calculateWeatherPenalty(courseTags: any, weatherToday: string): number {
    let penalty = 0;

    // 비/눈 날씨: 야외 코스는 페널티, 실내 코스는 보너스
    if (weatherToday.includes("비") || weatherToday.includes("눈")) {
        const isOutdoorCourse = courseTags.concept?.some(
            (tag: string) => tag.includes("야외") || tag.includes("공원") || tag.includes("루프탑")
        );
        if (isOutdoorCourse) penalty += -0.2;
        const isIndoorCourse = courseTags.concept?.some((tag: string) => tag.includes("실내"));
        if (isIndoorCourse) penalty += 0.05;
    }
    // 미세먼지/황사: 활동적인 야외 코스는 페널티, 안전한 실내 코스는 보너스
    else if (weatherToday.includes("미세먼지") || weatherToday.includes("황사")) {
        const isActivityCourse = courseTags.concept?.some(
            (tag: string) => tag.includes("활동적인") || tag.includes("야외") || tag.includes("모험")
        );
        if (isActivityCourse) penalty += -0.15;
        const isSafeIndoor = courseTags.concept?.some(
            (tag: string) => tag.includes("전시") || tag.includes("쇼핑") || tag.includes("카페")
        );
        if (isSafeIndoor) penalty += 0.03;
    }
    // 맑은 날씨: 야외 코스는 보너스, 실내 코스는 약간의 페널티
    else if (weatherToday.includes("맑음") || weatherToday.includes("구름많음") || weatherToday.includes("흐림")) {
        const isOutdoorCourse = courseTags.concept?.some(
            (tag: string) =>
                tag.includes("야외") || tag.includes("공원") || tag.includes("루프탑") || tag.includes("활동적인")
        );
        if (isOutdoorCourse) penalty += 0.1;
        const isIndoorCourse = courseTags.concept?.some((tag: string) => tag.includes("실내"));
        if (isIndoorCourse && !isOutdoorCourse) penalty += -0.05;
    }

    return penalty;
}

function calculateNewRecommendationScore(
    courseTags: any,
    courseRegion: string | null,
    longTermPrefs: { concept?: string[]; companion?: string; mood?: string[]; regions?: string[] },
    todayContext: {
        goal?: string;
        companion_today?: string;
        mood_today?: string;
        region_today?: string;
        weather_today?: string;
    }
): number {
    let score = 0;
    const conceptScore = calculateConceptMatch(courseTags, longTermPrefs.concept || [], todayContext.goal || "");
    score += conceptScore * 0.25;
    const moodScore = calculateMoodMatch(courseTags, longTermPrefs.mood || [], todayContext.mood_today || "");
    score += moodScore * 0.25;
    const regionScore = calculateRegionMatch(
        courseRegion,
        longTermPrefs.regions || [],
        todayContext.region_today || ""
    );
    score += regionScore * 0.2;
    const goalScore = calculateGoalMatch(courseTags, todayContext.goal || "", todayContext.companion_today || "");
    score += goalScore * 0.3;
    const weatherPenalty = calculateWeatherPenalty(courseTags, todayContext.weather_today || "");
    score += weatherPenalty;
    return Math.min(score, 1.0);
}

function calculateConceptMatch(courseTags: any, longTermConcepts: string[], goal: string): number {
    if (!courseTags || !courseTags.concept || !Array.isArray(courseTags.concept)) return 0;
    const courseConcepts = courseTags.concept as string[];
    let matchCount = 0;
    longTermConcepts.forEach((pref) => {
        if (courseConcepts.some((c) => c.includes(pref) || pref.includes(c))) matchCount++;
    });
    const goalConceptMap: Record<string, string[]> = {
        기념일: ["프리미엄", "특별한", "로맨틱"],
        데이트: ["로맨틱", "감성", "데이트"],
        "썸·소개팅": ["조용한", "프라이빗", "카페"],
        힐링: ["힐링", "감성", "조용한"],
        "특별한 이벤트": ["프리미엄", "특별한"],
        "사진 잘 나오는 코스": ["인생샷", "사진", "인스타"],
        "밤 데이트": ["야경", "밤", "로맨틱"],
    };
    const goalConcepts = goalConceptMap[goal] || [];
    goalConcepts.forEach((gc) => {
        if (courseConcepts.some((c) => c.includes(gc) || gc.includes(c))) matchCount++;
    });
    const totalPossible = Math.max(longTermConcepts.length + goalConcepts.length, 1);
    return Math.min(matchCount / totalPossible, 1.0);
}

function calculateMoodMatch(courseTags: any, longTermMoods: string[], moodToday: string): number {
    if (!courseTags || !courseTags.mood || !Array.isArray(courseTags.mood)) return 0;
    const courseMoods = courseTags.mood as string[];
    let matchCount = 0;
    longTermMoods.forEach((pref) => {
        if (courseMoods.some((m) => m.includes(pref) || pref.includes(m))) matchCount++;
    });
    const moodMap: Record<string, string[]> = {
        조용한: ["조용한", "프라이빗"],
        "감성 가득한": ["감성", "로맨틱"],
        트렌디한: ["트렌디한", "핫플"],
        활동적인: ["활동적인", "액티브"],
        프리미엄: ["프리미엄", "럭셔리"],
        "사진 잘 나오는": ["인스타", "사진"],
        여유로운: ["여유로운", "힐링"],
    };
    const todayMoods = moodMap[moodToday] || [];
    todayMoods.forEach((tm) => {
        if (courseMoods.some((m) => m.includes(tm) || tm.includes(m))) matchCount++;
    });
    const totalPossible = Math.max(longTermMoods.length + todayMoods.length, 1);
    return Math.min(matchCount / totalPossible, 1.0);
}

function calculateRegionMatch(courseRegion: string | null, longTermRegions: string[], regionToday: string): number {
    if (!courseRegion) return 0;
    if (regionToday)
        return courseRegion === regionToday || courseRegion.includes(regionToday) || regionToday.includes(courseRegion)
            ? courseRegion === regionToday || courseRegion.includes(regionToday)
                ? 1.0
                : 0.8
            : 0;
    if (longTermRegions.length > 0) {
        const exactMatch = longTermRegions.some((r) => courseRegion === r || courseRegion.includes(r));
        if (exactMatch) return 1.0;
        const partialMatch = longTermRegions.some((r) => r.includes(courseRegion));
        if (partialMatch) return 0.6;
    }
    return 0.3;
}

function calculateGoalMatch(courseTags: any, goal: string, companionToday: string): number {
    if (!goal) return 0;
    let score = 0;
    const goalWeights: Record<string, number> = {
        기념일: 1.0,
        데이트: 0.9,
        "썸·소개팅": 0.8,
        힐링: 0.7,
        "특별한 이벤트": 1.0,
        "사진 잘 나오는 코스": 0.8,
        "밤 데이트": 0.9,
    };
    const baseWeight = goalWeights[goal] || 0.5;
    if (courseTags) {
        const targetTags = courseTags.target || [];
        const conceptTags = courseTags.concept || [];
        const companionMap: Record<string, string[]> = {
            연인: ["연인", "커플", "데이트"],
            "썸 상대": ["썸", "데이트"],
            "소개팅 상대": ["소개팅", "첫 만남"],
            친구: ["친구", "소그룹"],
            혼자: ["혼자", "솔로"],
        };
        const companionTags = companionMap[companionToday] || [];
        const hasCompanionMatch = companionTags.some((ct) =>
            targetTags.some((tt: string) => tt.includes(ct) || ct.includes(tt))
        );
        if (hasCompanionMatch) score += 0.5;
        const goalTags: Record<string, string[]> = {
            기념일: ["기념일", "특별한", "프리미엄"],
            데이트: ["데이트", "로맨틱"],
            "썸·소개팅": ["소개팅", "첫 만남"],
            힐링: ["힐링", "감성"],
            "특별한 이벤트": ["특별한", "이벤트"],
            "사진 잘 나오는 코스": ["인생샷", "사진", "인스타"],
            "밤 데이트": ["야경", "밤"],
        };
        const goalTagList = goalTags[goal] || [];
        const hasGoalMatch = goalTagList.some((gt) =>
            [...targetTags, ...conceptTags].some((tag: string) => tag.includes(gt) || gt.includes(gt))
        );
        if (hasGoalMatch) score += 0.5;
    }
    return Math.min(score * baseWeight, 1.0);
}

// ---------------------------------------------
// 🚀 [GET 메서드: 수정됨]
// ---------------------------------------------

export async function GET(req: NextRequest) {
    try {
        const userIdStr = getUserIdFromRequest(req);
        const { searchParams } = new URL(req.url);

        // mode 파라미터 확인 ("main"이면 온보딩/메인 화면, 없으면 AI 추천)
        const mode = searchParams.get("mode");

        const limit = Math.min(Math.max(Number(searchParams.get("limit") || 6), 1), 24);
        const goal = searchParams.get("goal") || "";
        const companionToday = searchParams.get("companion_today") || "";
        const moodToday = searchParams.get("mood_today") || "";
        const regionToday = searchParams.get("region_today") || "";
        const strictRegion = searchParams.get("strict") === "true";

        let userId: number | null = null;
        if (userIdStr) userId = Number(userIdStr);

        // 2. 사용자 정보 (구독 등급 포함) - 로그인 사용자만
        const user = userId
            ? await prisma.user.findUnique({
                  where: { id: userId },
                  select: { subscriptionTier: true },
              })
            : null;

        const userPrefs = userId
            ? await prisma.userPreference.findUnique({
                  where: { userId },
                  select: { preferences: true },
              })
            : null;

        const recent = userId
            ? await prisma.userInteraction.findMany({
                  where: { userId, action: { in: ["view", "click", "like"] } },
                  orderBy: { createdAt: "desc" },
                  take: 10,
                  include: { course: { select: { id: true, concept: true, region: true } } },
              })
            : [];

        // ---------------------------------------------
        // 🔥 [핵심 변경] 등급별 필터링 로직
        // ---------------------------------------------

        const whereConditions: any = { isPublic: true };
        const userTier = user?.subscriptionTier || "FREE";

        // 비로그인 사용자는 FREE 코스만
        if (!userId) {
            whereConditions.grade = "FREE";
        } else if (mode === "main") {
            // ✅ 1. 메인/온보딩 추천: 유저 등급을 따라감
            if (userTier === "PREMIUM") {
                // [PREMIUM 유저] -> 필터 없음 (FREE, BASIC, PREMIUM 모두 보임)
            } else if (userTier === "BASIC") {
                // [BASIC 유저] -> FREE + BASIC 코스 보임
                whereConditions.grade = { in: ["FREE", "BASIC"] };
            } else {
                // [FREE 유저] -> FREE 코스만 보임
                whereConditions.grade = "FREE";
            }
        } else {
            // ✅ 2. AI 맞춤 추천 (쿠폰 사용): 무조건 BASIC 코스만
            // 등급이 PREMIUM이라도 여기서는 BASIC만 추천 (AI 전용 코스 풀 사용)
            whereConditions.grade = "BASIC";
        }

        // ---------------------------------------------

        // 지역 및 strict 필터링
        if (strictRegion && regionToday) {
            whereConditions.region = { contains: regionToday };
        }

        if (strictRegion && userId) {
            const savedCourses = await prisma.savedCourse.findMany({
                where: { userId },
                select: { courseId: true },
            });
            const savedCourseIds = savedCourses.map((s) => s.courseId);
            if (savedCourseIds.length > 0) {
                whereConditions.id = { notIn: savedCourseIds };
            }
        }

        // DB 조회
        const allCoursesRaw = await prisma.course.findMany({
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
            },
        });
        const allCourses = allCoursesRaw as Array<any>;

        // (이후 로직은 기존과 동일: grid 조회, 날씨 API, 점수 계산)
        let longTermPrefs: any = {};
        if (userPrefs?.preferences && typeof userPrefs.preferences === "object") {
            longTermPrefs = userPrefs.preferences;
        }

        let gridCoords: { nx: number; ny: number } | null = null;
        if (regionToday) {
            // 지역명 검색: "서울 강남구" -> "서울 특별시 강남구" 매칭
            // 1. 원본으로 먼저 검색 ("서울 강남구")
            let gridData = await prisma.gridCode.findFirst({
                where: { region_name: { contains: regionToday } },
                select: { nx: true, ny: true },
            });

            // 2. "특별시" 또는 "광역시"를 추가한 패턴으로 검색
            if (!gridData) {
                const patterns = [
                    regionToday.replace(/서울\s+/, "서울 특별시 "), // "서울 강남구" -> "서울 특별시 강남구"
                    regionToday.replace(/\s+강남구/, " 특별시 강남구"), // "서울 강남구" -> "서울 특별시 강남구"
                ];

                for (const pattern of patterns) {
                    if (pattern !== regionToday) {
                        // 원본과 다를 때만
                        gridData = await prisma.gridCode.findFirst({
                            where: { region_name: { contains: pattern } },
                            select: { nx: true, ny: true },
                        });
                        if (gridData) break;
                    }
                }
            }

            // 3. 마지막 부분(구/동 이름)만으로 검색 (예: "강남구")
            if (!gridData) {
                const parts = regionToday.split(/\s+/).filter((p) => p.length > 1);
                const lastPart = parts[parts.length - 1]; // "강남구"
                if (lastPart && lastPart.length > 1) {
                    gridData = await prisma.gridCode.findFirst({
                        where: { region_name: { contains: lastPart } },
                        select: { nx: true, ny: true },
                    });
                }
            }

            if (gridData) {
                gridCoords = gridData;
            }
        }

        let weatherToday: string | null = null;
        let airQualityStatus: string | null = null;
        if (regionToday) {
            // sidoName 변환: "서울 강남구" -> "서울" 또는 "서울특별시"
            let sidoName = (regionToday.split(" ")[0] || regionToday).replace(/시|도$/g, "");
            // "서울"을 "서울특별시"로 변환 시도 (일부 API가 이 형식을 요구할 수 있음)
            if (sidoName === "서울") {
                sidoName = "서울특별시";
            }
            const [kmaStatus, airStatus] = await Promise.all([
                gridCoords ? fetchWeatherAndCache(gridCoords.nx, gridCoords.ny) : Promise.resolve(null),
                fetchAirQualityStatus(sidoName),
            ]);
            weatherToday = kmaStatus;
            airQualityStatus = airStatus;
        }

        const todayContext = {
            goal,
            companion_today: companionToday,
            mood_today: moodToday,
            region_today: regionToday,
            weather_today: [weatherToday, airQualityStatus].filter(Boolean).join("/") || "",
        };

        // 비로그인 사용자는 날씨 정보를 활용하지 않고 바로 인기 코스 반환
        if (!userId) {
            const popular = await prisma.course.findMany({
                where: { grade: "FREE", isPublic: true },
                orderBy: { view_count: "desc" },
                take: limit,
            });
            return NextResponse.json({ recommendations: popular });
        }

        let filteredCourses = allCourses;
        if (!strictRegion && regionToday) {
            const regionFiltered = allCourses.filter((course) => {
                if (!course.region) return false;
                return (
                    course.region === regionToday ||
                    course.region.includes(regionToday) ||
                    regionToday.includes(course.region)
                );
            });
            if (regionFiltered.length > 0) filteredCourses = regionFiltered;
        }

        const coursesWithScores = filteredCourses.map((course) => {
            const recommendationScore = calculateNewRecommendationScore(
                course.tags,
                course.region,
                longTermPrefs,
                todayContext
            );

            let bonusScore = 0;
            if (course.is_editor_pick) bonusScore += 0.1;

            if (recent && recent.length > 0) {
                const concepts = recent.map((r) => r.course?.concept).filter(Boolean) as string[];
                const topConcept = concepts
                    .sort((a, b) => concepts.filter((x) => x === a).length - concepts.filter((x) => x === b).length)
                    .pop();
                if (topConcept && course.concept === topConcept) bonusScore += 0.1;
            }

            const normalizedViewScore = Math.min(Math.log10(course.view_count + 1) / 5, 0.05);
            bonusScore += normalizedViewScore;
            const normalizedRatingScore = Math.min((course.rating / 5) * 0.05, 0.05);
            bonusScore += normalizedRatingScore;
            bonusScore = Math.min(bonusScore, 0.2);

            return { ...course, matchScore: Math.min(recommendationScore + bonusScore, 1.0) };
        });

        const recs = coursesWithScores.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);

        // [법적 필수] 위치 로그 저장 (로그인한 사용자만, GPS 좌표는 저장하지 않음)
        if (userId) {
            try {
                await (prisma as any).locationLog.create({
                    data: {
                        userId: userId,
                        purpose: "DATE_COURSE_RECOMMENDATION",
                    },
                });
            } catch (logError) {
                // 로그 저장 실패해도 추천은 정상 반환
                console.error("위치 로그 저장 실패:", logError);
            }
        }

        if (recs.length === 0) {
            const popular = await prisma.course.findMany({
                where: whereConditions,
                orderBy: { view_count: "desc" },
                take: limit,
            });
            return NextResponse.json({ recommendations: popular });
        }

        return NextResponse.json({ recommendations: recs });
    } catch (e) {
        console.error("Recommendation error:", e);
        return NextResponse.json({ error: "Failed to get recommendations" }, { status: 500 });
    }
}
