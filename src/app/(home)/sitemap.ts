// app/sitemap.ts
import { MetadataRoute } from "next";
// 요청마다 새 PrismaClient를 만들면 커넥션이 누수되므로 프로젝트 공용 싱글톤을 사용
import prisma from "@/lib/db";
import { areaPath, areasByCourseCount, courseInRegion } from "@/lib/regionIntro";

// 빌드 때 한 번만 만들지 않고 1시간마다 다시 생성 → 새 코스·지역·장소가 배포 없이 반영
export const revalidate = 3600;

// Course 타입 정의
type CourseData = {
    id: number;
    updatedAt: Date | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dona.io.kr";

    try {
        // DB에서 모든 코스 가져오기
        // 공개 코스만 (비공개 코스는 페이지가 열려도 검색에 올리지 않음)
        const courses: CourseData[] = await prisma.course.findMany({
            where: { isPublic: true },
            select: {
                id: true,
                updatedAt: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        // 정적 페이지들 (핵심 페이지들)
        const staticPages: MetadataRoute.Sitemap = [
            {
                url: baseUrl,
                lastModified: new Date(),
                changeFrequency: "daily",
                priority: 1.0,
            },
            {
                url: `${baseUrl}/courses`,
                lastModified: new Date(),
                changeFrequency: "daily",
                priority: 0.9,
            },
            {
                url: `${baseUrl}/escape`,
                lastModified: new Date(),
                changeFrequency: "daily",
                priority: 0.9,
            },
            {
                // AEO 허브 페이지 (두나 공식 설명서) — 크롤러가 빠르게 발견하도록 상위 우선순위
                url: `${baseUrl}/guide`,
                lastModified: new Date(),
                changeFrequency: "weekly",
                priority: 0.9,
            },
            {
                // 팝업·전시 모음 (기간 한정 장소, 매일 바뀜)
                url: `${baseUrl}/popups`,
                lastModified: new Date(),
                changeFrequency: "daily",
                priority: 0.8,
            },
            {
                url: `${baseUrl}/map`,
                lastModified: new Date(),
                changeFrequency: "weekly",
                priority: 0.7,
            },
        ];

        // 동적 코스 페이지들
        const coursePages: MetadataRoute.Sitemap = courses.map((course: CourseData) => ({
            url: `${baseUrl}/courses/${course.id}`,
            lastModified: course.updatedAt || new Date(),
            changeFrequency: "weekly",
            priority: 0.8,
        }));

        // 동네 페이지: regions 테이블 동네 중 공개 코스가 있는 곳, 코스 많은 순 (/area/[area]와 같은 조건)
        const [regions, publicCourses, places] = await Promise.all([
            prisma.region.findMany({ select: { name: true } }),
            prisma.course.findMany({ where: { isPublic: true }, select: { region: true, updatedAt: true } }),
            // 장소 페이지: 공개 코스에 쓰인 published 장소, 영구 폐업 제외 (/places/[id]와 같은 조건 + 폐업 noindex)
            prisma.place.findMany({
                where: {
                    status: "published",
                    NOT: { place_status: "CLOSED_PERMANENTLY" },
                    coursePlaces: { some: { course: { isPublic: true } } },
                },
                select: { id: true, updated_at: true },
            }),
        ]);
        const regionPages: MetadataRoute.Sitemap = areasByCourseCount(
            regions.map((r) => r.name),
            publicCourses.map((c) => c.region),
        ).map(({ name }) => {
            const inRegion = publicCourses.filter((c) => courseInRegion(c.region, name));
            return {
                url: `${baseUrl}${areaPath(name)}`,
                lastModified: new Date(Math.max(...inRegion.map((c) => c.updatedAt.getTime()))),
                changeFrequency: "weekly" as const,
                priority: 0.8,
            };
        });
        const placePages: MetadataRoute.Sitemap = places.map((p) => ({
            url: `${baseUrl}/places/${p.id}`,
            lastModified: p.updated_at,
            changeFrequency: "monthly",
            priority: 0.6,
        }));

        return [...staticPages, ...coursePages, ...regionPages, ...placePages];
    } catch (error) {
        console.error("Sitemap generation error:", error);

        // DB 연결 실패 시 최소한의 정적 페이지만 반환
        return [
            {
                url: baseUrl,
                lastModified: new Date(),
                changeFrequency: "daily",
                priority: 1.0,
            },
            {
                url: `${baseUrl}/courses`,
                lastModified: new Date(),
                changeFrequency: "daily",
                priority: 0.9,
            },
            {
                url: `${baseUrl}/escape`,
                lastModified: new Date(),
                changeFrequency: "daily",
                priority: 0.9,
            },
            {
                url: `${baseUrl}/guide`,
                lastModified: new Date(),
                changeFrequency: "weekly",
                priority: 0.9,
            },
            {
                // 팝업·전시 모음 (기간 한정 장소, 매일 바뀜)
                url: `${baseUrl}/popups`,
                lastModified: new Date(),
                changeFrequency: "daily",
                priority: 0.8,
            },
        ];
    }
}
