import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getMergedTipsFromRow } from "@/types/tip";
import { captureApiError } from "@/lib/sentry";

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

        let allResolved: any[];
        if (selectedPlaceIds.length > 0) {
            allResolved = selectedPlaceIds
                .map((pid, idx) => {
                    const cp = byPlaceId.get(pid);
                    if (!cp?.place) return null;
                    return { ...cp, order_index: idx };
                })
                .filter((x): x is any => x != null);
        } else {
            allResolved = allPlaces;
        }

        const isPremium = (course as any)?.grade === "PREMIUM";
        const totalCount = allResolved.length;
        const places = allResolved.slice(0, 1);

        const coursePlacesOut = places.map((cp: any) => ({
            id: cp.id,
            place_id: cp.place_id,
            order_index: cp.order_index ?? cp.order_index,
            segment: cp.segment,
            order_in_segment: cp.order_in_segment,
            tips: getMergedTipsFromRow(cp),
            tips_en: cp.tips_en ?? null,
            tips_ja: cp.tips_ja ?? null,
            tips_zh: cp.tips_zh ?? null,
            recommended_time: cp.recommended_time ?? null,
            place: cp.place
                ? {
                    id: cp.place.id,
                    name: cp.place.name,
                    name_en: cp.place.name_en ?? null,
                    name_ja: cp.place.name_ja ?? null,
                    name_zh: cp.place.name_zh ?? null,
                    address: cp.place.address,
                    address_en: cp.place.address_en ?? null,
                    address_ja: cp.place.address_ja ?? null,
                    address_zh: cp.place.address_zh ?? null,
                    description: cp.place.description,
                    description_en: cp.place.description_en ?? null,
                    description_ja: cp.place.description_ja ?? null,
                    description_zh: cp.place.description_zh ?? null,
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
            isLocked: totalCount > 1,
            isPremium,
            totalCount,
            coursePlaces: coursePlacesOut,
        });
    } catch (e) {
            captureApiError(e);
        console.error("[share/course GET]", e);
        return NextResponse.json({ error: "Failed to fetch shared course" }, { status: 500 });
    }
}
