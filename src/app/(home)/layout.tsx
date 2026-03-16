// src/app/(home)/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import ClientBodyLayout from "./ClientBodyLayout";
import AsyncFonts from "@/components/AsyncFonts";
import { getS3StaticUrlForMetadata } from "@/lib/s3StaticUrl";

const logoUrl = getS3StaticUrlForMetadata("logo/donalogo_512.png");

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
                url: logoUrl,
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
        images: [logoUrl],
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
        icon: logoUrl,
        apple: logoUrl,
        shortcut: logoUrl,
    },
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="min-h-screen flex flex-col typography-smooth"
            suppressHydrationWarning
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

            <link rel="preconnect" href="https://cdn.jsdelivr.net" />
            {/* 🟢 [모바일 LCP] 폰트는 AsyncFonts에서 비동기 주입 → 렌더 블로킹 제거 */}
            <AsyncFonts />
            <link
                rel="preconnect"
                href={
                    process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ||
                    `https://${process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN || "d13xx6k6chk2in.cloudfront.net"}`
                }
                crossOrigin="anonymous"
            />
            <link
                rel="dns-prefetch"
                href={
                    process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ||
                    `https://${process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN || "d13xx6k6chk2in.cloudfront.net"}`
                }
            />
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

            {/* 🟢 서버 렌더 스플래시: 첫 HTML부터 초록 배경만 표시 → 로고/텍스트 없이 바로 DonaSplashFinal로 이어짐. 클라이언트에서 제거. */}
            <div
                id="server-splash"
                suppressHydrationWarning
                style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "#7FCC9F",
                    zIndex: 99999,
                }}
            />

            {/* 루트 layout의 Providers 사용 (LocaleProvider 중복 제거 → 번역 일관성) */}
            <ClientBodyLayout>{children}</ClientBodyLayout>
        </div>
    );
}
