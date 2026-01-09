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
        const course = await (prisma as any).course.findUnique({
            where: { id: courseId },
            select: {
                id: true,
                title: true,
                grade: true,
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
                                address: true,
                                latitude: true,
                                longitude: true,
                                imageUrl: true,
                                category: true,
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
        
        // 🟢 iOS: Basic 코스 무료 접근 허용
        const userAgent = request.headers.get("user-agent")?.toLowerCase() || "";
        const isIOSPlatform = /iphone|ipad|ipod/.test(userAgent);
        
        const hasAccess =
            courseGrade === "FREE" || // 무료 코스
            (isIOSPlatform && courseGrade === "BASIC") || // 🟢 iOS: Basic 코스 무료 접근
            userTier === "PREMIUM" || // PREMIUM 유저는 모든 코스 접근
            (userTier === "BASIC" && courseGrade === "BASIC") || // BASIC 유저는 BASIC 코스만 접근
            hasUnlocked; // 쿠폰으로 구매한 경우 (FREE 유저도 해당 코스 접근 가능)

        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied", isLocked: true }, { status: 403 });
        }

        const coursePlacesArray = Array.isArray(course.coursePlaces) ? course.coursePlaces : [];

        // 🟢 가이드 페이지용 데이터 구조
        const coursePlaces = coursePlacesArray
            .map((cp: any) => {
                if (!cp || !cp.place) return null;

                const coachingTip = cp.coaching_tip || null;

                return {
                    order_index: cp.order_index,
                    movement_guide: null, // DB에 필드가 없으므로 null
                    place: {
                        id: cp.place.id,
                        name: cp.place.name,
                        address: cp.place.address || "",
                        latitude: cp.place.latitude ? Number(cp.place.latitude) : null,
                        longitude: cp.place.longitude ? Number(cp.place.longitude) : null,
                        imageUrl: cp.place.imageUrl || null,
                        category: cp.place.category || null,
                        coaching_tip: coachingTip, // place 객체에 coaching_tip 포함
                    },
                };
            })
            .filter((cp: any) => cp !== null);

        const payload = {
            id: String(course.id),
            title: course.title || "",
            coursePlaces,
        };

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

