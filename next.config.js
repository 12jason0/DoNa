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
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "origin-when-cross-origin" },
                    { key: "X-XSS-Protection", value: "1; mode=block" },
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

                            // 2. 스타일 및 폰트 허용 (jsDelivr 차단 해결)
                            const styleSrc = [
                                "'self'",
                                "'unsafe-inline'",
                                "https://ssl.pstatic.net",
                                "https://cdn.jsdelivr.net",
                            ].join(" ");

                            const fontSrc = [
                                "'self'",
                                "data:",
                                "https://ssl.pstatic.net",
                                "https://cdn.jsdelivr.net",
                                "https://*.tosspayments.com",
                                "https://r2cdn.perplexity.ai", // 🟢 Perplexity 폰트 허용
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
        ];
    },

    images: {
        // 🟢 이미지 500 에러 차단을 위한 품질 설정 명시
        qualities: [50, 60, 65, 70, 75, 80, 85, 90],
        minimumCacheTTL: 3600,
        remotePatterns: [{ protocol: "https", hostname: "**" }],
    },
};

module.exports = nextConfig;
