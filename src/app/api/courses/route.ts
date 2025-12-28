import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { filterCoursesByImagePolicy, type ImagePolicy, type CourseWithPlaces } from "@/lib/imagePolicy";
import { sendPushNotificationToUsers } from "@/lib/push-notifications";
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

        // 유저 정보 및 티어 조회
        const userId = resolveUserId(request);
        let userTier = "FREE";
        let unlockedCourseIds: number[] = [];

        if (userId && Number.isFinite(userId)) {
            try {
                const [user, unlocks] = await Promise.all([
                    prisma.user.findUnique({
                        where: { id: userId },
                        select: { subscriptionTier: true },
                    }),
                    (prisma as any).courseUnlock.findMany({
                        where: { userId },
                        select: { courseId: true },
                    }),
                ]);
                if (user?.subscriptionTier) userTier = user.subscriptionTier;
                unlockedCourseIds = Array.isArray(unlocks) ? unlocks.map((u: any) => u.courseId) : [];
            } catch (e) {
                console.error("[User/CourseUnlock 조회 실패]", e);
            }
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

        // 🟢 [수정] 필터(concept, tagIds, region)가 하나라도 있으면 초기 로드(5:3:2)를 건너뜀
        const isDefaultLoad = effectiveOffset === 0 && !q && !concept && !regionQuery && !tagIdsParam && !gradeParam;

        // 🟢 [원본 로직 유지] 공통 포맷팅 함수 (safety checks 포함)
        const formatCourse = (course: any) => {
            if (!course || !course.id) {
                console.warn("[formatCourse] Invalid course data:", course);
                return null;
            }

            const firstPlaceImage = Array.isArray(course?.coursePlaces)
                ? course.coursePlaces.find((cp: any) => cp?.place?.imageUrl)?.place?.imageUrl
                : undefined;
            const resolvedImageUrl = course.imageUrl || firstPlaceImage || "";

            let isLocked = false;
            const courseGrade = course.grade || "FREE";
            const courseId = Number(course.id);

            if (!Number.isFinite(courseId)) {
                console.warn("[formatCourse] Invalid course ID:", course.id);
                return null;
            }
            const hasUnlocked = unlockedCourseIds.includes(courseId);

            if (hasUnlocked || userTier === "PREMIUM") {
                isLocked = false;
            } else if (userTier === "BASIC") {
                if (courseGrade === "PREMIUM") isLocked = true;
            } else {
                if (courseGrade === "BASIC" || courseGrade === "PREMIUM") isLocked = true;
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
                isLocked: isLocked,
                rating: Number(course.rating) || 0,
                reviewCount: 0,
                participants: 0,
                view_count: course.view_count || 0,
                viewCount: course.view_count || 0,
                createdAt: course.createdAt || new Date().toISOString(),
                tags: (() => {
                    // courseTags 관계 테이블에서만 태그 추출
                    const tagsFromRelation = Array.isArray(course?.courseTags)
                        ? course.courseTags.map((ct: any) => ct?.tag?.name).filter(Boolean)
                        : [];

                    return tagsFromRelation;
                })(),
                coursePlaces: Array.isArray(course.coursePlaces)
                    ? course.coursePlaces.map((cp: any) => ({
                          order_index: cp.order_index,
                          place: cp.place
                              ? {
                                    id: cp.place.id,
                                    name: cp.place.name,
                                    imageUrl: cp.place.imageUrl,
                                    latitude: cp.place.latitude ? Number(cp.place.latitude) : undefined,
                                    longitude: cp.place.longitude ? Number(cp.place.longitude) : undefined,
                                    opening_hours: cp.place.opening_hours || null,
                                    // reservationUrl: cp.place.reservationUrl || null, // 🟢 임시 주석 처리 - 에러 확인용
                                }
                              : null,
                      }))
                    : [],
            };
        };

        // 🟢 [원본 로직 유지] 5:3:2 비율 초기 로드 로직
        if (isDefaultLoad) {
            const TARGET = { FREE: 15, BASIC: 9, PREMIUM: 6 };
            const commonSelect = {
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
                                // reservationUrl: true, // 🟢 임시 주석 처리 - 에러 확인용
                            },
                        },
                    },
                },
            };

            const [freeRaw, basicRaw, premiumRaw] = await Promise.all([
                prisma.course.findMany({
                    where: { isPublic: true, grade: "FREE" },
                    take: 30,
                    orderBy: { id: "desc" },
                    select: commonSelect as any,
                }),
                prisma.course.findMany({
                    where: { isPublic: true, grade: "BASIC" },
                    take: TARGET.BASIC,
                    orderBy: { id: "desc" },
                    select: commonSelect as any,
                }),
                prisma.course.findMany({
                    where: { isPublic: true, grade: "PREMIUM" },
                    take: TARGET.PREMIUM,
                    orderBy: { id: "desc" },
                    select: commonSelect as any,
                }),
            ]);

            const neededFromFree =
                TARGET.FREE + (TARGET.BASIC - basicRaw.length) + (TARGET.PREMIUM - premiumRaw.length);
            const freeArr = freeRaw.slice(0, Math.max(neededFromFree, 0));

            const interleaved = [];
            let f = 0,
                b = 0,
                p = 0;
            while (interleaved.length < 30 && (f < freeArr.length || b < basicRaw.length || p < premiumRaw.length)) {
                if (f < freeArr.length) interleaved.push(freeArr[f++]);
                if (f < freeArr.length && interleaved.length < 30) interleaved.push(freeArr[f++]);
                if (b < basicRaw.length && interleaved.length < 30) interleaved.push(basicRaw[b++]);
                if (p < premiumRaw.length && interleaved.length < 30) interleaved.push(premiumRaw[p++]);
            }

            const response = interleaved.map(formatCourse).filter((course) => course !== null);
            return NextResponse.json(response);
        }

        // 🟢 [검색 로직] q 파라미터 처리 - 각 키워드를 OR 조건으로 검색하고 AND로 결합
        const andWhere: any[] = [{ isPublic: true }];

        if (q) {
            const keywords = q.split(/\s+/).filter(Boolean);
            keywords.forEach((keyword) => {
                const cleanKeyword = keyword.replace(/동$/, ""); // "성수동" -> "성수"
                andWhere.push({
                    OR: [
                        { title: { contains: cleanKeyword, mode: "insensitive" } },
                        { description: { contains: cleanKeyword, mode: "insensitive" } },
                        { concept: { contains: cleanKeyword, mode: "insensitive" } },
                        { region: { contains: cleanKeyword, mode: "insensitive" } },
                        // courseTags 관계 테이블에서 태그 이름으로 검색
                        {
                            courseTags: {
                                some: {
                                    tag: {
                                        name: { contains: cleanKeyword, mode: "insensitive" },
                                    },
                                },
                            },
                        },
                        {
                            coursePlaces: {
                                some: {
                                    place: {
                                        OR: [
                                            { address: { contains: cleanKeyword, mode: "insensitive" } },
                                            { category: { contains: cleanKeyword, mode: "insensitive" } },
                                        ],
                                    },
                                },
                            },
                        },
                    ],
                });
            });
        }

        // 🟢 [수정] 필터링(concept) 검색 - courseTags 관계 테이블 사용
        if (concept && concept.trim() !== "") {
            const tokens = concept
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            if (tokens.length > 0) {
                // 각 토큰마다 OR 조건 생성 (하나의 토큰이라도 매칭되면 포함)
                tokens.forEach((token) => {
                    andWhere.push({
                        OR: [
                            { concept: { contains: token, mode: "insensitive" } },
                            {
                                courseDetail: {
                                    is: { course_type: { contains: token, mode: "insensitive" } },
                                },
                            },
                            // courseTags 관계 테이블에서 태그 이름으로 검색
                            {
                                courseTags: {
                                    some: {
                                        tag: {
                                            name: { contains: token, mode: "insensitive" },
                                        },
                                    },
                                },
                            },
                        ],
                    });
                });
            }
        }
        if (regionQuery) andWhere.push({ region: { contains: regionQuery, mode: "insensitive" } });
        if (tagIdsParam) {
            const tagIdsArr = tagIdsParam
                .split(",")
                .map((v) => Number(v))
                .filter((n) => Number.isFinite(n));
            if (tagIdsArr.length > 0) {
                andWhere.push({ CourseTagToCourses: { some: { course_tags: { id: { in: tagIdsArr } } } } });
            }
        }
        if (gradeParam === "FREE") andWhere.push({ grade: "FREE" });

        // 🟢 [원본 로직 유지] 캐싱 및 데이터 조회
        const cacheKey = `courses_v2:${concept || "*"}:${regionQuery || "*"}:${q || "*"}:${
            tagIdsParam || "*"
        }:${imagePolicyParam}:${effectiveLimit}:${effectiveOffset}`;
        let results = noCache ? null : defaultCache.get<any[]>(cacheKey);

        if (!results) {
            results = await prisma.course.findMany({
                where: andWhere.length > 0 ? { AND: andWhere } : {},
                orderBy: { id: "desc" },
                take: effectiveLimit,
                skip: effectiveOffset,
                select: {
                    id: true,
                    title: true,
                    description: true,
                    duration: true,
                    region: true,
                    imageUrl: true,
                    concept: true,
                    tags: true, // JSON 필드 포함
                    grade: true,
                    rating: true,
                    view_count: true,
                    createdAt: true,
                    courseTags: { select: { tag: { select: { name: true } } } },
                    coursePlaces: {
                        orderBy: { order_index: "asc" },
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
                                    category: true,
                                    reservationUrl: true,
                                },
                            },
                        },
                    },
                },
            });
            if (!noCache) defaultCache.set(cacheKey, results);
        }

        if (!Array.isArray(results)) {
            return NextResponse.json({ data: [], isRecommendation: false }, { status: 200 });
        }

        // 🟢 [원본 로직 유지] 이미지 정책 필터 및 등급별 정렬
        const filtered = filterCoursesByImagePolicy(results as CourseWithPlaces[], imagePolicy);
        let finalData = filtered.map(formatCourse).filter((course) => course !== null);
        const gradeWeight: Record<string, number> = { FREE: 1, BASIC: 2, PREMIUM: 3 };
        finalData.sort((a, b) => (gradeWeight[a.grade] || 1) - (gradeWeight[b.grade] || 1));

        let isRecommendation = false;

        // 🟢 [상업적 로직] 검색 결과가 0개인 경우 추천 데이터 조회
        if (finalData.length === 0 && effectiveOffset === 0) {
            isRecommendation = true;
            const recommendedRaw = await prisma.course.findMany({
                where: { isPublic: true, is_editor_pick: true },
                take: 4,
                orderBy: { view_count: "desc" },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    duration: true,
                    region: true,
                    imageUrl: true,
                    concept: true,
                    tags: true,
                    grade: true,
                    rating: true,
                    view_count: true,
                    createdAt: true,
                    courseTags: { select: { tag: { select: { name: true } } } },
                    coursePlaces: {
                        orderBy: { order_index: "asc" },
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
                                    category: true,
                                    reservationUrl: true,
                                },
                            },
                        },
                    },
                },
            });
            const recommendedFiltered = filterCoursesByImagePolicy(
                recommendedRaw as unknown as CourseWithPlaces[],
                imagePolicy
            );
            finalData = recommendedFiltered.map(formatCourse).filter((course) => course !== null);
            finalData.sort((a, b) => (gradeWeight[a.grade] || 1) - (gradeWeight[b.grade] || 1));
        }

        return NextResponse.json({ data: finalData, isRecommendation });
    } catch (error: any) {
        console.error("GET Error:", error);
        console.error("GET Error Message:", error?.message);
        console.error("GET Error Stack:", error?.stack);
        console.error("GET Error Code:", error?.code);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: process.env.NODE_ENV === "development" ? error?.message : undefined,
                code: process.env.NODE_ENV === "development" ? error?.code : undefined,
            },
            { status: 500 }
        );
    }
}

