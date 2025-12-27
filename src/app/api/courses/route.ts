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
        const concept = searchParams.get("concept");
        const q = (searchParams.get("q") || "").trim();
        const tagIdsParam = (searchParams.get("tagIds") || "").trim();
        const regionQuery = searchParams.get("region");
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

        // 🟢 [원본 로직 유지] 초기 로드 5:3:2 비율 로직 판단 조건
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
                tags: Array.isArray(course?.courseTags)
                    ? course.courseTags.map((ct: any) => ct?.tag?.name).filter(Boolean)
                    : [],
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

        // 🟢 [원본 로직 유지] 컨셉, 지역, 태그 필터링
        if (concept) {
            const tokens = concept
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            if (tokens.length > 0) {
                andWhere.push({
                    OR: [
                        { concept: { contains: concept, mode: "insensitive" } },
                        {
                            courseDetail: {
                                is: { OR: tokens.map((t) => ({ course_type: { contains: t, mode: "insensitive" } })) },
                            },
                        },
                    ],
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
                include: {
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
                                },
                            },
                        },
                    },
                },
            });
            if (!noCache) defaultCache.set(cacheKey, results);
        }

        if (!Array.isArray(results)) {
            return NextResponse.json([], { status: 200 });
        }

        // 🟢 [원본 로직 유지] 이미지 정책 필터 및 등급별 정렬
        const filtered = filterCoursesByImagePolicy(results as CourseWithPlaces[], imagePolicy);
        const finalData = filtered.map(formatCourse).filter((course) => course !== null);
        const gradeWeight: Record<string, number> = { FREE: 1, BASIC: 2, PREMIUM: 3 };
        finalData.sort((a, b) => (gradeWeight[a.grade] || 1) - (gradeWeight[b.grade] || 1));

        return NextResponse.json(finalData);
    } catch (error) {
        console.error("GET Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
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
