import { notFound } from "next/navigation";
import CourseSharePreviewClient from "./CourseSharePreviewClient";
import prisma from "@/lib/db";
import { getMergedTipsFromRow } from "@/types/tip";

async function getSharedCourseData(shareId: string) {
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

    const isPremium = course?.grade === "PREMIUM";
    const totalPlaceCount = allResolved.length;
    const places = allResolved.slice(0, 1);

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
        isLocked: totalPlaceCount > 1,
        isPremium,
        totalPlaceCount,
        coursePlaces: places.map((cp: any) => ({
            id: cp.id,
            place_id: cp.place_id,
            order_index: cp.order_index,
            segment: cp.segment,
            order_in_segment: cp.order_in_segment,
            tips: getMergedTipsFromRow(cp),
            tips_en: cp.tips_en ?? null,
            tips_ja: cp.tips_ja ?? null,
            tips_zh: cp.tips_zh ?? null,
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

    const data = await getSharedCourseData(shareId);
    if (!data) notFound();

    return <CourseSharePreviewClient data={data} shareId={shareId} />;
}
