import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const PUBLIC_DATA_API_KEY = process.env.KMA_API_KEY || process.env.AIRKOREA_API_KEY;
const KMA_API_KEY = PUBLIC_DATA_API_KEY;
const AIRKOREA_API_KEY = PUBLIC_DATA_API_KEY;

// ---------------------------------------------
// [온보딩 UI 텍스트 → 행정구역명 매핑]
// ---------------------------------------------
const regionMapping: Record<string, string> = {
    "성수 · 건대": "성동구",
    "홍대 · 연남 · 신촌": "마포구",
    "종로 · 북촌 · 서촌": "종로구",
    "을지로 (힙지로)": "중구",
    "강남 · 압구정 · 신사": "강남구",
    "한남 · 이태원 · 용산": "용산구",
    "잠실 · 송파": "송파구",
    "여의도 · 영등포": "영등포구",
};

// ---------------------------------------------
// [날씨 및 점수 계산 헬퍼 함수 - 기존 로직 100% 동일]
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
    if (!KMA_API_KEY) return null;
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
        if (jsonResponse?.response?.header?.resultCode !== "00") return null;
        return extractWeatherStatus(jsonResponse);
    } catch (error) {
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
    const concept = courseTags?.concept || [];
    if (weatherToday.includes("비") || weatherToday.includes("눈")) {
        if (concept.some((t: string) => t.includes("야외") || t.includes("공원"))) penalty -= 0.2;
        if (concept.some((t: string) => t.includes("실내"))) penalty += 0.05;
    } else if (weatherToday.includes("미세먼지") || weatherToday.includes("황사")) {
        if (concept.some((t: string) => t.includes("활동적인") || t.includes("야외"))) penalty -= 0.15;
        if (concept.some((t: string) => t.includes("전시") || t.includes("쇼핑"))) penalty += 0.03;
    } else if (weatherToday.includes("맑음")) {
        if (concept.some((t: string) => t.includes("야외") || t.includes("활동적인"))) penalty += 0.1;
    }
    return penalty;
}

function calculateConceptMatch(courseTags: any, longTermConcepts: string[], goal: string): number {
    if (!courseTags?.concept || !Array.isArray(courseTags.concept)) return 0;
    const courseConcepts = courseTags.concept as string[];

    // 🟢 [UX 개선]: 일치하는 컨셉 개수 계산
    let matchCount = 0;
    longTermConcepts.forEach((pref) => {
        if (courseConcepts.some((c) => c.includes(pref) || pref.includes(c))) matchCount++;
    });

    // 오늘의 목적(goal) 기반 매칭
    const goalConceptMap: Record<string, string[]> = {
        기념일: ["프리미엄", "특별한", "로맨틱"],
        데이트: ["로맨틱", "감성", "데이트"],
        힐링: ["힐링", "감성", "조용한"],
    };
    (goalConceptMap[goal] || []).forEach((gc) => {
        if (courseConcepts.some((c) => c.includes(gc) || gc.includes(c))) matchCount++;
    });

    // 🟢 UX 친화적 점수 계산: 하나만 맞아도 70%부터 시작
    if (matchCount === 0) return 0.2; // 일치하는게 하나도 없으면 낮게 측정
    if (longTermConcepts.length === 0 && !goal) return 0.5; // 데이터 없으면 중간값

    // 하나만 맞아도 기본 0.7(70%)부터 시작하고, 많이 맞을수록 가산점 (최대 3개까지 고려)
    return 0.7 + (Math.min(matchCount, 3) / 3) * 0.3;
}

function calculateMoodMatch(courseTags: any, longTermMoods: string[], moodToday: string): number {
    if (!courseTags?.mood || !Array.isArray(courseTags.mood)) return 0;
    const courseMoods = courseTags.mood as string[];

    // 🟢 [UX 개선]: 일치하는 무드 개수 계산
    let matchCount = 0;
    longTermMoods.forEach((pref) => {
        if (courseMoods.some((m) => m.includes(pref) || pref.includes(m))) matchCount++;
    });

    // 오늘의 무드 기반 매칭
    const moodMap: Record<string, string[]> = { 조용한: ["조용한", "프라이빗"], 트렌디한: ["트렌디한", "핫플"] };
    (moodMap[moodToday] || []).forEach((tm) => {
        if (courseMoods.some((m) => m.includes(tm) || tm.includes(m))) matchCount++;
    });

    // 🟢 UX 친화적 점수 계산: 하나만 맞아도 70%부터 시작
    if (matchCount === 0) return 0.2; // 일치하는게 하나도 없으면 낮게 측정
    if (longTermMoods.length === 0 && !moodToday) return 0.5; // 데이터 없으면 중간값

    // 하나만 맞아도 기본 0.7(70%)부터 시작하고, 많이 맞을수록 가산점 (최대 3개까지 고려)
    return 0.7 + (Math.min(matchCount, 3) / 3) * 0.3;
}

