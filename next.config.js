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
                    // Hide Vercel Toolbar on deployed site
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

                            // ✅ 이미지 허용 목록 (CloudFront만 사용)
                            const imgSrc = [
                                "'self'",
                                "data:",
                                "blob:",
                                "https://d13xx6k6chk2in.cloudfront.net", // 🟢 CloudFront (S3 직접 접근 제거)
                                ...(isDev ? ["http:", "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com"] : []), // 개발 환경에서만 S3 허용
                            ].join(" ");

                            // ✅ API 및 소켓 연결 허용 (CloudFront 및 배포 도메인 추가)
                            const connectSrc = [
                                "'self'",
                                "https://dona.io.kr", // 🟢 메인 API 도메인
                                "https://d13xx6k6chk2in.cloudfront.net", // 🟢 CloudFront (S3 직접 접근 제거)
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
                                          "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com", // 개발 환경에서만 S3 허용
                                          "https://*.amazonaws.com",
                                      ]
                                    : []),
                            ].join(" ");

                            // ✅ 폰트 허용 목록 (Vercel 폰트 에러 해결)
                            const fontSrc = [
                                "'self'",
                                "data:",
                                "https://vercel.live", // 🟢 추가
                                "https://*.vercel.live", // 🟢 추가
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

                            // ✅ 최종 CSP 헤더 조립
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
            { protocol: "https", hostname: "d13xx6k6chk2in.cloudfront.net" }, // 🟢 CloudFront만 사용 (S3 직접 접근 제거)
        ],
        unoptimized: true,
        qualities: [70],
    },
};

module.exports = nextConfig;
