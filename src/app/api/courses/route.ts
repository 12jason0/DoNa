import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { filterCoursesByImagePolicy, type ImagePolicy, type CourseWithPlaces } from "@/lib/imagePolicy";
import { resolveUserId } from "@/lib/auth";
import { defaultCache } from "@/lib/cache";

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

        const userId = resolveUserId(request);
        let userTier = "FREE";
        let unlockedCourseIds: number[] = [];

        if (userId && Number.isFinite(userId)) {
            const [userResult, unlocksResult] = await Promise.all([
                prisma.user.findUnique({ where: { id: userId }, select: { subscriptionTier: true } }).catch(() => null),
                (prisma as any).courseUnlock
                    .findMany({ where: { userId }, select: { courseId: true } })
                    .catch(() => []),
            ]);
            if (userResult?.subscriptionTier) userTier = userResult.subscriptionTier;
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
        const isDefaultLoad = effectiveOffset === 0 && !q && !concept && !regionQuery && !tagIdsParam && !gradeParam;

        const courseSelect = {
            id: true,
            title: true,
            description: true,
            duration: true,
            region: true,
            imageUrl: true,
            concept: true,
            grade: true,
            rating: true,
            view_count: true,
            createdAt: true,
            courseTags: { select: { tag: { select: { name: true } } } },
            coursePlaces: {
                orderBy: { order_index: "asc" as const },
                select: {
                    order_index: true,
                    place: {
                        select: {
                            id: true,
                            name: true,
                            imageUrl: true,
                            latitude: true,
                            longitude: true,
                            opening_hours: true,
                            reservationUrl: true,
                        },
                    },
                },
            },
        };

        const formatCourse = (course: any) => {
            if (!course || !course.id) return null;
            const firstPlaceImage = Array.isArray(course?.coursePlaces)
                ? course.coursePlaces.find((cp: any) => cp?.place?.imageUrl)?.place?.imageUrl
                : undefined;
            const resolvedImageUrl = course.imageUrl || firstPlaceImage || "";
            let isLocked = false;
            const courseGrade = course.grade || "FREE";
            const hasUnlocked = unlockedCourseIds.includes(Number(course.id));
            
            // 🟢 iOS 출시 기념 이벤트: Basic 코스 무료 제공
            const userAgent = request.headers.get("user-agent")?.toLowerCase() || "";
            const isIOSPlatform = /iphone|ipad|ipod/.test(userAgent);
            
            if (hasUnlocked || userTier === "PREMIUM") {
                isLocked = false;
            } else if (userTier === "BASIC") {
                if (courseGrade === "PREMIUM") isLocked = true;
            } else {
                // 🟢 iOS: Basic 코스는 무료, Premium만 잠금
                if (isIOSPlatform) {
                    if (courseGrade === "PREMIUM") isLocked = true;
                    // Basic 코스는 isLocked = false (무료)
                } else {
                    if (courseGrade === "BASIC" || courseGrade === "PREMIUM") isLocked = true;
                }
            }

            return {
                id: String(course.id),
                title: course.title || "제목 없음",
                description: course.description || "",
                duration: course.duration || "",
                location: course.region || "",
                imageUrl: resolvedImageUrl,
                concept: course.concept || "",
                grade: courseGrade,
                isLocked,
                rating: Number(course.rating) || 0,
                view_count: course.view_count || 0,
                createdAt: course.createdAt || new Date().toISOString(),
                tags: Array.isArray(course?.courseTags)
                    ? course.courseTags.map((ct: any) => ct?.tag?.name).filter(Boolean)
                    : [],
                coursePlaces: Array.isArray(course.coursePlaces)
                    ? course.coursePlaces.map((cp: any) => ({
                          order_index: cp.order_index,
                          place: cp.place
                              ? {
                                    ...cp.place,
                                    latitude: Number(cp.place.latitude),
                                    longitude: Number(cp.place.longitude),
                                    reservationUrl: cp.place.reservationUrl || null, // 🟢 reservationUrl 명시적으로 포함
                                }
                              : null,
                      }))
                    : [],
            };
        };

        if (isDefaultLoad) {
            const cacheKey = `courses_def_v6:${imagePolicy}:${userTier}`;
            let cached = noCache ? null : defaultCache.get<any[]>(cacheKey);
            if (!cached) {
                const allRaw = await prisma.course.findMany({
                    where: { isPublic: true },
                    take: 60,
                    orderBy: { id: "desc" },
                    select: courseSelect,
                });
                const filteredRaw = filterCoursesByImagePolicy(allRaw as unknown as CourseWithPlaces[], imagePolicy);
                const freeArr = filteredRaw.filter((c) => c.grade === "FREE");
                const basicArr = filteredRaw.filter((c) => c.grade === "BASIC");
                const premiumArr = filteredRaw.filter((c) => c.grade === "PREMIUM");
                const interleaved = [];
                let f = 0,
                    b = 0,
                    p = 0;
                while (
                    interleaved.length < 30 &&
                    (f < freeArr.length || b < basicArr.length || p < premiumArr.length)
                ) {
                    if (f < freeArr.length) interleaved.push(freeArr[f++]);
                    if (f < freeArr.length && interleaved.length < 30) interleaved.push(freeArr[f++]);
                    if (b < basicArr.length && interleaved.length < 30) interleaved.push(basicArr[b++]);
                    if (p < premiumArr.length && interleaved.length < 30) interleaved.push(premiumArr[p++]);
                }
                cached = interleaved.map(formatCourse).filter(Boolean);
                if (!noCache) defaultCache.set(cacheKey, cached);
            }
            // limit이 30보다 작게 들어온 경우 슬라이싱 처리
            const finalData = effectiveLimit < 30 ? cached?.slice(0, effectiveLimit) : cached;
            return NextResponse.json({ data: finalData, isRecommendation: false });
        }

        // [수정] 비-기본 로드 시 필터 쿼리 로직 명시적 추가
        const andWhere: any[] = [{ isPublic: true }];
        if (concept) andWhere.push({ concept: { contains: concept, mode: "insensitive" } }); // 🟢 case-insensitive로 변경
        if (gradeParam) andWhere.push({ grade: gradeParam });
        if (regionQuery) andWhere.push({ region: { contains: regionQuery, mode: "insensitive" } }); // 🟢 case-insensitive로 변경
        if (q) {
            andWhere.push({
                OR: [
                    { title: { contains: q, mode: "insensitive" } },
                    { description: { contains: q, mode: "insensitive" } },
                ],
            });
        }
        if (tagIdsParam) {
            const tagIds = tagIdsParam
                .split(",")
                .map((id) => Number(id.trim()))
                .filter((n) => !isNaN(n));
            if (tagIds.length > 0) {
                andWhere.push({ courseTags: { some: { tagId: { in: tagIds } } } });
            }
        }

        // 🟢 [Performance]: 캐시 키 생성 (필터별로 캐싱)
        const cacheKey = `courses_filter:${concept || ""}:${q || ""}:${regionQuery || ""}:${tagIdsParam || ""}:${
            gradeParam || ""
        }:${effectiveLimit}:${effectiveOffset}:${userTier}`;

        // 🟢 캐시에서 먼저 확인 (동기 함수)
        if (!noCache) {
            const cached = defaultCache.get<{ data: any[]; isRecommendation: boolean }>(cacheKey);
            if (cached) {
                return NextResponse.json(cached);
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
        const formattedCourses = finalFiltered.map(formatCourse).filter(Boolean);

        const responseData = { data: formattedCourses, isRecommendation: false };

        // 🟢 [Performance]: 응답 데이터 캐싱 (60초) - 동기 함수
        if (!noCache) {
            defaultCache.set(cacheKey, responseData, 60 * 1000);
        }

        return NextResponse.json(responseData);
    } catch (error: any) {
        return NextResponse.json({ error: "Server Error", message: error.message }, { status: 500 });
    }
}
