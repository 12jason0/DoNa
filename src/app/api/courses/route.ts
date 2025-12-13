import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { filterCoursesByImagePolicy, type ImagePolicy, type CourseWithPlaces } from "@/lib/imagePolicy";
import { sendPushNotificationToAll, sendPushNotificationToUsers } from "@/lib/push-notifications";
import { getUserIdFromRequest } from "@/lib/auth";
import { getUserPreferenceSet } from "@/lib/userProfile";
import { defaultCache } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 300;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
    try {
        console.log(">>> API 함수 진입");
        console.log("--- [START] /api/courses GET 요청 수신 ---");

        const { searchParams } = new URL(request.url);
        const concept = searchParams.get("concept");
        const q = (searchParams.get("q") || "").trim();
        const tagIdsParam = (searchParams.get("tagIds") || "").trim(); // comma-separated ids
        const regionQuery = searchParams.get("region");
        const limitParam = searchParams.get("limit");
        const offsetParam = searchParams.get("offset");
        const noCache = searchParams.get("nocache");
        const imagePolicyParam = searchParams.get("imagePolicy");

        // --- 1. 유저 등급 확인 (잠금 여부 계산용) ---
        const userIdStr = getUserIdFromRequest(request);
        let userTier = "FREE"; // 기본값

        if (userIdStr && !isNaN(Number(userIdStr))) {
            // DB에서 유저의 실제 등급 조회
            const user = await prisma.user.findUnique({
                where: { id: Number(userIdStr) },
                select: { subscriptionTier: true },
            });
            if (user?.subscriptionTier) {
                userTier = user.subscriptionTier;
            }
        }

        // --- imagePolicy 안전하게 처리 ---
        const allowedPolicies: ImagePolicy[] = ["any", "all", "none", "all-or-one-missing", "none-or-all"];

        const imagePolicy: ImagePolicy = allowedPolicies.includes(imagePolicyParam as ImagePolicy)
            ? (imagePolicyParam as ImagePolicy)
            : "any"; // 기본값 "any"

        const parsedLimit = Number(limitParam ?? 100);
        const effectiveLimit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 100, 1), 200);
        const parsedOffset = Number(offsetParam ?? 0);
        const effectiveOffset = Math.max(Number.isFinite(parsedOffset) ? parsedOffset : 0, 0);

        // AND로 결합할 동적 where 조건들
        const andWhere: any[] = [];

        // ✅ [필수] 사용자에게는 무조건 "공개된(isPublic: true)" 코스만 보여줍니다.
        andWhere.push({ isPublic: true });

        // ✅ [수정됨] 텍스트 검색 로직 강화: 키워드 분리 및 '동' 제거 매핑
        if (q) {
            const keywords = q.split(/\s+/).filter(Boolean);
            keywords.forEach((keyword) => {
                const cleanKeyword = keyword.replace("동", "");
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
                                            { name: { contains: cleanKeyword, mode: "insensitive" } },
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

        // 활동 필터
        if (concept) {
            const tokens = concept
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
            if (tokens.length > 0) {
                andWhere.push({
                    OR: [
                        { concept: { contains: concept, mode: "insensitive" } },
                        {
                            courseDetail: {
                                is: {
                                    OR: tokens.map((t) => ({
                                        course_type: { contains: t, mode: "insensitive" },
                                    })),
                                },
                            },
                        },
                    ],
                });
            }
        }

        // 지역 필터
        if (regionQuery) {
            andWhere.push({
                region: { contains: regionQuery, mode: "insensitive" },
            });
        }

        // 태그 OR 매칭
        if (tagIdsParam) {
            const tagIdsArr = tagIdsParam
                .split(",")
                .map((v) => Number(v))
                .filter((n) => Number.isFinite(n));
            if (tagIdsArr.length > 0) {
                andWhere.push({
                    CourseTagToCourses: {
                        some: {
                            course_tags: { id: { in: tagIdsArr } },
                        },
                    },
                });
            }
        }

        const prismaQuery: any = {
            where: andWhere.length > 0 ? { AND: andWhere } : {},
            orderBy: [{ id: "desc" }], // DB에서는 최신순으로 가져옴 (이후 JS로 등급순 정렬)
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
                grade: true, // ✅ 등급 정보 가져오기 필수
                courseDetail: { select: { course_type: true } },
                rating: true,
                current_participants: true,
                view_count: true,
                createdAt: true,
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
                                closed_days: {
                                    select: {
                                        day_of_week: true,
                                        specific_date: true,
                                        note: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };

        // --- 캐시 키 구성 ---
        // 유저 등급(userTier)에 따라 잠금 상태가 달라지므로 캐시 키에 포함하지 않으면
        // 다른 등급 유저가 캐시된 데이터를 볼 때 잠금 상태가 잘못 보일 수 있음.
        // 하지만 여기서는 간단히 검색 결과 자체를 캐싱하고, 잠금 로직은 후처리(map)하므로
        // 원본 데이터(results)만 캐싱하면 됩니다.
        const cacheKey = `courses:${concept || "*"}:${regionQuery || "*"}:${q || "*"}:${
            tagIdsParam || "*"
        }:${imagePolicy}:${effectiveLimit}:${effectiveOffset}`;

        let results: any[] | undefined = defaultCache.get<any[]>(cacheKey);
        if (!results) {
            console.log("[LOG] Cache miss → Prisma 쿼리 실행");
            results = await prisma.course.findMany(prismaQuery);
            defaultCache.set(cacheKey, results);
        } else {
            console.log("[LOG] Cache hit → 메모리 캐시 사용");
        }
        console.log(`[LOG] Prisma 쿼리 성공. ${results.length}개 데이터 수신.`);

        const imagePolicyApplied = filterCoursesByImagePolicy(results as CourseWithPlaces[], imagePolicy);

        const formattedCourses = imagePolicyApplied.map((course: any) => {
            const firstPlaceImage = Array.isArray(course?.coursePlaces)
                ? course.coursePlaces.find((cp: any) => cp?.place?.imageUrl)?.place?.imageUrl
                : undefined;
            const resolvedImageUrl = course.imageUrl || firstPlaceImage || "";

            // ✅ 2. [잠금 로직] 유저 등급과 코스 등급 비교
            let isLocked = false;
            const courseGrade = course.grade || "FREE";

            if (userTier === "PREMIUM") {
                // 프리미엄 유저는 모든 코스 열람 가능
                isLocked = false;
            } else if (userTier === "BASIC") {
                // 베이직 유저는 PREMIUM 코스만 잠김
                if (courseGrade === "PREMIUM") isLocked = true;
            } else {
                // 무료 유저는 BASIC, PREMIUM 모두 잠김
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
                grade: courseGrade, // 프론트엔드에서 뱃지 표시용
                isLocked: isLocked, // ✅ 프론트엔드에서 자물쇠 표시용 (boolean)
                rating: Number(course.rating) || 0,
                reviewCount: 0,
                participants: course.current_participants || 0,
                view_count: course.view_count || 0,
                viewCount: course.view_count || 0,
                createdAt: course.createdAt,
                tags: Array.isArray(course?.CourseTagToCourses)
                    ? course.CourseTagToCourses.map((ctc: any) => ctc.course_tags?.name).filter(Boolean)
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
                                    closed_days: Array.isArray(cp.place.closed_days)
                                        ? cp.place.closed_days.map((cd: any) => ({
                                              day_of_week: cd.day_of_week,
                                              specific_date: cd.specific_date,
                                              note: cd.note || null,
                                          }))
                                        : [],
                                }
                              : null,
                      }))
                    : [],
            };
        });

        // ✅ 3. [정렬 로직] FREE > BASIC > PREMIUM 순서로 정렬
        // (같은 등급 내에서는 기존 DB 정렬인 최신순 유지)
        const gradeWeight: Record<string, number> = {
            FREE: 1,
            BASIC: 2,
            PREMIUM: 3,
        };

        formattedCourses.sort((a, b) => {
            const weightA = gradeWeight[a.grade] || 1;
            const weightB = gradeWeight[b.grade] || 1;
            return weightA - weightB; // 오름차순 (1 -> 2 -> 3)
        });

        // --- 개인화 정렬 (옵션) ---
        // (등급 정렬이 우선이라면 아래 로직은 등급 정렬을 덮어쓸 수 있으므로 주의.
        //  현재 요구사항인 '등급순'을 최우선으로 하기 위해 아래 로직은 '같은 등급 내에서' 적용되거나 생략하는 게 좋음.
        //  여기서는 등급 정렬을 유지하기 위해 개인화 점수 정렬은 잠시 주석 처리하거나, 등급 가중치를 더 크게 줘야 함.
        //  일단 요청하신 '등급순'이 확실하므로 아래 블록은 실행하되 등급이 섞이지 않게 조심해야 함.)

        let responseList = formattedCourses;
        /* 개인화 정렬이 등급 순서를 섞어버릴 수 있으므로, 
           사용자가 "검색 결과 순서는 free > basic > premium"이라고 명시했기 때문에
           기존의 개인화 정렬(ViewCount, Rating 기반)은 등급 정렬 완료된 상태를 유지하도록 둡니다.
           만약 개인화가 더 중요하다면 이 주석을 풀고 가중치를 조정해야 합니다.
        */

        console.log("--- [SUCCESS] /api/courses 요청 처리 완료 ---");

        return NextResponse.json(responseList, {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                ...(noCache ? { "Cache-Control": "no-store", Pragma: "no-cache" } : {}),
            },
        });
    } catch (error) {
        console.error("--- [ERROR] /api/courses GET 요청 처리 중 심각한 오류 발생 ---");
        console.error("Full error:", error);

        return new NextResponse(
            JSON.stringify({
                message: "Internal Server Error",
                error: error instanceof Error ? error.message : String(error),
            }),
            { status: 500 }
        );
    }
}