function calculateRegionMatch(courseRegion: string | null, longTermRegions: string[], regionToday: string): number {
    if (!courseRegion) return 0.5; // 지역 정보 없으면 중간값

    // 🟢 지역이 맞지 않으면 점수를 대폭 깎음 (UX 개선)
    if (regionToday) {
        return courseRegion.includes(regionToday) || regionToday.includes(courseRegion) ? 1.0 : 0.1;
    }

    if (longTermRegions?.length > 0) {
        // 장기 선호 지역과 일치하면 높은 점수, 아니면 낮은 점수
        return longTermRegions.some((r) => courseRegion.includes(r) || r.includes(courseRegion)) ? 0.8 : 0.2;
    }

    return 0.5; // 선호 지역 정보가 없으면 중간값
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
        const combined = [...targetTags, ...(courseTags.concept || [])];
        if ((goalTags[goal] || []).some((gt) => combined.some((tag: string) => tag.includes(gt)))) score += 0.5;
    }
    return score;
}

// ---------------------------------------------
// 🟢 [Fixed]: 데이터 희소성 해결을 위한 동적 가중치 정규화 로직
// ---------------------------------------------
function calculateNewRecommendationScore(
    courseTags: any,
    courseRegion: string | null,
    longTermPrefs: any,
    todayContext: any
): number {
    // 1. 기본 가중치 설정
    const WEIGHTS = {
        concept: 0.25,
        mood: 0.25,
        region: 0.2,
        goal: 0.3,
    };

    let weightedScoreSum = 0;
    let activeWeightTotal = 0;

    // 2. 컨셉/목적 매칭 (데이터가 있을 때만 가중치 합산)
    if ((longTermPrefs.concept && longTermPrefs.concept.length > 0) || todayContext.goal) {
        weightedScoreSum +=
            calculateConceptMatch(courseTags, longTermPrefs.concept || [], todayContext.goal || "") * WEIGHTS.concept;
        activeWeightTotal += WEIGHTS.concept;
    }

    // 3. 무드 매칭
    if ((longTermPrefs.mood && longTermPrefs.mood.length > 0) || todayContext.mood_today) {
        weightedScoreSum +=
            calculateMoodMatch(courseTags, longTermPrefs.mood || [], todayContext.mood_today || "") * WEIGHTS.mood;
        activeWeightTotal += WEIGHTS.mood;
    }

    // 4. 지역 매칭
    if ((longTermPrefs.regions && longTermPrefs.regions.length > 0) || todayContext.region_today) {
        weightedScoreSum +=
            calculateRegionMatch(courseRegion, longTermPrefs.regions || [], todayContext.region_today || "") *
            WEIGHTS.region;
        activeWeightTotal += WEIGHTS.region;
    }

    // 5. 목적/동반자 매칭
    if (todayContext.goal || todayContext.companion_today) {
        weightedScoreSum +=
            calculateGoalMatch(courseTags, todayContext.goal || "", todayContext.companion_today || "") * WEIGHTS.goal;
        activeWeightTotal += WEIGHTS.goal;
    }

    // 6. 🟢 핵심: 입력된 정보가 하나라도 있다면 그 정보의 비중을 1.0으로 정규화
    // 정보가 전혀 없다면 기본 점수 0.5 부여
    let finalBaseScore = activeWeightTotal > 0 ? weightedScoreSum / activeWeightTotal : 0.5;

    // 7. 날씨 페널티는 정규화된 점수 위에서 최종 가감 (날씨는 선택 사항이 아닌 외부 환경이므로)
    finalBaseScore += calculateWeatherPenalty(courseTags, todayContext.weather_today || "");

    return Math.max(0, Math.min(finalBaseScore, 1.0));
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

        let longTermPrefs: any = {};
        let recentBehaviorData: any = { concepts: [], regions: [], moods: [], goals: [] };

        // 🟢 [Fixed]: 개별 처리로 TypeScript 타입 추론 에러(18047, 2339) 해결
        let savedCourseIds: number[] = []; // 🟢 이미 저장한 코스 ID 목록
        if (userId) {
            const [prefsData, interactionData, savedCourses] = await Promise.all([
                prisma.userPreference
                    .findUnique({
                        where: { userId },
                        select: { preferences: true },
                    })
                    .catch(() => null),
                prisma.userInteraction
                    .findMany({
                        where: { userId, action: { in: ["view", "click", "like"] } },
                        orderBy: { createdAt: "desc" },
                        take: 50, // 🔥 10개 → 50개로 확대
                        select: {
                            action: true, // 🔥 행동 유형 추가
                            course: {
                                select: {
                                    concept: true,
                                    region: true,
                                    tags: true, // 🔥 mood, goal 추출을 위해 tags 전체 가져오기
                                },
                            },
                        },
                    })
                    .catch(() => []), // 🟢 에러 시 빈 배열 반환하여 'null' 가능성 제거 (18047 해결)
                // 🟢 AI 추천 모드일 때만 이미 저장한 코스 목록 조회
                mode === "ai"
                    ? prisma.savedCourse
                          .findMany({
                              where: { userId },
                              select: { courseId: true },
                          })
                          .catch(() => [])
                    : Promise.resolve([]),
            ]);

            if (prefsData?.preferences) {
                longTermPrefs = prefsData.preferences; // 🟢 명확한 속성 접근 (2339 해결)
            }

            // 🔥 다차원 분석: concept, region, mood, goal 추출 + 행동 유형별 가중치 적용
            const ACTION_WEIGHTS: { [key: string]: number } = {
                like: 1.0,
                click: 0.5,
                view: 0.3,
            };

            interactionData.forEach((interaction: any) => {
                const weight = ACTION_WEIGHTS[interaction.action] || 0.3;
                const course = interaction.course;

                if (!course) return;

                // Concept
                if (course.concept) {
                    for (let i = 0; i < weight * 10; i++) {
                        recentBehaviorData.concepts.push(course.concept);
                    }
                }

                // Region
                if (course.region) {
                    for (let i = 0; i < weight * 10; i++) {
                        recentBehaviorData.regions.push(course.region);
                    }
                }

                // Mood (tags에서 추출)
                if (course.tags?.mood) {
                    for (let i = 0; i < weight * 10; i++) {
                        recentBehaviorData.moods.push(course.tags.mood);
                    }
                }

                // Goal (tags에서 추출)
                if (course.tags?.goal) {
                    for (let i = 0; i < weight * 10; i++) {
                        recentBehaviorData.goals.push(course.tags.goal);
                    }
                }
            });

            // 🔥 패턴 분석 결과를 DB에 저장 (비동기로 저장, 추천 결과에는 영향 없음)
            if (recentBehaviorData.concepts.length > 0) {
                // 배열을 빈도 카운트 객체로 변환
                const countFrequency = (arr: string[]) => {
                    const freq: { [key: string]: number } = {};
                    arr.forEach((item) => {
                        freq[item] = (freq[item] || 0) + 1;
                    });
                    return freq;
                };

                const conceptPattern = countFrequency(recentBehaviorData.concepts);
                const regionPattern = countFrequency(recentBehaviorData.regions);
                const moodPattern = countFrequency(recentBehaviorData.moods);
                const goalPattern = countFrequency(recentBehaviorData.goals);

                // 비동기로 저장 (추천 API 응답에 영향 없음)
                (prisma as any).userBehaviorPattern
                    .create({
                        data: {
                            userId,
                            conceptPattern,
                            regionPattern,
                            moodPattern,
                            goalPattern,
                        },
                    })
                    .catch((err: any) => {
                        console.error("패턴 저장 실패:", err);
                    });
            }

            savedCourseIds = Array.isArray(savedCourses) ? savedCourses.map((sc: any) => sc.courseId) : [];
        }

        const whereConditions: any = { isPublic: true };
        if (!userId) {
            // 비로그인: FREE 코스만
            whereConditions.grade = "FREE";
        } else {
            // 로그인 유저: mode에 따라 구분
            if (mode === "ai") {
                // 🟢 personalized-home (AI 추천, 쿠폰 사용): BASIC 코스
                whereConditions.grade = "BASIC";
            } else {
                // 🟢 일반 추천 (PersonalizedSection 등): FREE 코스만
                whereConditions.grade = "FREE";
            }
        }
        if (strictRegion && regionToday) {
            whereConditions.region = { contains: regionToday };
        }

        // 🟢 AI 추천 모드일 때 이미 저장한 코스 제외
        if (mode === "ai" && savedCourseIds.length > 0) {
            whereConditions.id = { notIn: savedCourseIds };
        }

        const allCourses = await prisma.course.findMany({
            where: whereConditions,
            take: 200,
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
                    take: 1,
                    select: { place: { select: { id: true, imageUrl: true } } },
                    orderBy: { order_index: "asc" },
                },
            },
        });

        if (!userId) {
            const popular = allCourses.sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, limit);
            return NextResponse.json({ recommendations: popular });
        }

        // 🟢 날씨 정보 조회: regionToday가 없으면 온보딩에서 저장한 첫 번째 지역 사용
        let weatherToday = "";
        const rawRegion = regionToday || longTermPrefs.regions?.[0] || "";
        if (rawRegion) {
            // UI 텍스트를 행정구역명으로 매핑 (온보딩 선택지 → 구 단위)
            const searchKeyword = regionMapping[rawRegion] || rawRegion;

            const sidoName =
                (searchKeyword.split(" ")[0] || "").replace(/시|도$/g, "") === "서울"
                    ? "서울특별시"
                    : searchKeyword.split(" ")[0];

            const gridData = await prisma.gridCode.findFirst({
                where: { region_name: { contains: searchKeyword } },
                select: { nx: true, ny: true },
            });

            const [kma, air] = await Promise.all([
                gridData ? fetchWeatherAndCache(gridData.nx, gridData.ny) : Promise.resolve(null),
                fetchAirQualityStatus(sidoName),
            ]);
            weatherToday = [kma, air].filter(Boolean).join("/");
        }

        const todayContext = {
            goal,
            companion_today: companionToday,
            mood_today: moodToday,
            region_today: regionToday,
            weather_today: weatherToday,
        };

        // 🟢 온보딩 완료 여부 확인: 선호도 데이터나 오늘의 컨텍스트가 하나라도 있어야 함
        const hasOnboardingData =
            (longTermPrefs.concept && longTermPrefs.concept.length > 0) ||
            (longTermPrefs.mood && longTermPrefs.mood.length > 0) ||
            (longTermPrefs.regions && longTermPrefs.regions.length > 0) ||
            goal ||
            companionToday ||
            moodToday ||
            regionToday;

        const scoredCourses = allCourses.map((course) => {
            // 🟢 온보딩 데이터가 없으면 matchScore를 null로 설정 (취향저격 표시 안 함)
            if (!hasOnboardingData) {
                return {
                    ...course,
                    id: String(course.id),
                    imageUrl: course.imageUrl || course.coursePlaces?.[0]?.place?.imageUrl || "",
                    matchScore: null,
                };
            }

            const baseScore = calculateNewRecommendationScore(course.tags, course.region, longTermPrefs, todayContext);
            let bonus = 0;
            
            // 에디터 추천 보너스
            if (course.is_editor_pick) bonus += 0.1;

            // 🔥 다차원 최근 행동 패턴 보너스 (가중치 반영)
            const conceptFreq = recentBehaviorData.concepts.filter((c: string) => c === course.concept).length;
            const regionFreq = recentBehaviorData.regions.filter((r: string) => r === course.region).length;
            const courseTags = course.tags as any;
            const moodFreq = courseTags?.mood
                ? recentBehaviorData.moods.filter((m: string) => m === courseTags.mood).length
                : 0;
            const goalFreq = courseTags?.goal
                ? recentBehaviorData.goals.filter((g: string) => g === courseTags.goal).length
                : 0;

            // 빈도를 정규화해서 보너스 계산 (최대 50회 = 1.0 가중치로 가정)
            bonus += Math.min((conceptFreq / 50) * 0.15, 0.15); // concept: 최대 0.15
            bonus += Math.min((regionFreq / 50) * 0.1, 0.1); // region: 최대 0.1
            bonus += Math.min((moodFreq / 50) * 0.1, 0.1); // mood: 최대 0.1
            bonus += Math.min((goalFreq / 50) * 0.1, 0.1); // goal: 최대 0.1

            const finalScore = Math.min(baseScore + bonus, 1.0);

            // 🟢 UX 스케일링: 0.0~1.0의 범위를 0.6(60%) ~ 0.98(98%)로 변환
            // 점수가 낮아도 '취향저격 60%'부터 시작하게 하여 긍정적 경험 제공
            const uxScore = finalScore > 0 ? 0.6 + finalScore * 0.38 : 0;

            return {
                ...course,
                id: String(course.id),
                imageUrl: course.imageUrl || course.coursePlaces?.[0]?.place?.imageUrl || "",
                matchScore: Math.min(uxScore, 1.0),
            };
        });

        try {
            await (prisma as any).locationLog.create({ data: { userId, purpose: "DATE_COURSE_RECOMMENDATION" } });
        } catch (e) {}

        return NextResponse.json({
            recommendations: scoredCourses
                .sort((a, b) => {
                    // 🟢 matchScore가 null인 경우 처리: null은 맨 뒤로
                    if (a.matchScore === null && b.matchScore === null) return 0;
                    if (a.matchScore === null) return 1;
                    if (b.matchScore === null) return -1;
                    return b.matchScore - a.matchScore;
                })
                .slice(0, limit),
            hasOnboardingData: hasOnboardingData, // 🟢 온보딩 데이터 여부를 직접 반환
        });
    } catch (e: any) {
        console.error("Recommendation Error:", e.message);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
