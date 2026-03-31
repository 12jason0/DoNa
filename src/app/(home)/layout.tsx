// src/app/(home)/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import ClientBodyLayout from "./ClientBodyLayout";
import { getS3StaticUrlForMetadata } from "@/lib/s3StaticUrl";

const logoUrl = getS3StaticUrlForMetadata("logo/donalogo_512.png");

const META: Record<string, { title: string; titleTemplate: string; description: string; ogDescription: string; keywords: string[] }> = {
    ko: {
        title: "두나 DoNa - 데이트 코스 추천",
        titleTemplate: "%s | 두나 DoNa",
        description: "특별한 데이트를 위한 맞춤 코스 추천! 탈출방 스타일의 미션과 함께 즐기는 데이트, 두나에서 시작하세요.",
        ogDescription: "특별한 데이트를 위한 맞춤 코스 추천",
        keywords: ["두나", "DoNa", "데이트 코스", "데이트 추천", "커플 데이트", "서울 데이트", "데이트 장소", "데이트 앱", "탈출 데이트", "연인 데이트", "로맨틱 데이트"],
    },
    en: {
        title: "DoNa - Date Course Recommendation",
        titleTemplate: "%s | DoNa",
        description: "Find the perfect date course for your special moments! Enjoy mission-style escape dates with DoNa.",
        ogDescription: "Curated date courses for your perfect day out",
        keywords: ["DoNa", "date course", "date ideas", "couple date", "Seoul date", "date spots", "date app", "romantic date"],
    },
    ja: {
        title: "DoNa - デートコース提案",
        titleTemplate: "%s | DoNa",
        description: "特別なデートのためのぴったりのコースをご提案！脱出ゲーム風ミッションで楽しむデートはDoNaで。",
        ogDescription: "あなたの特別な日にぴったりのデートコース",
        keywords: ["DoNa", "デートコース", "デートプラン", "カップル", "ソウルデート", "デートスポット", "ロマンティック"],
    },
    zh: {
        title: "DoNa - 约会路线推荐",
        titleTemplate: "%s | DoNa",
        description: "为您的特别约会定制完美路线！体验解谜风格任务约会，从DoNa开始。",
        ogDescription: "为您的完美约会精心策划的路线",
        keywords: ["DoNa", "约会路线", "约会推荐", "情侣约会", "首尔约会", "约会地点", "浪漫约会"],
    },
};

function detectLocale(acceptLanguage: string): string {
    const supported = ["ko", "en", "ja", "zh"];
    const langs = acceptLanguage.split(",").map((l) => l.split(";")[0].trim().split("-")[0]);
    return langs.find((l) => supported.includes(l)) ?? "ko";
}

export async function generateMetadata(): Promise<Metadata> {
    const headersList = await headers();
    const acceptLanguage = headersList.get("accept-language") || "";
    const locale = detectLocale(acceptLanguage);
    const meta = META[locale] ?? META.ko;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dona.io.kr";

    return {
        metadataBase: new URL(siteUrl),
        title: {
            default: meta.title,
            template: meta.titleTemplate,
        },
        description: meta.description,
        keywords: meta.keywords,
        openGraph: {
            type: "website",
            siteName: "DoNa",
            title: meta.title,
            description: meta.ogDescription,
            url: siteUrl,
            images: [
                {
                    url: logoUrl,
                    width: 512,
                    height: 512,
                    alt: "DoNa Logo",
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: meta.title,
            description: meta.ogDescription,
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
            canonical: siteUrl,
        },
        icons: {
            icon: logoUrl,
            apple: logoUrl,
            shortcut: logoUrl,
        },
    };
}

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
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`} strategy="afterInteractive" />
            <Script
                id="ga4-init"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html: `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');`,
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
