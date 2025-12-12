// app/sitemap.ts
import { MetadataRoute } from "next";

// Prisma import - 프로젝트에 맞게 아래 중 하나 선택하세요
// Option 1: @/lib/prisma
// import prisma from '@/lib/prisma';

// Option 2: @/lib/db
// import prisma from '@/lib/db';

// Option 3: @prisma/client를 직접 사용
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Course 타입 정의
type CourseData = {
    id: number;
    updatedAt: Date | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dona.io.kr";

    try {
        // DB에서 모든 코스 가져오기
        const courses: CourseData[] = await prisma.course.findMany({
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
                url: `${baseUrl}/personalized-home`,
                lastModified: new Date(),
                changeFrequency: "daily",
                priority: 0.85,
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

        return [...staticPages, ...coursePages];
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
                url: `${baseUrl}/personalized-home`,
                lastModified: new Date(),
                changeFrequency: "daily",
                priority: 0.85,
            },
        ];
    }
}
