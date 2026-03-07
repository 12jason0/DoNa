import { notFound } from "next/navigation";
import CourseSharePreviewClient from "./CourseSharePreviewClient";
import prisma from "@/lib/db";

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
                    isSelectionType: true,
                    coursePlaces: {
                        orderBy: { order_index: "asc" },
                        select: {
                            id: true,
                            place_id: true,
                            order_index: true,
                            segment: true,
                            order_in_segment: true,
                            coaching_tip_free: true,
                            recommended_time: true,
                            place: {
                                select: {
                                    id: true,
                                    name: true,
                                    address: true,
                                    description: true,
                                    category: true,
                                    imageUrl: true,
                                    latitude: true,
                                    longitude: true,
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
    const places =
        selectedPlaceIds.length > 0
            ? selectedPlaceIds
                  .map((pid: number, idx: number) => {
                      const cp = byPlaceId.get(pid);
                      if (!cp?.place) return null;
                      return { ...cp, order_index: idx };
                  })
                  .filter(Boolean)
            : allPlaces;
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
        coursePlaces: places.map((cp: any) => ({
            id: cp.id,
            place_id: cp.place_id,
            order_index: cp.order_index,
            segment: cp.segment,
            order_in_segment: cp.order_in_segment,
            coaching_tip_free: cp.coaching_tip_free ?? null,
            recommended_time: cp.recommended_time ?? null,
            place: cp.place,
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
