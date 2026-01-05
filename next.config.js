/** @type {import('next').NextConfig} */
const nextConfig = {
    // 1. 기존 유지: 빌드 오류 무시
    typescript: { ignoreBuildErrors: true },

    // 🟢 [추가]: 개발 모드 이중 렌더링 방지 (Violation 및 setInterval 지연 해결 핵심)
    reactStrictMode: false,

    // 2. 기존 유지: 개발 툴 배지 비활성화
    devIndicators: {
        buildActivity: false,
        appIsrStatus: false,
    },

    // 🟢 [추가]: 패키지 임포트 최적화 (Fast Refresh 속도 개선)
    experimental: {
        optimizePackageImports: ["lucide-react", "date-fns", "framer-motion", "lodash"],
    },

    async headers() {
        return [
            // 🟢 [신규 추가]: 구글 앱 링크 검증용 Content-Type 설정
            {
                source: "/.well-known/assetlinks.json",
                headers: [{ key: "Content-Type", value: "application/json" }],
            },
            {
                // 🟢 수정: 내부 시스템 경로(_next, api, assets, favicon.ico 등)를 제외한 일반 페이지만 캐시 방지 적용
                source: "/((?!_next|api|assets|favicon.ico).*|)",
                headers: [
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "origin-when-cross-origin" },
                    { key: "X-XSS-Protection", value: "1; mode=block" },
                    // 🟢 웹뷰 앱 캐시 문제 해결: HTML 페이지만 캐시 방지
                    {
                        key: "Cache-Control",
                        value: "no-cache, no-store, must-revalidate, max-age=0",
                    },
                    {
                        key: "Pragma",
                        value: "no-cache",
                    },
                    {
                        key: "Content-Security-Policy",
                        value: (() => {
                            const isDev = process.env.NODE_ENV !== "production";

                            // 1. 스크립트 허용 (구글 태그 매니저 추가)
                            const scriptSrc = [
                                "'self'",
                                "'unsafe-inline'",
                                "'unsafe-eval'",
                                "blob:",
                                "https://*.naver.com",
                                "https://*.navercorp.com",
                                "https://*.pstatic.net",
                                "https://cdn.jsdelivr.net",
                                "https://vercel.live",
                                "https://*.tosspayments.com",
                                "https://www.googletagmanager.com",
                                "https://www.google-analytics.com",
                                "https://developers.kakao.com",
                                "https://t1.kakaocdn.net",
                                ...(isDev ? ["http://*.naver.com", "http://*.map.naver.net"] : []),
                            ].join(" ");

                            // 2. 스타일 및 폰트 허용 (jsDelivr 차단 해결, 구글 번역 허용)
                            const styleSrc = [
                                "'self'",
                                "'unsafe-inline'",
                                "https://ssl.pstatic.net",
                                "https://cdn.jsdelivr.net",
                                "https://www.gstatic.com", // 🟢 추가: 구글 리소스 허용
                            ].join(" ");

                            const fontSrc = [
                                "'self'",
                                "data:",
                                "https://ssl.pstatic.net",
                                "https://cdn.jsdelivr.net",
                                "https://*.tosspayments.com",
                                "https://r2cdn.perplexity.ai", // 🟢 Perplexity 폰트 허용
                                "https://vercel.live",
                            ].join(" ");

                            // 3. API 및 소켓 연결 허용
                            const connectSrc = [
                                "'self'",
                                "https://*.naver.com",
                                "https://*.navercorp.com",
                                "https://*.pstatic.net",
                                "https://dona.io.kr",
                                "https://*.pusher.com",
                                "wss://*.pusher.com",
                                "https://*.tosspayments.com",
                                "https://www.google-analytics.com",
                                "https://region1.google-analytics.com",
                                "https://analytics.google.com", // 👈 추가
                                "https://stats.g.doubleclick.net",
                            ].join(" ");

                            return [
                                `default-src 'self'`,
                                `script-src ${scriptSrc}`,
                                `style-src ${styleSrc}`,
                                `font-src ${fontSrc}`,
                                `connect-src ${connectSrc}`,
                                `img-src 'self' data: blob: https: http:`,
                                `frame-src 'self' https:`,
                            ].join("; ");
                        })(),
                    },
                ],
            },
            {
                // 🟢 정적 자산(_next/static)은 캐시 허용 (성능 최적화)
                source: "/_next/static/:path*",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=31536000, immutable",
                    },
                ],
            },
        ];
    },

    images: {
        // 🟢 수정: 비표준 'qualities' 제거, 표준 remotePatterns 사용
        minimumCacheTTL: 3600,
        remotePatterns: [{ protocol: "https", hostname: "d13xx6k6chk2in.cloudfront.net" }],
        qualities: [50, 55, 60, 65, 70, 75, 80, 85, 90],
        deviceSizes: [640, 750, 828, 1080, 1200],
        imageSizes: [16, 32, 48, 64, 96],
    },
};

module.exports = nextConfig;
