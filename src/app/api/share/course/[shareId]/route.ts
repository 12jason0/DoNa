import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getMergedTipsFromRow } from "@/types/tip";

export const dynamic = "force-dynamic";

/**
 * GET /api/share/course/[shareId]
 * 공유 미리보기용 코스 데이터 (비로그인 허용)
 * - tips 통합 필드로 팁 포함
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ shareId: string }> }
) {
    try {
        const { shareId } = await params;
        if (!shareId?.trim()) {
            return NextResponse.json({ error: "shareId required" }, { status: 400 });
        }

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
                                tips: true,
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

        if (!shared) {
            return NextResponse.json({ error: "Share not found" }, { status: 404 });
        }

        const course = shared.templateCourse;
        const allPlaces = course?.coursePlaces ?? [];
        const selectedPlaceIds = shared.selectedPlaceIds ?? [];

        const byPlaceId = new Map<number, any>();
        allPlaces.forEach((cp: any) => byPlaceId.set(cp.place_id, cp));

        let places: any[];
        if (selectedPlaceIds.length > 0) {
            places = selectedPlaceIds
                .map((pid, idx) => {
                    const cp = byPlaceId.get(pid);
                    if (!cp?.place) return null;
                    return { ...cp, order_index: idx };
                })
                .filter((x): x is any => x != null);
        } else {
            places = allPlaces;
        }

        const coursePlacesOut = places.map((cp: any) => ({
            id: cp.id,
            place_id: cp.place_id,
            order_index: cp.order_index ?? cp.order_index,
            segment: cp.segment,
            order_in_segment: cp.order_in_segment,
            tips: getMergedTipsFromRow(cp),
            recommended_time: cp.recommended_time ?? null,
            place: cp.place
                ? {
                    id: cp.place.id,
                    name: cp.place.name,
                    address: cp.place.address,
                    description: cp.place.description,
                    category: cp.place.category,
                    imageUrl: cp.place.imageUrl,
                    latitude: cp.place.latitude,
                    longitude: cp.place.longitude,
                }
                : null,
        }));

        return NextResponse.json({
            shareId: shared.id,
            templateCourseId: shared.templateCourseId,
            isSelectionType: course?.isSelectionType ?? false,
            selectedPlaceIds: shared.selectedPlaceIds,
            title: course?.title ?? "",
            description: course?.description ?? "",
            sub_title: course?.sub_title ?? null,
            imageUrl: course?.imageUrl ?? null,
            region: course?.region ?? null,
            coursePlaces: coursePlacesOut,
        });
    } catch (e) {
        console.error("[share/course GET]", e);
        return NextResponse.json({ error: "Failed to fetch shared course" }, { status: 500 });
    }
}
