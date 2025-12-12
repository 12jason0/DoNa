import { Suspense } from "react";
import NearbyClient from "./NearbyClient";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

async function getInitialNearbyCourses(searchParams: { [key: string]: string | string[] | undefined }) {
    // 1. URL 파라미터 파싱
    const q = typeof searchParams?.q === "string" ? searchParams.q : undefined;
    const region = typeof searchParams?.region === "string" ? searchParams.region : undefined;
    const keyword = (q || region || "").trim();

    const concept = typeof searchParams?.concept === "string" ? searchParams.concept.trim() : undefined;
    const tagIdsParam = typeof searchParams?.tagIds === "string" ? searchParams.tagIds.trim() : undefined;

    // 2. 검색 조건 구성 (AND 조건 배열)
    const andConditions: any[] = [];

    // (A) 키워드 검색
    if (keyword) {
        andConditions.push({
            OR: [
                { region: { contains: keyword, mode: "insensitive" } },
                { title: { contains: keyword, mode: "insensitive" } },
                {
                    coursePlaces: {
                        some: {
                            place: {
                                OR: [
                                    { address: { contains: keyword, mode: "insensitive" } },
                                    { name: { contains: keyword, mode: "insensitive" } },
                                ],
                            },
                        },
                    },
                },
            ],
        });
    }

    // (B) 컨셉 필터
    if (concept) {
        andConditions.push({
            concept: { contains: concept, mode: "insensitive" },
        });
    }

    // (C) 태그 필터 [수정됨: tags -> courseTags]
    if (tagIdsParam) {
        const tagIds = tagIdsParam
            .split(",")
            .map(Number)
            .filter((n) => !isNaN(n) && n > 0);
        if (tagIds.length > 0) {
            andConditions.push({
                courseTags: {
                    // schema.prisma의 Course 모델 필드명
                    some: {
                        tagId: {
                            // schema.prisma의 CourseTagRelation 모델 컬럼명
                            in: tagIds,
                        },
                    },
                },
            });
        }
    }

    // 최종 Where 절
    const whereClause = andConditions.length > 0 ? { AND: andConditions } : {};

    const courseSelect = {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        region: true,
        concept: true,
        // ❌ viewCount: true (삭제)
        view_count: true, // ✅ DB 컬럼명 (snake_case)

        // ❌ reviewCount: true (삭제 - DB에 없는 필드)
        _count: {
            // ✅ Prisma 집계 기능으로 리뷰 개수 가져오기
            select: { reviews: true },
        },

        rating: true,
        coursePlaces: {
            orderBy: { order_index: "asc" as const },
            select: {
                order_index: true,
                place: {
                    select: {
                        id: true,
                        name: true,
                        imageUrl: true,
                        latitude: true,
                        longitude: true,
                        address: true,
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
    };

    // 4. DB 조회 실행
    const courses = await prisma.course.findMany({
        where: whereClause,
        orderBy: { id: "desc" },
        take: 100,
        select: courseSelect,
    });

    // 5. 데이터 매핑 (Client 컴포넌트 타입에 맞춤)
    return courses.map((c: any) => ({
        id: String(c.id),
        title: c.title,
        description: c.description,
        imageUrl: c.imageUrl,
        concept: c.concept,
        region: c.region,

        // ✅ DB의 snake_case를 클라이언트의 camelCase로 매핑
        viewCount: c.view_count || 0,

        // ✅ _count에서 리뷰 개수를 꺼내옴
        reviewCount: c._count?.reviews || 0,

        rating: c.rating || 0,
        coursePlaces: c.coursePlaces.map((cp: any) => ({
            order_index: cp.order_index,
            place: cp.place
                ? {
                      id: cp.place.id,
                      name: cp.place.name,
                      imageUrl: cp.place.imageUrl,
                      latitude: cp.place.latitude ? Number(cp.place.latitude) : undefined,
                      longitude: cp.place.longitude ? Number(cp.place.longitude) : undefined,
                      address: cp.place.address,
                      opening_hours: cp.place.opening_hours,
                      closed_days: cp.place.closed_days || [],
                  }
                : null,
        })),
        location: c.region,
    }));
}

export default async function NearbyPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const resolvedParams = await Promise.resolve(searchParams);

    // DB에서 데이터 가져오기
    const initialCourses = await getInitialNearbyCourses(resolvedParams);

    const initialKeyword = (resolvedParams?.q as string) || (resolvedParams?.region as string) || "";

    return (
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
            <NearbyClient initialCourses={initialCourses} initialKeyword={initialKeyword} />
        </Suspense>
    );
}