// POST 메서드는 기존과 동일하므로 그대로 둠 (이미 잘 작성됨)
export async function POST(request: NextRequest) {
    try {
        const userIdStr = getUserIdFromRequest(request);
        if (!userIdStr) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const body = await request.json();
        const {
            title,
            description,
            duration,
            location,
            price,
            imageUrl,
            concept,
            sub_title,
            target_situation,
            tags,
            is_editor_pick,
            grade,
            isPublic,
        } = body || {};

        if (!title) {
            return NextResponse.json({ error: "코스 제목은 필수입니다." }, { status: 400 });
        }

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
                userId: Number(userIdStr),
            },
            select: {
                id: true,
                title: true,
                description: true,
                duration: true,
                region: true,
                imageUrl: true,
                concept: true,
                createdAt: true,
            },
        });

        defaultCache.clear?.();

        // 🔔 푸시 알림 로직 (기존 유지)
        try {
            const region = created.region?.trim();
            if (region) {
                const usersByProfile = await prisma.user
                    .findMany({ where: { location: region }, select: { id: true } })
                    .catch(() => [] as { id: number }[]);

                const usersByInteraction = await prisma.userInteraction
                    .findMany({
                        where: { course: { region } },
                        select: { userId: true },
                        distinct: ["userId"],
                    })
                    .catch(() => [] as { userId: number }[]);

                const targetUserIds = Array.from(
                    new Set<number>([...usersByProfile.map((u) => u.id), ...usersByInteraction.map((u) => u.userId)])
                );

                if (targetUserIds.length > 0) {
                    await sendPushNotificationToUsers(
                        targetUserIds,
                        "내 활동 지역에 새 코스가 생겼어요! 🎉",
                        `${created.title} - 지금 확인해보세요`,
                        { screen: "courses", courseId: created.id, region }
                    );
                }
            }
        } catch (error) {
            console.error("푸시 알림 전송 실패:", error);
        }

        return NextResponse.json({ success: true, course: created }, { status: 201 });
    } catch (error) {
        console.error("API: 코스 생성 오류:", error);
        return NextResponse.json({ error: "코스 생성 실패" }, { status: 500 });
    }
}
