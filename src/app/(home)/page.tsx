import { Suspense } from "react";
import HomeClient from "./HomeClient";
import prisma from "@/lib/db";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { verifyJwtAndGetUserId } from "@/lib/auth";
import { getKSTTodayRange } from "@/lib/kst";
import { getRecommendationDailyLimit } from "@/constants/subscription";

// 비로그인 첫 방문자에게 보여줄 인기 코스 3개 (5분 캐시)
const getInitialRecommendations = unstable_cache(
    async () => {
        const courses = await prisma.course.findMany({
            where: { isPublic: true, grade: "FREE" },
            orderBy: [{ view_count: "desc" }, { id: "desc" }],
            take: 3,
            select: {
                id: true,
                title: true,
                title_en: true,
                title_ja: true,
                title_zh: true,
                imageUrl: true,
                region: true,
                tags: true,
                coursePlaces: {
                    orderBy: { order_index: "asc" as const },
                    take: 1,
                    select: { place: { select: { imageUrl: true } } },
                },
            },
        });
        return courses.map((c) => ({
            id: c.id,
            title: c.title || "",
            title_en: c.title_en || null,
            title_ja: c.title_ja || null,
            title_zh: c.title_zh || null,
            imageUrl: c.imageUrl || c.coursePlaces?.[0]?.place?.imageUrl || null,
            region: c.region || null,
            tags: c.tags,
            coursePlaces: c.coursePlaces,
        }));
    },
    ["home-initial-recommendations"],
    { revalidate: 300, tags: ["home-recommendations"] },
);

export type InitialUserData = {
    nickname: string;
    tier: "FREE" | "BASIC" | "PREMIUM";
    hasSeenConsentModal: boolean;
    activeCourse: {
        courseId: number;
        courseTitle: string;
        title: string;
        title_en: string | null;
        title_ja: string | null;
        title_zh: string | null;
        imageUrl: string | null;
        hasMemory: false;
    } | null;
    canUseRecommendation: boolean;
};

const getCachedUserQueries = unstable_cache(
    async (userId: number, dayStartIso: string) => {
        const start = new Date(dayStartIso);
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
        return Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: { username: true, email: true, subscriptionTier: true, hasSeenConsentModal: true },
            }),
            (prisma.activeCourse as any).findUnique({
                where: { userId },
                select: {
                    startedAt: true, courseId: true,
                    course: {
                        select: {
                            id: true, title: true, title_en: true, title_ja: true, title_zh: true, imageUrl: true,
                            coursePlaces: { orderBy: { order_index: "asc" }, take: 3, select: { place: { select: { imageUrl: true } } } },
                        },
                    },
                },
            }).catch(() => null),
            (prisma as any).aiRecommendationUsage
                .count({ where: { userId, createdAt: { gte: start, lte: end } } })
                .catch(() => 0),
        ]);
    },
    ["home-user-queries"],
    { revalidate: 30 },
);

async function getInitialUserData(token: string): Promise<InitialUserData | null> {
    try {
        const userIdStr = verifyJwtAndGetUserId(token);
        const userId = Number(userIdStr);
        if (!Number.isFinite(userId)) return null;

        const { start, end } = getKSTTodayRange();
        const [user, active, usageCount] = await getCachedUserQueries(userId, start.toISOString());

        if (!user) return null;

        let displayName = user.username || "";
        if (!displayName || displayName.trim() === "" || displayName.trim().startsWith("user_")) {
            displayName = user.email?.split("@")[0] || displayName;
        }

        const tierRaw = user.subscriptionTier?.toUpperCase() || "FREE";
        const tier: "FREE" | "BASIC" | "PREMIUM" =
            tierRaw === "BASIC" || tierRaw === "PREMIUM" ? tierRaw : "FREE";

        const limit = getRecommendationDailyLimit(tier);
        const canUseRecommendation =
            limit === Number.POSITIVE_INFINITY || (usageCount as number) < limit;

        let activeCourseData: InitialUserData["activeCourse"] = null;
        if (active && active.courseId) {
            const startedAt = new Date(active.startedAt);
            if (startedAt >= start && startedAt <= end) {
                const memory = await prisma.review
                    .findFirst({
                        where: { userId, courseId: active.courseId, isPublic: false, createdAt: { gte: start, lte: end } },
                        select: { id: true },
                    })
                    .catch(() => null);

                if (!memory) {
                    const course = active.course;
                    const imageUrl =
                        course?.imageUrl ||
                        course?.coursePlaces?.find((cp: any) => cp?.place?.imageUrl)?.place?.imageUrl ||
                        null;
                    activeCourseData = {
                        courseId: active.courseId,
                        courseTitle: course?.title || "",
                        title: course?.title || "",
                        title_en: course?.title_en || null,
                        title_ja: course?.title_ja || null,
                        title_zh: course?.title_zh || null,
                        imageUrl,
                        hasMemory: false,
                    };
                }
            }
        }

        return {
            nickname: displayName,
            tier,
            hasSeenConsentModal: user.hasSeenConsentModal ?? false,
            activeCourse: activeCourseData,
            canUseRecommendation,
        };
    } catch {
        return null;
    }
}

function HomePlaceholder() {
    return <div className="min-h-screen" aria-hidden="true" />;
}

export default async function Page() {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth")?.value;

    const [initialRecommendations, initialUserData] = await Promise.all([
        getInitialRecommendations(),
        token ? getInitialUserData(token) : Promise.resolve(null),
    ]);

    // LCP 이미지를 SSR 시점에 <head> preload로 주입 — next/image priority보다 먼저 브라우저에 전달
    const lcpImageUrl =
        initialRecommendations[0]?.imageUrl ||
        initialRecommendations[0]?.coursePlaces?.[0]?.place?.imageUrl ||
        null;

    return (
        <>
            {lcpImageUrl && (
                <link rel="preload" as="image" href={lcpImageUrl} fetchPriority="high" />
            )}
            <Suspense fallback={<HomePlaceholder />}>
                <HomeClient initialRecommendations={initialRecommendations} initialUserData={initialUserData} />
            </Suspense>
        </>
    );
}
