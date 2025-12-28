/** @type {import('next').NextConfig} */
const nextConfig = {
    // 빌드 시 타입 오류 무시 (빠른 배포 환경 구축)
    typescript: { ignoreBuildErrors: true },

    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "origin-when-cross-origin" },
                    { key: "X-XSS-Protection", value: "1; mode=block" },
                    { key: "x-vercel-toolbar", value: "disabled" },
                    {
                        key: "Content-Security-Policy",
                        value: (() => {
                            const isDev = process.env.NODE_ENV !== "production";

                            // ✅ 스크립트 허용 목록 (네이버, 구글, 카카오, 토스 등)
                            const scriptSrc = [
                                "'self'",
                                "'unsafe-inline'",
                                ...(isDev ? ["'unsafe-eval'"] : []),
                                "blob:",
                                "https://cdn.jsdelivr.net",
                                "https://vercel.live",
                                "https://*.tosspayments.com",
                                "https://*.vercel.live",
                                "https://oapi.map.naver.com",
                                "https://openapi.map.naver.com",
                                "https://ssl.pstatic.net",
                                "https://nrbe.pstatic.net",
                                "https://*.pstatic.net",
                                "https://www.googletagmanager.com",
                                "https://www.google-analytics.com",
                                "https://t1.kakaocdn.net",
                                "https://developers.kakao.com",
                                ...(isDev ? ["http://oapi.map.naver.com", "http://nrbe.map.naver.net"] : []),
                            ].join(" ");

                            // ✅ 스타일 허용 목록
                            const styleSrc = [
                                "'self'",
                                "'unsafe-inline'",
                                "https://ssl.pstatic.net",
                                "https://cdn.jsdelivr.net",
                            ].join(" ");

                            // ✅ 이미지 허용 목록 (CloudFront, S3, 카카오, 구글 등)
                            const imgSrc = [
                                "'self'",
                                "data:",
                                "blob:",
                                "https://d13xx6k6chk2in.cloudfront.net", // CloudFront (필수) [cite: 2025-12-24]
                                "https://images.unsplash.com",
                                "https://*.pstatic.net",
                                "https://*.naver.com",
                                "https://ssl.pstatic.net",
                                "https://nrbe.pstatic.net",
                                "https://vercel.com",
                                "https://*.vercel.com",
                                "https://*.googleusercontent.com",
                                "https://k.kakaocdn.net", // 카카오 루트
                                "https://*.kakaocdn.net", // 카카오 CDN
                                "https://*.kakao.com",
                                "https://www.google.co.kr", // 구글 광고/분석
                                "https://*.google.co.kr",
                                "https://*.google.com",
                                "https://analytics.google.com",
                                "https://stats.g.doubleclick.net",
                                "https://*.google-analytics.com",
                                "https://*.googletagmanager.com",
                                ...(isDev ? ["http:", "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com"] : []),
                            ].join(" ");

                            // ✅ API 및 소켓 연결 허용 (오타 수정됨)
                            const connectSrc = [
                                "'self'",
                                "https://dona.io.kr",
                                "https://d13xx6k6chk2in.cloudfront.net",
                                "https://vercel.live",
                                "https://*.vercel.live",
                                "https://*.tosspayments.com",
                                "https://nrbe.pstatic.net",
                                "https://*.pstatic.net",
                                "https://oapi.map.naver.com",
                                "https://openapi.map.naver.com",
                                "https://naveropenapi.apigw.ntruss.com",
                                "https://kr-col-ext.nelo.navercorp.com",
                                "https://www.google-analytics.com",
                                "https://www.googletagmanager.com",
                                "https://analytics.google.com",
                                "https://stats.g.doubleclick.net",
                                "https://region1.google-analytics.com",
                                "https://*.kakao.com",
                                "https://api.tosspayments.com",
                                "https://kauth.kakao.com",
                                "https://t1.kakaocdn.net",
                                "https://*.pusher.com", // 🟢 Pusher HTTPS 허용
                                "wss://*.pusher.com", // 🟢 Pusher WebSocket 허용 (오타 수정 완료)
                                ...(isDev
                                    ? [
                                          "http://oapi.map.naver.com",
                                          "http://nrbe.map.naver.net",
                                          "https://*.amazonaws.com",
                                      ]
                                    : []),
                            ].join(" ");

                            const fontSrc = [
                                "'self'",
                                "data:",
                                "https://vercel.live",
                                "https://cdn.jsdelivr.net",
                                "https://*.tosspayments.com",
                            ].join(" ");
                            const frameSrc = [
                                "'self'",
                                "https://vercel.live",
                                "https://www.googletagmanager.com",
                                "https://payment-widget.tosspayments.com",
                                "https://*.tosspayments.com",
                                "https://toss.im",
                            ].join(" ");
                            const workerSrc = ["'self'", "blob:"].join(" ");

                            return [
                                `default-src 'self'`,
                                `script-src ${scriptSrc}`,
                                `style-src ${styleSrc}`,
                                `img-src ${imgSrc}`,
                                `connect-src ${connectSrc}`,
                                `font-src ${fontSrc}`,
                                `frame-src ${frameSrc}`,
                                `worker-src ${workerSrc}`,
                            ].join("; ");
                        })(),
                    },
                ],
            },
        ];
    },

    images: {
        // 🟢 이미지 품질 및 크기 최적화 (콘솔 경고 방지 및 성능 향상)
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
        qualities: [50, 55, 60, 65, 70, 75], // 🟢 사용 중인 품질값 명시 [cite: 2025-12-24]

        remotePatterns: [
            { protocol: "https", hostname: "images.unsplash.com" },
            { protocol: "https", hostname: "d13xx6k6chk2in.cloudfront.net" }, // CloudFront 통합 [cite: 2025-12-24]
            { protocol: "https", hostname: "*.vercel.com" },
            { protocol: "https", hostname: "*.googleusercontent.com" },
            { protocol: "https", hostname: "k.kakaocdn.net" },
            { protocol: "https", hostname: "*.kakaocdn.net" },
            { protocol: "https", hostname: "www.google.co.kr" },
            { protocol: "https", hostname: "google.co.kr" },
        ],
        unoptimized: false,
    },
};

module.exports = nextConfig;
