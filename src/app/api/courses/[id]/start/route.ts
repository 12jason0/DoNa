import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 🟢 가이드 페이지(시작) 전용 API - 최소한의 필드만 반환
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let courseId: number | null = null;
    try {
        const { id } = await params;
        courseId = Number(id);

        if (!courseId || isNaN(courseId)) {
            return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
        }

        const userId = resolveUserId(request);
        let userTier = "FREE";
        let hasUnlocked = false;

        if (userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { subscriptionTier: true },
            });
            if (user?.subscriptionTier) userTier = user.subscriptionTier;

            try {
                const unlock = await (prisma as any).courseUnlock.findFirst({
                    where: { userId: userId, courseId: courseId },
                });
                hasUnlocked = !!unlock;
            } catch (e) {
                console.warn("[Auth] CourseUnlock check failed:", e);
            }
        }

        // 🟢 가이드 페이지에 필요한 최소한의 데이터만 조회
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            select: {
                id: true,
                title: true,
                grade: true,
                region: true,
                imageUrl: true,
                coursePlaces: {
                    orderBy: { order_index: "asc" },
                    select: {
                        id: true,
                        order_index: true,
                        coaching_tip: true,
                        place: {
                            select: {
                                id: true,
                                name: true,
                                imageUrl: true,
                            },
                        },
                    },
                },
            },
        });

        if (!course) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        const courseGrade = course.grade || "FREE";
        
        // 🔒 권한 판정: FREE 코스이거나, PREMIUM 유저이거나, BASIC 유저가 BASIC 코스에 접근하거나, 쿠폰으로 구매한 경우만 접근 허용
        const hasAccess =
            courseGrade === "FREE" || // 무료 코스
            userTier === "PREMIUM" || // PREMIUM 유저는 모든 코스 접근
            (userTier === "BASIC" && courseGrade === "BASIC") || // BASIC 유저는 BASIC 코스만 접근
            hasUnlocked; // 쿠폰으로 구매한 경우 (FREE 유저도 해당 코스 접근 가능)

        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied", isLocked: true }, { status: 403 });
        }

        const coursePlacesArray = Array.isArray(course.coursePlaces) ? course.coursePlaces : [];

        // 🟢 디버깅: Prisma 쿼리 결과 전체 확인
        console.log("[START API] Raw coursePlacesArray:", JSON.stringify(coursePlacesArray, null, 2));
        if (coursePlacesArray.length > 0) {
            console.log("[START API] First coursePlace raw:", JSON.stringify(coursePlacesArray[0], null, 2));
            console.log("[START API] First place object:", JSON.stringify(coursePlacesArray[0]?.place, null, 2));
        }

        // 🟢 가이드 페이지용 데이터 구조
        const coursePlaces = coursePlacesArray
            .map((cp: any) => {
                if (!cp || !cp.place) {
                    console.log("[START API] Skipping coursePlace - no place:", cp);
                    return null;
                }

                const coachingTip = cp.coaching_tip || null;

                // 🟢 디버깅: 실제로 받아온 데이터 확인
                console.log("[START API] Raw place data:", {
                    placeId: cp.place.id,
                    placeName: cp.place.name,
                    placeNameType: typeof cp.place.name,
                    placeNameValue: cp.place.name,
                    hasName: !!cp.place.name,
                    placeImageUrl: cp.place.imageUrl,
                    fullPlaceObject: cp.place
                });

                return {
                    order_index: cp.order_index,
                    movement_guide: null, // DB에 필드가 없으므로 null
                    place: {
                        id: cp.place.id,
                        name: cp.place.name || null,
                        imageUrl: cp.place.imageUrl || null,
                        coaching_tip: coachingTip, // place 객체에 coaching_tip 포함
                    },
                };
            })
            .filter((cp: any) => cp !== null);

        // 🟢 디버깅: region 값 확인 및 첫 번째 장소 name 확인
        console.log("[START API] Course region:", course.region);
        if (coursePlaces.length > 0) {
            console.log("[START API] First coursePlace place.name:", coursePlaces[0]?.place?.name);
            console.log("[START API] First coursePlace full:", JSON.stringify(coursePlaces[0], null, 2));
        }

        const payload = {
            id: String(course.id),
            title: course.title || "",
            region: course.region || null,
            imageUrl: course.imageUrl || null,
            coursePlaces,
        };

        console.log("[START API] Payload region:", payload.region);

        return NextResponse.json(payload);
    } catch (error: any) {
        console.error("🔴 [START API ERROR]:", {
            message: error.message,
            stack: error.stack,
            courseId: courseId ?? "unknown",
            errorName: error.name,
        });
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: error.message || "Unknown error",
                details: process.env.NODE_ENV === "development" ? error.stack : undefined,
            },
            { status: 500 }
        );
    }
}

