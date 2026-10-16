import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import prisma from "@/lib/db";
import { getS3StaticUrlForMetadata } from "@/lib/s3StaticUrl";
import ko from "@/i18n/messages/ko/translation.json";
import PartnerClient, { type HeroPhoto, type PartnerCourse } from "./PartnerClient";

// 앱 레이아웃((home)/layout) 밖이라 아이콘·OG를 여기서 직접 지정 (홈과 같은 로고)
const logoUrl = getS3StaticUrlForMetadata("logo/donalogo_512.png");
const TITLE = "두나 광고·제휴";
const DESCRIPTION = "서울 데이트 코스 추천 앱·웹 두나와 인스타그램 @dona.date에 팝업·가게·브랜드를 소개하는 광고·제휴 문의 페이지예요.";

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://dona.io.kr"),
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/partner" },
    openGraph: {
        type: "website",
        siteName: "DoNa",
        locale: "ko_KR",
        url: "/partner",
        title: TITLE,
        description: DESCRIPTION,
        images: [{ url: logoUrl, width: 512, height: 512, alt: "DoNa Logo" }],
    },
    twitter: { card: "summary", title: TITLE, description: DESCRIPTION, images: [logoUrl] },
    icons: { icon: logoUrl, apple: logoUrl, shortcut: logoUrl },
};

export const revalidate = 3600;

/** "소개되는 곳" 카드에 실제 CourseCard로 보여줄 코스 */
const SHOWCASE_COURSE_ID = 6;
const INSTAGRAM_IMAGE = "/partner/instagram.png";
/** 첫 화면 2x2 사진: 직접 찍은 사진이 대표 이미지인 코스 4개 (순서대로) */
const HERO_COURSE_IDS: number[] = [];

/** /api/courses 목록과 같은 모양으로 맞춤 (CourseCard 입력) */
async function getShowcaseCourse(): Promise<PartnerCourse | null> {
    try {
        const c = await prisma.course.findFirst({
            where: { id: SHOWCASE_COURSE_ID, isPublic: true },
            select: {
                id: true,
                title: true,
                title_en: true,
                title_ja: true,
                title_zh: true,
                sub_title: true,
                description: true,
                description_en: true,
                description_ja: true,
                description_zh: true,
                duration: true,
                region: true,
                imageUrl: true,
                concept: true,
                grade: true,
                createdAt: true,
                coursePlaces: {
                    orderBy: { order_index: "asc" },
                    select: { order_index: true, place: { select: { id: true, name: true, imageUrl: true, reservationUrl: true } } },
                },
                _count: { select: { coursePlaces: true } },
            },
        });
        if (!c) return null;
        return {
            id: String(c.id),
            title: c.title,
            title_en: c.title_en,
            title_ja: c.title_ja,
            title_zh: c.title_zh,
            sub_title: c.sub_title || undefined,
            description: c.description || "",
            description_en: c.description_en,
            description_ja: c.description_ja,
            description_zh: c.description_zh,
            duration: c.duration || "",
            location: c.region || "",
            imageUrl: c.imageUrl || c.coursePlaces.find((cp) => cp.place?.imageUrl)?.place?.imageUrl || "",
            concept: c.concept || "",
            grade: c.grade,
            isLocked: false,
            createdAt: c.createdAt.toISOString(),
            coursePlaces: c.coursePlaces.map((cp) => ({
                order_index: cp.order_index,
                place: cp.place ? { ...cp.place, imageUrl: cp.place.imageUrl || undefined } : null,
            })),
            placesCount: c._count.coursePlaces,
        };
    } catch (e) {
        console.error("/partner 코스 조회 실패:", e);
        return null;
    }
}

/** 사이트 푸터(LayoutContent)와 같은 사업자 정보 */
const w = ko.webLanding;
const BUSINESS = {
    title: ko.mypage.profileTab.businessInfo,
    lines: [
        [w.businessLabelTrade, w.businessValueTrade],
        [w.businessLabelCeo, w.businessValueCeo],
        [w.businessLabelReg, w.businessValueReg],
        [w.businessLabelMailOrder, w.businessValueMailOrder],
        [w.businessLabelInquiry, w.businessValueInquiry],
        [w.businessLabelPhone, w.businessValuePhone],
        [w.businessLabelAddress, w.businessValueAddress],
    ].map(([label, value]) => `${label} ${value}`),
};

async function getHeroPhotos(): Promise<HeroPhoto[]> {
    if (HERO_COURSE_IDS.length === 0) return [];
    try {
        const rows = await prisma.course.findMany({
            where: { id: { in: HERO_COURSE_IDS }, isPublic: true, imageUrl: { not: null } },
            select: { id: true, imageUrl: true, region: true },
        });
        return HERO_COURSE_IDS.flatMap((id) => {
            const r = rows.find((x) => x.id === id);
            return r?.imageUrl ? [{ src: r.imageUrl, region: r.region || "" }] : [];
        });
    } catch (e) {
        console.error("/partner 사진 조회 실패:", e);
        return [];
    }
}

export default async function PartnerPage() {
    const hasInstagramImage = fs.existsSync(path.join(process.cwd(), "public", INSTAGRAM_IMAGE));
    return (
        <PartnerClient
            course={await getShowcaseCourse()}
            heroPhotos={await getHeroPhotos()}
            instagramImage={hasInstagramImage ? INSTAGRAM_IMAGE : null}
            business={BUSINESS}
        />
    );
}
