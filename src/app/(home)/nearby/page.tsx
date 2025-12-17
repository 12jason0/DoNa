import { Suspense } from "react";
import NearbyClient from "./NearbyClient";
import prisma from "@/lib/db";
import { cookies } from "next/headers";
import { verifyJwtAndGetUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getInitialNearbyCourses(searchParams: { [key: string]: string | string[] | undefined }) {
    // 1. URL 파라미터 파싱
    const q = typeof searchParams?.q === "string" ? searchParams.q : undefined;
    const region = typeof searchParams?.region === "string" ? searchParams.region : undefined;
    const keywordRaw = (q || region || "").trim();

    const concept = typeof searchParams?.concept === "string" ? searchParams.concept.trim() : undefined;
    const tagIdsParam = typeof searchParams?.tagIds === "string" ? searchParams.tagIds.trim() : undefined;

    const andConditions: any[] = [];

    // ✅ 공개된 코스만 필터링
    andConditions.push({ isPublic: true });

    // ✅ 장소 이름(name)과 주소(address)까지 검색 범위 확장
    if (keywordRaw) {
        const keywords = keywordRaw.split(/\s+/).filter(Boolean);
        keywords.forEach((k) => {
            const cleanKeyword = k.replace("동", "");

            andConditions.push({
                OR: [
                    // 1. 코스 자체 정보 검색
                    { region: { contains: cleanKeyword, mode: "insensitive" } },
                    { title: { contains: cleanKeyword, mode: "insensitive" } },
                    { concept: { contains: cleanKeyword, mode: "insensitive" } },
                    { description: { contains: cleanKeyword, mode: "insensitive" } },

                    // 2. 코스 안에 포함된 "장소" 검색
                    {
                        coursePlaces: {
                            some: {
                                place: {
                                    OR: [
                                        { name: { contains: cleanKeyword, mode: "insensitive" } },
                                        { address: { contains: cleanKeyword, mode: "insensitive" } },
                                    ],
                                },
                            },
                        },
                    },
                ],
            });
        });
    }

    // (B) 컨셉 필터
    if (concept) {
        andConditions.push({
            concept: { contains: concept, mode: "insensitive" },
        });
    }

    // (C) 태그 필터
    if (tagIdsParam) {
        const tagIds = tagIdsParam
            .split(",")
            .map(Number)
            .filter((n) => !isNaN(n) && n > 0);
        if (tagIds.length > 0) {
            andConditions.push({
                courseTags: {
                    some: {
                        tagId: { in: tagIds },
                    },
                },
            });
        }
    }

    // 최종 Where 절
    const whereClause = andConditions.length > 0 ? { AND: andConditions } : {};

    // 4. DB 조회 실행 - 필요한 필드만 선택
    const courses = await prisma.course.findMany({
        where: whereClause,
        orderBy: { id: "desc" },
        take: 100,
        select: {
            id: true,
            title: true,
            description: true,
            imageUrl: true,
            region: true,
            concept: true,
            view_count: true,
            rating: true,
            grade: true,
            _count: {
                select: { reviews: true },
            },
            // 리스트에서는 첫 번째 장소의 이미지만 필요
            coursePlaces: {
                take: 1,
                orderBy: { order_index: "asc" as const },
                select: {
                    order_index: true,
                    place: {
                        select: {
                            id: true,
                            name: true,
                            imageUrl: true,
                            // address, latitude, longitude, opening_hours, closed_days는 리스트에서 불필요
                        },
                    },
                },
            },
        },
    });

    // ✅ [유저 등급 확인]
    const cookieStore = await cookies();
    const token = cookieStore.get("auth")?.value;
    let userTier = "FREE";

    if (token) {
        try {
            const userId = verifyJwtAndGetUserId(token);
            if (userId) {
                const user = await prisma.user.findUnique({
                    where: { id: Number(userId) },
                    select: { subscriptionTier: true },
                });
                if (user) {
                    userTier = user.subscriptionTier;
                }
            }
        } catch (e) {
            // 토큰이 유효하지 않은 경우 무시 (FREE로 유지)
        }
    }

    // 5. 데이터 매핑 & 잠금 계산 & 정렬
    const mappedCourses = courses.map((c: any) => {
        // 잠금 계산
        let isLocked = false;
        const courseGrade = c.grade || "FREE";

        if (userTier === "PREMIUM") {
            isLocked = false;
        } else if (userTier === "BASIC") {
            if (courseGrade === "PREMIUM") isLocked = true;
        } else {
            // FREE 유저
            if (courseGrade === "BASIC" || courseGrade === "PREMIUM") isLocked = true;
        }

        return {
            id: String(c.id),
            title: c.title,
            description: c.description,
            imageUrl: c.imageUrl || c.coursePlaces?.[0]?.place?.imageUrl || "",
            concept: c.concept,
            region: c.region,
            viewCount: c.view_count || 0,
            reviewCount: c._count?.reviews || 0,
            rating: c.rating || 0,
            grade: courseGrade,
            isLocked: isLocked, // ✅ 잠금 상태 전달
            // 리스트에서는 장소 상세 정보 불필요 (이미지만 사용)
            coursePlaces: c.coursePlaces.map((cp: any) => ({
                order_index: cp.order_index,
                place: cp.place
                    ? {
                          id: cp.place.id,
                          name: cp.place.name,
                          imageUrl: cp.place.imageUrl,
                      }
                    : null,
            })),
            location: c.region,
        };
    });

    // ✅ 6. [정렬] FREE > BASIC > PREMIUM 순서
    const gradeWeight: Record<string, number> = {
        FREE: 1,
        BASIC: 2,
        PREMIUM: 3,
    };

    mappedCourses.sort((a, b) => {
        const weightA = gradeWeight[a.grade] || 1;
        const weightB = gradeWeight[b.grade] || 1;
        return weightA - weightB;
    });

    return mappedCourses;
}

export default async function NearbyPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const resolvedParams = await Promise.resolve(searchParams);
    const initialCourses = await getInitialNearbyCourses(resolvedParams);

    // 초기 검색어 (UI 표시용)
    const initialKeyword =
        (typeof resolvedParams?.q === "string" ? resolvedParams.q : "") ||
        (typeof resolvedParams?.region === "string" ? resolvedParams.region : "") ||
        "";

    return (
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
            <NearbyClient initialCourses={initialCourses} initialKeyword={initialKeyword} />
        </Suspense>
    );
}
