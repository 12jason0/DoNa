// src/app/(home)/courses/[id]/page.tsx

import { Suspense } from "react";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import { cookies } from "next/headers";
import { verifyJwtAndGetUserId } from "@/lib/auth";
import CourseDetailClient, { CourseData } from "./CourseDetailClient"; // 🟢 [Fix] CourseData 타입 임포트 추가
import { unstable_cache } from "next/cache";

// 1. 데이터 페칭 함수 (코스 정보 캐싱) - 🟢 성능 최적화: select 사용으로 필요한 필드만 가져오기
const getCourse = unstable_cache(
    async (id: string): Promise<CourseData | null> => {
        const courseId = Number(id);
        if (isNaN(courseId)) return null;
        try {
            const course = await (prisma as any).course.findUnique({
                where: { id: courseId },
                select: {
                    id: true,
                    title: true,
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
                    createdAt: true,
                    updatedAt: true,
                    highlights: {
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            icon: true,
                        },
                    },
                    coursePlaces: {
                        orderBy: { order_index: "asc" },
                        select: {
                            id: true,
                            course_id: true,
                            place_id: true,
                            order_index: true,
                            estimated_duration: true,
                            recommended_time: true,
                            coaching_tip: true,
                            place: {
                                select: {
                                    id: true,
                                    name: true,
                                    address: true,
                                    description: true,
                                    category: true,
                                    avg_cost_range: true,
                                    opening_hours: true,
                                    phone: true,
                                    parking_available: true,
                                    reservation_required: true,
                                    reservationUrl: true, // 🟢 예약 URL 추가
                                    latitude: true,
                                    longitude: true,
                                    imageUrl: true,
                                    // 🟢 closed_days는 필요할 때만 별도로 가져오기 (성능 최적화)
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
                    _count: {
                        select: { coursePlaces: true },
                    },
                },
            });
            if (!course) {
                console.error(`[CourseDetail] 코스를 찾을 수 없습니다: ${courseId}`);
                return null;
            }

            // 🟢 에러 처리: courseDetail이 null일 수 있음
            const courseDetail = course.courseDetail || null;
            const highlights = course.highlights || [];
            const coursePlaces = course.coursePlaces || [];

            // 🟢 closed_days는 클라이언트에서 필요할 때만 로드 (성능 최적화: 초기 로드 제거)
            const closedDaysMap: Record<number, any[]> = {};

            return {
                id: String(course.id),
                title: course.title,
                description: course.description || "",
                region: course.region || null,
                sub_title: course.sub_title || null,
                target_situation: course.target_situation || null,
                duration: course.duration || "시간 미정",
                price: "",
                imageUrl: course.imageUrl || "",
                concept: course.concept || "",
                rating: Number(course.rating),
                isPopular: course.isPopular,
                grade: course.grade || "FREE",
                recommended_start_time: courseDetail?.recommended_start_time || "오후 2시",
                season: courseDetail?.season || "사계절",
                courseType: courseDetail?.course_type || "데이트",
                transportation: courseDetail?.transportation || "도보",
                reservationRequired: coursePlaces.some((cp: any) => cp.place?.reservation_required) || false,
                createdAt: course.createdAt.toISOString(),
                updatedAt: course.updatedAt.toISOString(),
                highlights: highlights,
                coursePlaces: coursePlaces.map((cp: any) => ({
                    ...cp,
                    place: cp.place
                        ? {
                              ...cp.place,
                              reservationUrl: cp.place.reservationUrl || null, // 🟢 reservationUrl 명시적으로 포함
                              latitude: cp.place.latitude ? Number(cp.place.latitude) : null,
                              longitude: cp.place.longitude ? Number(cp.place.longitude) : null,
                              closed_days: closedDaysMap[cp.place.id] || [],
                          }
                        : null,
                })),
            };
        } catch (e) {
            console.error(`[CourseDetail] 코스 데이터 로드 실패 (ID: ${id}):`, e);
            return null;
        }
    },
    // 🟢 빈 배열: 함수 파라미터(id)가 자동으로 캐시 키에 포함됨
    [],
    {
        revalidate: 180, // 🟢 성능 최적화: 3분 캐싱 (300 -> 180)
        tags: ["course-detail"],
    }
);

// 🔒 권한 확인 함수 (unstable_cache 제거 - 실시간 DB 조회로 쿠폰 구매 즉시 반영)
// 매 요청마다 실시간으로 DB를 조회하여 쿠폰 구매 즉시 반영되도록 합니다.
const getUserPermission = async (
    userIdNum: number,
    courseId: number
): Promise<{ userTier: string; hasUnlocked: boolean }> => {
    try {
        // 🟢 최적화: 유저 정보와 구매 기록을 한 번에 조회 (병렬 처리)
        const [user, unlockRecord] = await Promise.all([
            prisma.user
                .findUnique({
                    where: { id: userIdNum },
                    select: { subscriptionTier: true },
                })
                .catch((e: any) => {
                    if (process.env.NODE_ENV === "development") {
                        console.error("[getUserPermission] user 조회 오류:", e);
                    }
                    return null;
                }),
            (prisma as any).courseUnlock
                .findFirst({
                    where: {
                        userId: userIdNum,
                        courseId: courseId,
                    },
                    select: { id: true, userId: true, courseId: true }, // 🔒 디버깅을 위해 추가 필드 조회
                })
                .catch((e: any) => {
                    if (process.env.NODE_ENV === "development") {
                        console.error("[getUserPermission] courseUnlock 조회 오류:", e);
                    }
                    return null;
                }),
        ]);

        // 🔒 디버깅: DB 조회 결과 확인 (개발 환경에서만)
        if (process.env.NODE_ENV === "development") {
            console.log("[DB 조회 결과]", {
                userIdNum,
                courseId,
                userIdType: typeof userIdNum,
                courseIdType: typeof courseId,
                unlockRecordFound: !!unlockRecord,
                unlockRecord,
                userFound: !!user,
            });
        }

        return {
            userTier: user?.subscriptionTier || "FREE",
            hasUnlocked: !!unlockRecord,
        };
    } catch (e) {
        console.error("권한 확인 중 오류:", e);
        return { userTier: "FREE", hasUnlocked: false };
    }
};

// 2. 메인 페이지 컴포넌트
export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    // 🟢 "c-" 접두사 제거 (지도 페이지에서 "c-55" 형식으로 전달되는 경우 처리)
    const cleanId = id.startsWith("c-") ? id.replace("c-", "") : id;
    const courseId = Number(cleanId); // ID를 확실하게 숫자로 변환

    // 🟢 [1단계: 데이터 병렬 조회] 코스 상세 정보와 유저 권한을 동시에 조회하여 성능 최적화
    const [courseData, cookieStore] = await Promise.all([
        getCourse(cleanId),
        cookies(), // 🟢 쿠키도 병렬로 가져오기
    ]);

    if (!courseData) {
        console.error(`[CourseDetailPage] 코스 ID ${cleanId}를 찾을 수 없습니다.`);
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
                    // 🟢 실시간 권한 확인 (unstable_cache 제거로 쿠폰 구매 즉시 반영)
                    const permission = await getUserPermission(userIdNum, courseId);
                    userTier = permission.userTier;
                    hasUnlocked = permission.hasUnlocked; // 쿠폰 구매 여부 확인

                    // 🔒 디버깅: 권한 확인 로그 (개발 환경에서만)
                    if (process.env.NODE_ENV === "development") {
                        console.log("[권한 확인]", {
                            userIdNum,
                            courseId,
                            userTier,
                            hasUnlocked,
                            courseGrade: courseData.grade,
                        });
                    }
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

    // 🔒 핵심: '쿠폰 구매(hasUnlocked)'를 가장 먼저 체크하여 등급에 상관없이 허용
    const canAccess =
        courseGrade === "FREE" || // 1. 무료 코스인가?
        hasUnlocked === true || // 2. 쿠폰으로 구매했는가? (FREE 유저라도 OK) - 최우선 체크
        (currentUserTier === "BASIC" && courseGrade === "BASIC") || // 3. BASIC 유저의 BASIC 코스인가?
        currentUserTier === "PREMIUM"; // 4. 모든 권한을 가진 PREMIUM 유저인가?

    // 🔒 팁 표시 권한: BASIC/PREMIUM 유저 또는 쿠폰으로 구매한 경우만 팁 표시 (FREE 코스도 동일)
    const hasTipAccess = currentUserTier === "BASIC" || currentUserTier === "PREMIUM" || hasUnlocked === true;

    const isLocked = !canAccess;

    // 🔒 [3단계: 데이터 마스킹 (Sanitization)] 권한이 없으면 coaching_tip과 상세 주소 정보 삭제
    const secureCourseData = isLocked
        ? {
              ...courseData,
              isLocked,
              description: "", // 마스킹
              sub_title: null, // 마스킹
              highlights: [], // 마스킹
              recommended_start_time: "오후 2시", // 기본값으로 마스킹
              season: "사계절", // 기본값으로 마스킹
              courseType: "데이트", // 기본값으로 마스킹
              transportation: "도보", // 기본값으로 마스킹
              coursePlaces:
                  courseData.coursePlaces?.map((cp: any) => ({
                      ...cp,
                      estimated_duration: null, // 마스킹
                      recommended_time: null, // 마스킹
                      coaching_tip: null, // 마스킹
                      place: cp.place
                          ? {
                                id: cp.place.id,
                                name: cp.place.name, // 허용
                                category: cp.place.category, // 허용
                                imageUrl: cp.place.imageUrl, // 허용
                                // 나머지는 모두 마스킹
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
              reservationRequired: false, // 마스킹
          }
        : {
              ...courseData,
              isLocked,
              // 🔒 FREE 코스의 팁은 클라이언트에서 userTier 체크하여 표시 (버튼/팁 표시 구분)
              // BASIC/PREMIUM 코스는 hasTipAccess에 따라 마스킹
              coursePlaces:
                  courseData.coursePlaces?.map((cp: any) => ({
                      ...cp,
                      coaching_tip:
                          courseGrade === "FREE"
                              ? cp.coaching_tip // FREE 코스: 클라이언트에서 처리
                              : hasTipAccess
                              ? cp.coaching_tip
                              : null, // BASIC/PREMIUM 코스: 권한 체크
                      place: cp.place
                          ? {
                                ...cp.place,
                                coaching_tip:
                                    courseGrade === "FREE"
                                        ? cp.place?.coaching_tip // FREE 코스: 클라이언트에서 처리
                                        : hasTipAccess
                                        ? cp.place?.coaching_tip
                                        : null, // BASIC/PREMIUM 코스: 권한 체크
                            }
                          : null,
                  })) || [],
          };

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
