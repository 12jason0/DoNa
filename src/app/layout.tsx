// src/app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/Providers";
import Script from "next/script"; // 🟢 카카오 SDK 로드를 위해 추가

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
    variable: "--font-line-seed",
    display: "swap",
    preload: false,
});

export const metadata: Metadata = {
    title: "DoNa - 두나",
    description: "데이트 코스 추천 서비스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ko" className={lineSeed.variable} suppressHydrationWarning>
            <body className={`${lineSeed.className} font-sans antialiased`}>
                {/* 🟢 웹뷰 앱 캐시 문제 해결: 빌드 버전 메타 태그 */}
                <Script
                    id="build-version"
                    strategy="beforeInteractive"
                    dangerouslySetInnerHTML={{
                        __html: `document.documentElement.setAttribute('data-build-version', '${
                            process.env.NEXT_PUBLIC_BUILD_VERSION || Date.now()
                        }');`,
                    }}
                />
                <Providers>{children}</Providers>

                {/* 🟢 [Kakao SDK]: 공유하기 기능을 위해 추가 - 초기화는 각 컴포넌트에서 처리 */}
                <Script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js" strategy="afterInteractive" />
            </body>
        </html>
    );
}
