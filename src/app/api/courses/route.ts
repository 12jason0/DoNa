import { NextRequest, NextResponse } from "next/server";
import { notExpiredCourseWhere } from "@/lib/placePeriod";
import { interleaveByGrade, MAX_LIST_COURSES } from "@/lib/courseListOrder";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { filterCoursesByImagePolicy, type ImagePolicy, type CourseWithPlaces } from "@/lib/imagePolicy";
import { resolveUserId } from "@/lib/auth";
import { defaultCache } from "@/lib/cache";
import { sortCoursesByTimeMatch } from "@/lib/timeMatch";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const revalidate = 300;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const concept = (searchParams.get("concept") || "").trim();
        const q = (searchParams.get("q") || "").trim();
        const tagIdsParam = (searchParams.get("tagIds") || "").trim();
        const regionQuery = (searchParams.get("region") || "").trim();
        const limitParam = searchParams.get("limit");
        const offsetParam = searchParams.get("offset");
        const noCache = searchParams.get("nocache");
        const imagePolicyParam = searchParams.get("imagePolicy");
        const gradeParam = searchParams.get("grade");
        const timeOfDayParam = (searchParams.get("timeOfDay") || "").trim();
        const timeOfDay: "점심" | "저녁" | "야간" | null =
            timeOfDayParam === "점심" || timeOfDayParam === "저녁" || timeOfDayParam === "야간"
                ? timeOfDayParam
                : null;

        const userId = resolveUserId(request);
        let userTier = "FREE";
        let unlockedCourseIds: number[] = [];

        if (userId && Number.isFinite(userId)) {
            const [userResult, unlocksResult] = await Promise.all([
                prisma.user
                    .findUnique({
                        where: { id: userId },
                        select: { subscriptionTier: true },
                    })
                    .catch(() => null),
                (prisma as any).courseUnlock
                    .findMany({ where: { userId }, select: { courseId: true } })
                    .catch(() => []),
            ]);
            if (userResult?.subscriptionTier) {
                userTier = userResult.subscriptionTier;
            }
            unlockedCourseIds = Array.isArray(unlocksResult) ? unlocksResult.map((u: any) => u.courseId) : [];
        }
        const imagePolicy: ImagePolicy = (
            ["any", "all", "none", "all-or-one-missing", "none-or-all"].includes(imagePolicyParam as any)
                ? imagePolicyParam
                : "any"
        ) as ImagePolicy;
        const parsedLimit = Number(limitParam ?? 30);
        let effectiveLimit = Math.min(Math.max(parsedLimit, 1), 100);
        const parsedOffset = Number(offsetParam ?? 0);
        const effectiveOffset = Math.max(parsedOffset, 0);

        // [수정] limit이 있어도 필터가 없으면 기본 로드를 수행하도록 조건 완화
        const isDefaultLoad = !q && !concept && !regionQuery && !tagIdsParam && !gradeParam;

        const courseSelect = {
            id: true,
            title: true,
            title_en: true,
            title_ja: true,
            title_zh: true,
            sub_title: true,
            description: true,
            description_en: true,
            description_ja: true,
            description_zh: true,
            duration: true,
            region: true,
            imageUrl: true,
            concept: true,
            grade: true,
            rating: true,
            view_count: true,
            createdAt: true,
            // 🔥 태그 데이터
            mood: true,
            target: true,
            goal: true,
            budget_range: true,
            tags: true,
            coursePlaces: {
                orderBy: { order_index: "asc" as const },
                select: {
                    order_index: true,
                    segment: true,
                    place: {
                        select: {
                            id: true,
                            name: true,
                            imageUrl: true,
                            latitude: true,
                            longitude: true,
                            opening_hours: true,
                            reservationUrl: true,
                            closed_days: {
                                select: { day_of_week: true, specific_date: true, note: true },
                            },
                        },
                    },
                },
            },
            // 🟢 [Fix]: 장소 개수를 위한 _count 추가
            _count: { select: { coursePlaces: true } },
        };

        // 잠금은 요청한 사용자 기준. 캐시(Redis)는 등급별로 공유되므로 꺼낸 뒤에도 다시 계산한다
        // (구매한 코스가 다른 사람 캐시의 잠금 상태로 나가거나, 남의 구매가 열려 보이지 않게)
        const isLockedFor = (courseId: number | string, grade: string) => {
            if (unlockedCourseIds.includes(Number(courseId)) || userTier === "PREMIUM") return false;
            if (userTier === "BASIC") return grade === "PREMIUM";
            // FREE 유저는 BASIC, PREMIUM 코스 모두 잠금
            return grade === "BASIC" || grade === "PREMIUM";
        };
        const withLock = (list: any[]) => list.map((c) => ({ ...c, isLocked: isLockedFor(c.id, c.grade || "FREE") }));

        const formatCourse = (course: any) => {
            if (!course || !course.id) return null;
            const firstPlaceImage = Array.isArray(course?.coursePlaces)
                ? course.coursePlaces.find((cp: any) => cp?.place?.imageUrl)?.place?.imageUrl
                : undefined;
            const resolvedImageUrl = course.imageUrl || firstPlaceImage || "";
            const courseGrade = course.grade || "FREE";
            const isLocked = isLockedFor(course.id, courseGrade);

            return {
                id: String(course.id),
                title: course.title || "제목 없음",
                title_en: course.title_en || null,
                title_ja: course.title_ja || null,
                title_zh: course.title_zh || null,
                sub_title: course.sub_title || undefined,
                description: course.description || "",
                description_en: course.description_en || null,
                description_ja: course.description_ja || null,
                description_zh: course.description_zh || null,
                duration: course.duration || "",
                location: course.region || "",
                imageUrl: resolvedImageUrl,
                concept: course.concept || "",
                grade: courseGrade,
                isLocked,
                rating: Number(course.rating) || 0,
                view_count: course.view_count || 0,
                createdAt: course.createdAt || new Date().toISOString(),
                tags: [],
                tagData: {
                    mood: course.mood || [],
                    target: course.target || [],
                    goal: course.goal || undefined,
                    budget: course.budget_range || undefined,
                },
                coursePlaces: Array.isArray(course.coursePlaces)
                    ? course.coursePlaces.map((cp: any) => ({
                          order_index: cp.order_index,
                          place: cp.place
                              ? {
                                    ...cp.place,
                                    latitude: Number(cp.place.latitude),
                                    longitude: Number(cp.place.longitude),
                                    reservationUrl: cp.place.reservationUrl || null,
                                    closed_days: cp.place.closed_days || [],
                                }
                              : null,
                      }))
                    : [],
                // 🟢 [Fix]: _count에서 장소 개수를 확실하게 가져오기 (take 제한과 무관하게)
                placesCount: course._count?.coursePlaces ?? (course.coursePlaces?.length || 0),
            };
        };

        if (isDefaultLoad) {
            // 전체 공개 코스를 한 순서로 만들고 offset으로 잘라 줌 (첫 페이지·다음 페이지가 같은 순서)
            const cacheKey = `courses_def_v8:${imagePolicy}:${userTier}:${timeOfDay || ""}`;
            let cached = noCache ? null : await defaultCache.get<any[]>(cacheKey);
            if (!cached) {
                const allRaw = await prisma.course.findMany({
                    where: { isPublic: true, ...notExpiredCourseWhere() },
                    take: MAX_LIST_COURSES,
                    orderBy: { id: "desc" },
                    select: courseSelect,
                });
                const filteredRaw = filterCoursesByImagePolicy(allRaw as unknown as CourseWithPlaces[], imagePolicy);
                const ordered = interleaveByGrade(filteredRaw as any[]);
                sortCoursesByTimeMatch(ordered, timeOfDay);
                cached = ordered.map(formatCourse).filter(Boolean);
                if (!noCache) await defaultCache.set(cacheKey, cached);
            }
            const finalData = withLock(cached!.slice(effectiveOffset, effectiveOffset + effectiveLimit));
            return NextResponse.json({ data: finalData, isRecommendation: false });
        }

        // [수정] 비-기본 로드 시 필터 쿼리 로직 명시적 추가
        const andWhere: any[] = [{ isPublic: true }, notExpiredCourseWhere()];
        if (concept) andWhere.push({ concept: { contains: concept, mode: "insensitive" } }); // 🟢 case-insensitive로 변경
        if (gradeParam) andWhere.push({ grade: gradeParam });
        if (regionQuery) {
            // "합정·용산" → ['합정', '용산'] 토큰 분리 후 OR 조건
            const regionTokens = regionQuery
                .split(/[·,\/\s]+/)
                .map((t) => t.trim())
                .filter((t) => t.length >= 2);
            if (regionTokens.length > 1) {
                andWhere.push({ OR: regionTokens.map((token) => ({ region: { contains: token, mode: "insensitive" } })) });
            } else {
                andWhere.push({ region: { contains: regionQuery, mode: "insensitive" } });
            }
        }
        if (q) {
            andWhere.push({
                OR: [
                    { title: { contains: q, mode: "insensitive" } },
                    { description: { contains: q, mode: "insensitive" } },
                    { region: { contains: q, mode: "insensitive" } },
                ],
            });
        }
        // 🟢 [Performance]: 캐시 키 생성 (필터별로 캐싱)
        const cacheKey = `courses_filter:${concept || ""}:${q || ""}:${regionQuery || ""}:${tagIdsParam || ""}:${
            gradeParam || ""
        }:${effectiveLimit}:${effectiveOffset}:${userTier}:${timeOfDay || ""}`;

        // 🟢 캐시에서 먼저 확인 (동기 함수)
        if (!noCache) {
            const cached = await defaultCache.get<{ data: any[]; isRecommendation: boolean }>(cacheKey);
            if (cached) {
                return NextResponse.json({ ...cached, data: withLock(cached.data ?? []) });
            }
        }

        const results = await prisma.course.findMany({
            where: { AND: andWhere },
            orderBy: { id: "desc" },
            take: effectiveLimit,
            skip: effectiveOffset,
            select: courseSelect,
        });

        const finalFiltered = filterCoursesByImagePolicy(results as unknown as CourseWithPlaces[], imagePolicy);
        sortCoursesByTimeMatch(finalFiltered, timeOfDay);
        const formattedCourses = finalFiltered.map(formatCourse).filter(Boolean);

        const responseData = { data: formattedCourses, isRecommendation: false };

        // 🟢 [Performance]: 응답 데이터 캐싱 (60초) - 동기 함수
        if (!noCache) {
            await defaultCache.set(cacheKey, responseData, 60 * 1000);
        }

        return NextResponse.json(responseData);
    } catch (error: any) {
            captureApiError(error);
        return NextResponse.json({ error: "Server Error", message: error.message }, { status: 500 });
    }
}
