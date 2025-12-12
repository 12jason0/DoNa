import type { Metadata } from "next";

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
    title: {
        default: "DoNa | 데이트 코스 추천 & 이색 방탈출 미션",
        template: "%s | DoNa",
    },
    description:
        "AI가 추천하는 서울 데이트 코스, 주말 놀거리, 이색 방탈출 미션. DoNa에서 나만의 특별한 탈출 코스를 찾아보세요.",
    keywords: ["데이트", "코스 추천", "방탈출", "탈출", "여행", "지도", "카카오맵", "맛집", "카페", "핫플"],
    verification: {
        other: { "naver-site-verification": "247ecc2d7ba71441970f8ae0c7cf097cf3d895f1" },
    },
    openGraph: {
        title: "DoNa | 데이트 코스 추천 & 이색 방탈출 미션",
        description:
            "AI가 추천하는 서울 데이트 코스, 주말 놀거리, 이색 방탈출 미션. DoNa에서 나만의 특별한 탈출 코스를 찾아보세요.",
        type: "website",
        url: "/",
        siteName: "DoNa",
        images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "DoNa" }],
        locale: "ko_KR",
    },
    twitter: {
        card: "summary_large_image",
        title: "DoNa | 데이트 코스 추천 & 이색 방탈출 미션",
        description:
            "AI가 추천하는 서울 데이트 코스, 주말 놀거리, 이색 방탈출 미션. DoNa에서 나만의 특별한 탈출 코스를 찾아보세요.",
        images: ["/og-image.png"],
    },
    icons: {
        icon: "/favicon.ico",
        apple: "/apple-touch-icon.png",
    },
};
