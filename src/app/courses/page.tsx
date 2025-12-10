import { Suspense } from "react";
import CoursesClient from "./CoursesClient";
import prisma from "@/lib/db";
import { filterCoursesByImagePolicy, type CourseWithPlaces } from "@/lib/imagePolicy";

export const dynamic = "force-dynamic";

async function getInitialCourses(searchParams: { [key: string]: string | string[] | undefined }) {
    // Default params for initial load
    const limit = 100;
    const recommended = searchParams?.recommended === "true";

    // If complex filters are present that are hard to replicate here, we might return empty and let client fetch?
    // But we want to be fast.

    // Simplified query for initial load
    // We replicate the core logic of /api/courses
    const q = typeof searchParams?.q === "string" ? searchParams.q : undefined;
    const concept = typeof searchParams?.concept === "string" ? searchParams.concept : undefined;

    const where: any = {};
    if (q) {
        where.OR = [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { concept: { contains: q, mode: "insensitive" } },
            { region: { contains: q, mode: "insensitive" } },
        ];
    }

    // We ignore complex concept/tag filtering for Server Component initial load to keep it simple and fast.
    // The client component can re-fetch if needed, or we accept that server rendering handles the 'main' list.
    // Actually, if we don't handle 'concept' here, the user clicking a tag and refreshing will get wrong data.
    // Let's handle 'concept' exact match at least, which is what the UI does.
    if (concept) {
        where.concept = { contains: concept, mode: "insensitive" };
    }

    const courses = await prisma.course.findMany({
        where,
        orderBy: { id: "desc" },
        take: limit,
        select: {
            id: true,
            title: true,
            description: true,
            duration: true,
            region: true,
            imageUrl: true,
            concept: true,
            rating: true,
            view_count: true,
            createdAt: true,
            coursePlaces: {
                orderBy: { order_index: "asc" },
                select: {
                    order_index: true,
                    place: {
                        select: {
                            id: true,
                            name: true,
                            imageUrl: true,
                            latitude: true,
                            longitude: true,
                            opening_hours: true,
                            closed_days: {
                                select: {
                                    day_of_week: true,
                                    specific_date: true,
                                    note: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    // Image Policy (default: any)
    const imagePolicyApplied = filterCoursesByImagePolicy(courses as unknown as CourseWithPlaces[], "any");

    return imagePolicyApplied.map((course: any) => ({
        id: String(course.id),
        title: course.title || "제목 없음",
        description: course.description || "",
        duration: course.duration || "",
        location: course.region || "",
        imageUrl: course.imageUrl || course.coursePlaces?.[0]?.place?.imageUrl || "",
        concept: course.concept || "",
        rating: Number(course.rating) || 0,
        reviewCount: 0, // Simplified
        participants: 0,
        viewCount: course.view_count || 0,
        createdAt: course.createdAt ? course.createdAt.toISOString() : undefined,
        coursePlaces:
            course.coursePlaces?.map((cp: any) => ({
                order_index: cp.order_index,
                place: cp.place
                    ? {
                          id: cp.place.id,
                          name: cp.place.name,
                          imageUrl: cp.place.imageUrl,
                          latitude: cp.place.latitude ? Number(cp.place.latitude) : undefined,
                          longitude: cp.place.longitude ? Number(cp.place.longitude) : undefined,
                          opening_hours: cp.place.opening_hours || null,
                          closed_days: cp.place.closed_days || [],
                      }
                    : null,
            })) || [],
    }));
}

export default async function CoursesPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    // Resolve searchParams before using
    const resolvedParams = await Promise.resolve(searchParams);
    const initialCourses = await getInitialCourses(resolvedParams);

    return (
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
            <CoursesClient initialCourses={initialCourses} />
        </Suspense>
    );
}