// 🟢 [원본 로직 유지] 코스 생성 및 푸시 알림 POST API
export async function POST(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

        const body = await request.json();
        const {
            title,
            description,
            duration,
            location,
            imageUrl,
            concept,
            sub_title,
            target_situation,
            tags,
            is_editor_pick,
            grade,
            isPublic,
        } = body || {};

        if (!title) return NextResponse.json({ error: "제목 필수" }, { status: 400 });

        const created = await prisma.course.create({
            data: {
                title,
                description: description || null,
                duration: duration || null,
                region: location || null,
                imageUrl: imageUrl || null,
                concept: concept || null,
                sub_title: sub_title || null,
                target_situation: target_situation || null,
                is_editor_pick: is_editor_pick || false,
                grade: grade || "FREE",
                isPublic: isPublic ?? true,
                tags: tags || Prisma.JsonNull,
                userId: userId,
            },
        });

        defaultCache.clear?.();

        // 🔔 [원본 유지] 푸시 알림 로직
        try {
            const region = created.region?.trim();
            if (region) {
                const [usersByProfile, usersByInteraction] = await Promise.all([
                    prisma.user.findMany({ where: { location: region }, select: { id: true } }),
                    prisma.userInteraction.findMany({
                        where: { course: { region } },
                        select: { userId: true },
                        distinct: ["userId"],
                    }),
                ]);
                const targetIds = Array.from(
                    new Set([...usersByProfile.map((u) => u.id), ...usersByInteraction.map((u) => u.userId)])
                );
                if (targetIds.length > 0) {
                    await sendPushNotificationToUsers(
                        targetIds,
                        "내 활동 지역에 새 코스가 생겼어요! 🎉",
                        `${created.title} - 지금 확인해보세요`,
                        { screen: "courses", courseId: created.id, region }
                    );
                }
            }
        } catch (e) {
            console.error("Push Error:", e);
        }

        return NextResponse.json({ success: true, course: created }, { status: 201 });
    } catch (error) {
        console.error("POST Error:", error);
        return NextResponse.json({ error: "생성 실패" }, { status: 500 });
    }
}
