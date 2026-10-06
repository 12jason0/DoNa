import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CourseSharePreviewClient from "./CourseSharePreviewClient";
import prisma from "@/lib/db";
import { getTipCategoriesFromRow } from "@/types/tip";
import {
    fetchCourseFieldsForOpenGraph,
    paidCourseShareDescription,
    resolveCourseImageAbsoluteForOg,
} from "@/lib/courseOpenGraph";
import { cookies, headers } from "next/headers";
import {
    SHARE_DEVICE_COOKIE,
    claimShareDevice,
    daysLeftKst,
    isCrawlerUA,
    userHasCourseAccess,
} from "@/lib/shareAccess";

// 열람권·만료·기기 수를 매번 서버에서 확인 (캐시 금지)
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** 공유 링크 카드: 코스 제목·사진, 설명은 /courses/[id]/view와 같은 규칙 (유료는 장소 이름 숨김) */
export async function generateMetadata({ params }: { params: Promise<{ shareId: string }> }): Promise<Metadata> {
    const { shareId } = await params;
    const shared = await prisma.sharedCourse
        .findUnique({ where: { id: shareId }, select: { templateCourseId: true } })
        .catch(() => null);
    const course = shared ? await fetchCourseFieldsForOpenGraph(String(shared.templateCourseId)) : null;
    // 링크 열람권으로 유료 내용이 보일 수 있으니 검색엔진 색인 금지 (카톡 미리보기용 OG는 유지)
    const robots = { index: false, follow: false };
    if (!course) return { robots };

    const isPaid = course.grade === "BASIC" || course.grade === "PREMIUM";
    const description =
        (isPaid && paidCourseShareDescription(course)) ||
        (!isPaid && course.description?.trim().slice(0, 200)) ||
        course.sub_title?.trim() ||
        "특별한 데이트를 위한 맞춤 코스 추천";
    const image = resolveCourseImageAbsoluteForOg(course.firstPlaceImageUrl, course.imageUrl);
    return {
        title: { absolute: `${course.title} | 두나 DoNa` },
        description,
        robots,
        openGraph: { title: course.title, description, url: `/share/course/${shareId}`, images: [image] },
        twitter: { card: "summary_large_image", title: course.title, description, images: [image] },
    };
}

async function getSharedCourseData(shareId: string, viewer: { deviceId?: string; userAgent: string | null }) {
    const shared = await prisma.sharedCourse.findUnique({
        where: { id: shareId },
        include: {
            templateCourse: {
                select: {
                    id: true,
                    title: true,
                    description: true,
                    sub_title: true,
                    imageUrl: true,
                    region: true,
                    grade: true,
                    isSelectionType: true,
                    coursePlaces: {
                        orderBy: { order_index: "asc" },
                        select: {
                            id: true,
                            place_id: true,
                            order_index: true,
                            segment: true,
                            order_in_segment: true,
                            tips: true,
                            tips_en: true,
                            tips_ja: true,
                            tips_zh: true,
                            recommended_time: true,
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
                },
            },
        },
    });
    if (!shared) return null;
    const course = shared.templateCourse;
    const allPlaces = course?.coursePlaces ?? [];
    const selectedPlaceIds = shared.selectedPlaceIds ?? [];
    const byPlaceId = new Map(allPlaces.map((cp: any) => [cp.place_id, cp]));
    const allResolved =
        selectedPlaceIds.length > 0
            ? selectedPlaceIds
                  .map((pid: number, idx: number) => {
                      const cp = byPlaceId.get(pid);
                      if (!cp?.place) return null;
                      return { ...cp, order_index: idx };
                  })
                  .filter(Boolean)
            : allPlaces;

    const isFree = course?.grade === "FREE";
    const isPremium = course?.grade === "PREMIUM";
    const totalPlaceCount = allResolved.length;

    // 링크 열람권: 생성 시 공유자 권한 + 미만료 + 지금도 공유자에게 권한 있음(환불·구독 만료 대응) + 기기 5대 이내
    // 크롤러(카톡 미리보기 등)는 기기 수에서 빼고 잠긴 화면만
    const hasLinkGrant = shared.sharerHasAccess && !!shared.expiresAt;
    const isExpired = hasLinkGrant && shared.expiresAt! <= new Date();
    let lockReason: "expired" | "devices" | null = isExpired ? "expired" : null;
    let fullAccess = false;
    if (
        hasLinkGrant &&
        !isExpired &&
        !isCrawlerUA(viewer.userAgent) &&
        (await userHasCourseAccess(shared.sharedByUserId, shared.templateCourseId))
    ) {
        fullAccess = await claimShareDevice(shared.id, viewer.deviceId);
        if (!fullAccess) lockReason = "devices";
    }
    const sharer = shared.sharedByUserId
        ? await prisma.user.findFirst({
              where: { id: shared.sharedByUserId, deletedAt: null },
              select: { username: true },
          })
        : null;
    const places = isFree || fullAccess ? allResolved : allResolved.slice(0, 1);

    return {
        shareId: shared.id,
        templateCourseId: shared.templateCourseId,
        isSelectionType: course?.isSelectionType ?? false,
        selectedPlaceIds: shared.selectedPlaceIds,
        title: course?.title ?? "",
        description: course?.description ?? "",
        sub_title: course?.sub_title ?? null,
        imageUrl: course?.imageUrl ?? null,
        region: course?.region ?? null,
        isLocked: !isFree && !fullAccess && totalPlaceCount > 1,
        isPremium,
        totalPlaceCount,
        fullAccess,
        hideCourseLink: fullAccess && !isFree,
        lockReason,
        sharerName: sharer?.username?.trim() || null,
        daysLeft: fullAccess ? daysLeftKst(shared.expiresAt!) : null,
        coursePlaces: places.map((cp: any) => ({
            id: cp.id,
            place_id: cp.place_id,
            order_index: cp.order_index,
            segment: cp.segment,
            order_in_segment: cp.order_in_segment,
            // 팁 원문은 링크 열람권이 유효할 때만. 아니면 카테고리 칩만 (유료 팁 유출 방지)
            tipCategories: getTipCategoriesFromRow(cp),
            ...(fullAccess
                ? { tips: cp.tips ?? null, tips_en: cp.tips_en ?? null, tips_ja: cp.tips_ja ?? null, tips_zh: cp.tips_zh ?? null }
                : {}),
            recommended_time: cp.recommended_time ?? null,
            place: cp.place
                ? {
                      ...cp.place,
                      closed_days: cp.place.closed_days ?? [],
                  }
                : null,
        })),
    };
}

export default async function ShareCoursePage({
    params,
}: {
    params: Promise<{ shareId: string }>;
}) {
    const { shareId } = await params;
    if (!shareId?.trim()) notFound();

    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
    const data = await getSharedCourseData(shareId, {
        deviceId: cookieStore.get(SHARE_DEVICE_COOKIE)?.value,
        userAgent: headerStore.get("user-agent"),
    });
    if (!data) notFound();

    return <CourseSharePreviewClient data={data} shareId={shareId} />;
}
