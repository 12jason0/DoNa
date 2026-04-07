// src/app/(home)/courses/[id]/page.tsx

import { Suspense } from "react";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import { cookies } from "next/headers";
import { verifyJwtAndGetUserId } from "@/lib/auth";
import CourseDetailClient, { CourseData } from "./CourseDetailClient"; // 🟢 [Fix] CourseData 타입 임포트 추가
import { unstable_cache } from "next/cache";
import { COURSE_DETAIL_SENTINELS } from "@/lib/courseDetailSentinels";

// 🟢 [Fix]: 데이터베이스 연결 재시도 헬퍼 (아이패드 연결 풀 타임아웃 문제 해결)
async function retryDatabaseOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 500,
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;

            // 🟢 연결 풀 타임아웃이나 연결 실패 에러인 경우에만 재시도
            const isRetryableError =
                error?.code === "P2024" || // Connection pool timeout
                error?.message?.includes("Can't reach database server") ||
                error?.message?.includes("connection pool");

            if (!isRetryableError || attempt === maxRetries) {
                throw error;
            }

            // 🟢 지수 백오프 (exponential backoff)
            const delay = delayMs * Math.pow(2, attempt - 1);
            console.warn(`[Database Retry] 시도 ${attempt}/${maxRetries} 실패, ${delay}ms 후 재시도...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError || new Error("Database operation failed after retries");
}

// 🟢 [404 Fix] 캐시 없는 직접 DB 조회 (캐시된 null 우회용)
async function fetchCourseFromDb(id: string): Promise<CourseData | null> {
    const courseId = Number(id);
    if (isNaN(courseId)) return null;
    try {
        const course = await retryDatabaseOperation(async () => {
            return await (prisma as any).course.findUnique({
                where: { id: courseId },
                select: {
                    id: true,
                    title: true,
                    title_en: true,
                    title_ja: true,
                    title_zh: true,
                    description: true,
                    region: true,
                    sub_title: true,
                    target_situation: true,
                    duration: true,
                    imageUrl: true,
                    concept: true,
                    rating: true,
                    isPopular: true,
                    grade: true,
                    isSelectionType: true,
                    createdAt: true,
                    updatedAt: true,
                    mood: true,
                    goal: true,
                    budget_range: true,
                    tags: true,
                    highlights: {
                        select: { id: true, title: true, description: true, icon: true },
                    },
                    coursePlaces: {
                        orderBy: { order_index: "asc" },
                        select: {
                            id: true,
                            course_id: true,
                            place_id: true,
                            order_index: true,
                            segment: true,
                            order_in_segment: true,
                            estimated_duration: true,
                            recommended_time: true,
                            tips: true,
                            tips_en: true,
                            tips_ja: true,
                            tips_zh: true,
                            place: {
                                select: {
                                    id: true,
                                    name: true,
                                    name_en: true,
                                    name_ja: true,
                                    name_zh: true,
                                    address: true,
                                    address_en: true,
                                    address_ja: true,
                                    address_zh: true,
                                    description: true,
                                    description_en: true,
                                    description_ja: true,
                                    description_zh: true,
                                    category: true,
                                    avg_cost_range: true,
                                    opening_hours: true,
                                    phone: true,
                                    parking_available: true,
                                    reservation_required: true,
                                    reservationUrl: true,
                                    latitude: true,
                                    longitude: true,
                                    imageUrl: true,
                                    closed_days: {
                                        select: { day_of_week: true, specific_date: true, note: true },
                                    },
                                },
                            },
                        },
                    },
                    courseDetail: {
                        select: {
                            recommended_start_time: true,
                            season: true,
                            course_type: true,
                            transportation: true,
                        },
                    },
                    _count: { select: { coursePlaces: true } },
                },
            });
        });

        if (!course) return null;

        const courseDetail = course.courseDetail || null;
        const highlights = course.highlights || [];
        const coursePlaces = course.coursePlaces || [];

        return {
            id: String(course.id),
            title: course.title,
            title_en: course.title_en || null,
            title_ja: course.title_ja || null,
            title_zh: course.title_zh || null,
            description: course.description || "",
            region: course.region || null,
            sub_title: course.sub_title || null,
            target_situation: course.target_situation || null,
            budget_range: course.budget_range || null,
            duration: course.duration || COURSE_DETAIL_SENTINELS.duration,
            price: "",
            imageUrl: course.imageUrl || "",
            concept: course.concept || "",
            rating: Number(course.rating),
            isPopular: course.isPopular,
            grade: course.grade || "FREE",
            isSelectionType: !!course.isSelectionType,
            recommended_start_time:
                courseDetail?.recommended_start_time || COURSE_DETAIL_SENTINELS.recommended_start_time,
            season: courseDetail?.season || COURSE_DETAIL_SENTINELS.season,
            courseType: courseDetail?.course_type || COURSE_DETAIL_SENTINELS.courseType,
            transportation: courseDetail?.transportation || COURSE_DETAIL_SENTINELS.transportation,
            reservationRequired: coursePlaces.some((cp: any) => cp.place?.reservation_required) || false,
            createdAt: course.createdAt.toISOString(),
            updatedAt: course.updatedAt.toISOString(),
            highlights: highlights,
            tags: {
                ...((course.tags as any) || {}),
                mood: course.mood || [],
                goal: course.goal || undefined,
                budget: course.budget_range || undefined,
                target: (course.tags as any)?.target || [],
            },
            coursePlaces: coursePlaces.map((cp: any) => ({
                ...cp,
                segment: cp.segment ?? null,
                order_in_segment: cp.order_in_segment ?? null,
                place: cp.place
                    ? {
                          ...cp.place,
                          reservationUrl: cp.place.reservationUrl || null,
                          latitude: cp.place.latitude ? Number(cp.place.latitude) : null,
                          longitude: cp.place.longitude ? Number(cp.place.longitude) : null,
                          closed_days: cp.place.closed_days || [],
                      }
                    : null,
            })),
        };
    } catch {
        return null;
    }
}

// 1. 데이터 페칭 함수 (코스 정보 캐싱) - 🟢 성능 최적화: select 사용으로 필요한 필드만 가져오기
const getCourse = unstable_cache(
    async (id: string): Promise<CourseData | null> => {
        const result = await fetchCourseFromDb(id);
        if (result) return result;
        // 🟢 null은 캐시하지 않음: null 반환 시 호출부에서 revalidate + 직접 재조회
        return null;
    },
    [],
    { revalidate: 300, tags: ["course-detail"] }
);

// 🔒 권한 확인 함수 (60초 캐시 - 열람권 구매 후 최대 60초 내 반영)
const getUserPermissionCached = unstable_cache(
    async (userIdNum: number, courseId: number): Promise<{ userTier: string; hasUnlocked: boolean }> => {
        try {
            const [user, unlockRecord] = await Promise.all([
                prisma.user
                    .findUnique({
                        where: { id: userIdNum },
                        select: { subscriptionTier: true },
                    })
                    .catch(() => null),
                (prisma as any).courseUnlock
                    .findFirst({
                        where: { userId: userIdNum, courseId },
                        select: { id: true },
                    })
                    .catch(() => null),
            ]);
            return {
                userTier: user?.subscriptionTier || "FREE",
                hasUnlocked: !!unlockRecord,
            };
        } catch {
            return { userTier: "FREE", hasUnlocked: false };
        }
    },
    ["course-user-permission"],
    { revalidate: 60, tags: ["course-user-permission"] }
);

// 2. 메인 페이지 컴포넌트
export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    // 🟢 "c-" 접두사 제거 (지도 페이지에서 "c-55" 형식으로 전달되는 경우 처리)
    const cleanId = id.startsWith("c-") ? id.replace("c-", "") : id;
    const courseId = Number(cleanId); // ID를 확실하게 숫자로 변환

    // 🟢 [1단계: 데이터 병렬 조회] 코스 상세 정보와 유저 권한을 동시에 조회하여 성능 최적화
    const [courseDataFromCache, cookieStore] = await Promise.all([
        getCourse(cleanId),
        cookies(),
    ]);
    let courseData = courseDataFromCache;

    // 🟢 [404 Fix] 캐시에서 null이 나오면 직접 DB 재조회 (revalidateTag는 렌더 중 호출 불가)
    if (!courseData) {
        courseData = await fetchCourseFromDb(cleanId);
    }

    if (!courseData) {
        notFound();
    }

    // 🔒 [2단계: 서버 세션 기반 권한 검증] httpOnly Cookie를 통한 보안 강화
    const token = cookieStore.get("auth")?.value;
    let userTier = "FREE";
    let hasUnlocked = false;

    if (token) {
        try {
            const userIdStr = verifyJwtAndGetUserId(token);
            if (userIdStr) {
                const userIdNum = Number(userIdStr);
                if (!isNaN(userIdNum) && userIdNum > 0) {
                    const permission = await getUserPermissionCached(userIdNum, courseId);
                    userTier = permission.userTier;
                    hasUnlocked = permission.hasUnlocked; // 열람권 구매 여부 확인
                }
            }
        } catch (e) {
            // 토큰이 유효하지 않은 경우 무시 (FREE로 유지)
            console.warn("[courses/[id]/page.tsx] JWT 검증 실패:", e instanceof Error ? e.message : String(e));
        }
    }
    // 🔒 [권한 판정 (Gatekeeping)] 4가지 조건 중 하나라도 충족하면 canAccess = true
    const courseGrade = (courseData.grade || "FREE").toUpperCase();
    const currentUserTier = userTier.toUpperCase();

    // 🔒 핵심: '열람권 구매(hasUnlocked)'를 가장 먼저 체크하여 등급에 상관없이 허용
    const canAccess =
        courseGrade === "FREE" || // 1. 무료 코스인가?
        hasUnlocked === true || // 2. 열람권으로 구매했는가? (FREE 유저라도 OK) - 최우선 체크
        (currentUserTier === "BASIC" && courseGrade === "BASIC") || // 3. BASIC 유저의 BASIC 코스인가?
        currentUserTier === "PREMIUM"; // 4. 모든 권한을 가진 PREMIUM 유저인가?

    // 팁은 BASIC 이상 또는 열람권 구매 유저만 표시 (FREE 유저는 FREE 코스도 팁 비공개)
    const hasTipAccess = currentUserTier === "PREMIUM" || currentUserTier === "BASIC" || hasUnlocked;

    const isLocked = !canAccess;
    const secureCourseData = (() => {
        const getTips = (cp: any) => {
            if (cp.tips != null && String(cp.tips).trim()) return hasTipAccess ? cp.tips : null;
            return null;
        };
        return isLocked
            ? {
                  ...courseData,
                  isLocked,
                  description: "",
                  sub_title: null,
                  highlights: [],
                  recommended_start_time: COURSE_DETAIL_SENTINELS.recommended_start_time,
                  season: COURSE_DETAIL_SENTINELS.season,
                  courseType: COURSE_DETAIL_SENTINELS.courseType,
                  transportation: COURSE_DETAIL_SENTINELS.transportation,
                  coursePlaces:
                      courseData.coursePlaces?.map((cp: any) => ({
                          ...cp,
                          estimated_duration: null,
                          recommended_time: null,
                          tips: null,
                          place: cp.place
                              ? {
                                    id: cp.place.id,
                                    name: cp.place.name,
                                    category: cp.place.category,
                                    imageUrl: cp.place.imageUrl,
                                    address: null,
                                    description: null,
                                    avg_cost_range: null,
                                    opening_hours: null,
                                    phone: null,
                                    parking_available: null,
                                    reservation_required: null,
                                    reservationUrl: null,
                                    latitude: null,
                                    longitude: null,
                                    closed_days: [],
                                }
                              : null,
                      })) || [],
                  reservationRequired: false,
              }
            : {
                  ...courseData,
                  isLocked,
                  coursePlaces:
                      courseData.coursePlaces?.map((cp: any) => ({
                          ...cp,
                          tips: getTips(cp),
                          place: cp.place ? { ...cp.place } : null,
                      })) || [],
              };
    })();

    // 🟢 최적화: 리뷰는 클라이언트에서 필요할 때만 로드
    return (
        <CourseDetailClient
            courseData={secureCourseData}
            initialReviews={[]}
            courseId={cleanId}
            userTier={currentUserTier}
        />
    );
}
