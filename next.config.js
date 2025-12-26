/** @type {import('next').NextConfig} */
const nextConfig = {
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

                            // ✅ 스크립트 허용 목록
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

                            // ✅ 이미지 허용 목록 (Unsplash + 네이버 지도 타일 서버 통합)
                            const imgSrc = [
                                "'self'",
                                "data:",
                                "blob:",
                                "https://d13xx6k6chk2in.cloudfront.net", // CloudFront
                                "https://images.unsplash.com", // 🟢 Unsplash 이미지 허용
                                "https://*.pstatic.net", // 🟢 네이버 지도 타일 이미지 허용
                                "https://*.naver.com", // 🟢 네이버 지도 관련 도메인 허용
                                "https://ssl.pstatic.net", // 🟢 네이버 정적 리소스 허용
                                "https://nrbe.pstatic.net", // 🟢 네이버 지도 서버 허용
                                ...(isDev ? ["http:", "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com"] : []),
                            ].join(" ");

                            // ✅ API 및 소켓 연결 허용
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
                                "https://*.pusher.com",
                                "wss://*.pusher.com",
                                ...(isDev
                                    ? [
                                          "http://oapi.map.naver.com",
                                          "http://nrbe.map.naver.net",
                                          "https://nrbe.map.naver.net",
                                          "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com",
                                          "https://*.amazonaws.com",
                                      ]
                                    : []),
                            ].join(" ");

                            const fontSrc = [
                                "'self'",
                                "data:",
                                "https://vercel.live",
                                "https://*.vercel.live",
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
        remotePatterns: [
            { protocol: "https", hostname: "images.unsplash.com" },
            { protocol: "https", hostname: "d13xx6k6chk2in.cloudfront.net" },
        ],
        unoptimized: true,
    },
};

module.exports = nextConfig;
