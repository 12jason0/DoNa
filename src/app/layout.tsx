// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/Providers";
import Script from "next/script";
import ClientStyleManager from "@/components/ClientStyleManager";
import AdSenseScript from "@/components/AdSenseScript";
import KakaoScript from "@/components/KakaoScript";
import { SpeedInsights } from "@vercel/speed-insights/next";

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

// ✅ 1. 페이지 정보 상자 (메타데이터)
export const metadata: Metadata = {
    title: "DoNa - 두나",
    description: "데이트 코스 추천 서비스",
};

// ✅ 2. 화면 규격 상자 (뷰포트) - Next.js 13.4+ 에서는 분리 필요
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover", // 🟢 상태표시줄까지 덮기 위한 필수 설정
    // 🟢 다크모드 대응: 기기 설정에 따라 상단 바 색상 자동 변경
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#7FCC9F" }, // 라이트모드 (초록)
        { media: "(prefers-color-scheme: dark)", color: "#121212" }, // 다크모드 (검정)
    ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ko" className={lineSeed.variable} suppressHydrationWarning>
            <body className={`${lineSeed.className} font-sans antialiased`} style={{ backgroundColor: "#7FCC9F" }} suppressHydrationWarning={true}>
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
                {/* 클라이언트 사이드 스타일 매니저 추가 */}
                <ClientStyleManager />
                <Providers>{children}</Providers>

                {/* 🟢 [Kakao SDK]: 공유·간편 로그인용 - Client Component에서 onLoad로 초기화 */}
                <KakaoScript />

                {/* Google AdSense: 웹에서만 로드. 앱(WebView)에서는 미로드 → 스플래시·adtrafficquality 동시 노출 방지 */}
                <AdSenseScript />

                {/* Vercel Speed Insights: 성능 메트릭 수집 */}
                <SpeedInsights />
            </body>
        </html>
    );
}
