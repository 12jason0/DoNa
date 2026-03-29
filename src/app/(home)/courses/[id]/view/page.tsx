import type { Metadata } from "next";
import {
    fetchCourseFieldsForOpenGraph,
    resolveCourseImageAbsoluteForOg,
} from "@/lib/courseOpenGraph";
import CourseViewRedirect from "./CourseViewRedirect";

/** 매 요청에서 OG 메타 생성 (크롤러·카카오 캐시와 맞물려 최신 코스 이미지 반영) */
export const dynamic = "force-dynamic";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://dona.io.kr").replace(/\/$/, "");

const defaultDescription = "특별한 데이트를 위한 맞춤 코스 추천";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const cleanId = id.startsWith("c-") ? id.replace("c-", "") : id;
    const metadataBase = new URL(`${siteUrl}/`);
    const course = await fetchCourseFieldsForOpenGraph(cleanId);
    if (!course) {
        return {
            metadataBase,
            title: "두나 DoNa - 데이트 코스 추천",
            description: defaultDescription,
        };
    }

    const ogImage = resolveCourseImageAbsoluteForOg(course.firstPlaceImageUrl, course.imageUrl);
    const description =
        (course.description && course.description.trim().slice(0, 200)) ||
        (course.sub_title && course.sub_title.trim()) ||
        defaultDescription;
    const pageTitle = `${course.title} | 두나 DoNa`;
    const canonical = `${siteUrl}/courses/${cleanId}`;
    const shareUrl = `${siteUrl}/courses/${cleanId}/view`;

    return {
        metadataBase,
        title: pageTitle,
        description,
        alternates: { canonical },
        openGraph: {
            title: course.title,
            description,
            url: shareUrl,
            siteName: "두나 DoNa",
            type: "website",
            locale: "ko_KR",
            images: [{ url: ogImage, width: 1200, height: 630, alt: course.title }],
        },
        twitter: {
            card: "summary_large_image",
            title: course.title,
            description,
            images: [ogImage],
        },
    };
}

export default async function ViewPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const cleanId = id.startsWith("c-") ? id.replace("c-", "") : id;
    return <CourseViewRedirect href={`/courses/${cleanId}`} />;
}
