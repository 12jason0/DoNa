import prisma from "@/lib/db";
import { getS3StaticUrl } from "@/lib/s3Static";
import { getS3StaticUrlForMetadata } from "@/lib/s3StaticUrl";

/**
 * 카카오/OG 크롤러용 절대 이미지 URL.
 * **1번 장소(order_index 순 첫 이미지)** 우선, 없으면 코스 대표 이미지.
 */
export function resolveCourseImageAbsoluteForOg(
    firstPlaceImageUrl: string | null | undefined,
    courseImageUrl: string | null | undefined,
): string {
    const fallback = getS3StaticUrlForMetadata("logo/donalogo_512.png");
    const raw = (firstPlaceImageUrl?.trim() || courseImageUrl?.trim()) || "";
    if (!raw) return fallback;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    return getS3StaticUrl(raw.replace(/^\//, ""));
}

export type CourseOgFields = {
    title: string;
    description: string | null;
    sub_title: string | null;
    imageUrl: string | null;
    firstPlaceImageUrl: string | null;
};

async function fetchFromDb(cleanId: string): Promise<CourseOgFields | null> {
    const courseId = Number(cleanId);
    if (Number.isNaN(courseId)) return null;
    const course = await (prisma as any).course.findUnique({
        where: { id: courseId },
        select: {
            title: true,
            description: true,
            sub_title: true,
            imageUrl: true,
            coursePlaces: {
                orderBy: { order_index: "asc" },
                select: { place: { select: { imageUrl: true } } },
            },
        },
    });
    if (!course) return null;
    let firstPlaceImageUrl: string | null = null;
    for (const cp of course.coursePlaces ?? []) {
        const u = cp.place?.imageUrl?.trim();
        if (u) {
            firstPlaceImageUrl = u;
            break;
        }
    }
    return {
        title: course.title,
        description: course.description,
        sub_title: course.sub_title,
        imageUrl: course.imageUrl,
        firstPlaceImageUrl,
    };
}

export async function fetchCourseFieldsForOpenGraph(cleanId: string): Promise<CourseOgFields | null> {
    try {
        const fromDb = await fetchFromDb(cleanId);
        if (fromDb) return fromDb;
    } catch (e) {
        if (process.env.NODE_ENV === "development") {
            console.warn("[courseOpenGraph] Prisma failed, trying API fallback:", e);
        }
    }
    const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://dona.io.kr").replace(/\/$/, "");
    try {
        const res = await fetch(`${base}/api/courses/${cleanId}`, {
            headers: { Accept: "application/json" },
            cache: "no-store",
        });
        if (!res.ok) return null;
        const data = (await res.json()) as {
            title?: string;
            description?: string;
            sub_title?: string;
            imageUrl?: string | null;
            coursePlaces?: Array<{ place?: { imageUrl?: string | null } }>;
        };
        let firstPlaceImageUrl: string | null = null;
        for (const cp of data.coursePlaces ?? []) {
            const u = cp.place?.imageUrl?.trim();
            if (u) {
                firstPlaceImageUrl = u;
                break;
            }
        }
        return {
            title: data.title ?? "",
            description: data.description ?? null,
            sub_title: data.sub_title ?? null,
            imageUrl: data.imageUrl ?? null,
            firstPlaceImageUrl,
        };
    } catch (e) {
        if (process.env.NODE_ENV === "development") {
            console.warn("[courseOpenGraph] API fallback failed:", e);
        }
        return null;
    }
}
