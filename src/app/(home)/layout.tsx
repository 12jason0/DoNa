// src/app/(home)/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import { Providers } from "@/components/Providers";
import ClientBodyLayout from "./ClientBodyLayout"; // 경로가 한 단계 깊어졌으니 ../ 확인 필요 (파일 위치에 따라 수정)

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://dona.io.kr"),
    title: {
        default: "두나 DoNa - 데이트 코스 추천",
        template: "%s | 두나 DoNa",
    },
    description: "특별한 데이트를 위한 맞춤 코스 추천! 탈출방 스타일의 미션과 함께 즐기는 데이트, 두나에서 시작하세요.",
    keywords: [
        "두나",
        "DoNa",
        "데이트 코스",
        "데이트 추천",
        "커플 데이트",
        "서울 데이트",
        "데이트 장소",
        "데이트 앱",
        "탈출 데이트",
        "연인 데이트",
        "로맨틱 데이트",
    ],
    openGraph: {
        type: "website",
        siteName: "두나 DoNa",
        title: "두나 DoNa - 데이트 코스 추천",
        description: "특별한 데이트를 위한 맞춤 코스 추천",
        url: process.env.NEXT_PUBLIC_SITE_URL || "https://dona.io.kr",
        images: [
            {
                url: "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/logo/donalogo_512.png",
                width: 512,
                height: 512,
                alt: "DoNa 로고",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "DoNa - 데이트 코스 추천",
        description: "특별한 데이트를 위한 맞춤 코스 추천",
        images: ["https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/logo/donalogo_512.png"],
    },
    verification: {
        google: ["b1a43bde06d184c8", "xhBJt4-Q66AzounvtMTRw9qUJwusvg_p83BG-DGTLhg"],
        other: {
            "naver-site-verification": "247ecc2d7ba71441970f8ae0c7cf097cf3d895f1",
        },
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
        },
    },
    alternates: {
        canonical: process.env.NEXT_PUBLIC_SITE_URL || "https://dona.io.kr",
    },
    icons: {
        icon: "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/logo/donalogo_512.png",
        apple: "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/logo/donalogo_512.png",
        shortcut: "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/logo/donalogo_512.png",
    },
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="h-screen overflow-hidden flex flex-col typography-smooth"
            style={{
                background: "var(--background)",
                color: "var(--foreground)",
                backgroundImage:
                    "radial-gradient(1200px 600px at 10% -10%, rgba(153,192,142,0.18), transparent), radial-gradient(900px 500px at 110% 20%, rgba(121,160,111,0.15), transparent)",
            }}
        >
            {/* 스타일 오버라이드 */}
            <style>{`
                :root {
                    --brand-green: #7aa06f;
                    --brand-green-dark: #5f8d57;
                }
                button.bg-blue-600, button.bg-blue-700, .bg-blue-600, .bg-blue-700 {
                    background-color: var(--brand-green) !important;
                }
                a.text-blue-600 { color: var(--brand-green) !important; }
                a.hover\:text-blue-800:hover { color: var(--brand-green-dark) !important; }
                .focus\:ring-blue-500:focus { --tw-ring-color: var(--brand-green) !important; }
                .focus\:border-transparent:focus { border-color: var(--brand-green) !important; }
            `}</style>

            {/* 수동 Link 태그들 (Next.js App Router에서는 가급적 Metadata API 사용 권장하지만, 일단 그대로 유지) */}
            <link rel="preconnect" href="https://cdn.jsdelivr.net" />
            <link
                rel="stylesheet"
                href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css"
            />
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sunn-us/SUIT/fonts/variable/stylesheet.css" />
            <link
                rel="preconnect"
                href="https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com"
                crossOrigin="anonymous"
            />
            <link rel="dns-prefetch" href="https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com" />
            <link rel="preconnect" href="https://oapi.map.naver.com" crossOrigin="anonymous" />
            <link rel="dns-prefetch" href="https://oapi.map.naver.com" />
            <link rel="preconnect" href="https://openapi.map.naver.com" crossOrigin="anonymous" />
            <link rel="dns-prefetch" href="https://openapi.map.naver.com" />
            <link rel="preconnect" href="https://naveropenapi.apigw.ntruss.com" crossOrigin="anonymous" />
            <link rel="dns-prefetch" href="https://naveropenapi.apigw.ntruss.com" />

            {/* Google Analytics Script */}
            <Script src="https://www.googletagmanager.com/gtag/js?id=G-R3EYQNXY13" strategy="afterInteractive" />
            <Script
                id="ga4-init"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html: "window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-R3EYQNXY13');",
                }}
            />

            {/* Providers 및 내부 레이아웃 */}
            <Providers>
                <ClientBodyLayout>{children}</ClientBodyLayout>
            </Providers>
        </div>
    );
}
