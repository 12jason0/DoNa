// src/app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local"; // localFont로 변경
import "./globals.css";

// 1. LINE Seed Sans KR 폰트 정의 (경로는 image_dfbe42.png 기준)
const lineSeed = localFont({
    src: [
        {
            path: "../../public/fonts/LINESeedKR-Th.woff2",
            weight: "100",
            style: "normal",
        },
        {
            path: "../../public/fonts/LINESeedKR-Rg.woff2",
            weight: "400",
            style: "normal",
        },
        {
            path: "../../public/fonts/LINESeedKR-Bd.woff2",
            weight: "700",
            style: "normal",
        },
    ],
    variable: "--font-line-seed", // Tailwind에서 사용할 변수
    display: "swap", // 폰트 로딩 중 텍스트 숨김 방지
});

export const metadata: Metadata = {
    title: "DoNa - 두나",
    description: "데이트 코스 추천 서비스",
};

export const viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko" className={`${lineSeed.variable}`}>
            {/* 2. body에 font-sans를 적용하여 앱 전체 서체 변경 */}
            <body className="font-sans antialiased">{children}</body>
        </html>
    );
}
