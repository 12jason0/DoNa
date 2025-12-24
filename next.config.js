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

                            // ✅ CSP 값은 directive 이름과 값 사이에 반드시 "공백 1개"로 구분
                            const scriptSrc = [
                                "'self'",
                                "'unsafe-inline'",
                                ...(isDev ? ["'unsafe-eval'"] : []),
                                "blob:", // ✅ 올바른 위치
                                "https://cdn.jsdelivr.net", // ✅ browser-image-compression 외부 스크립트 허용
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

                            const styleSrc = [
                                "'self'",
                                "'unsafe-inline'",
                                "https://ssl.pstatic.net",
                                "https://cdn.jsdelivr.net",
                            ].join(" ");

                            const imgSrc = ["'self'", "data:", "blob:", "https:", ...(isDev ? ["http:"] : [])].join(
                                " "
                            );

                            const connectSrc = [
                                "'self'",
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
                                "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com",
                                "https://*.amazonaws.com",
                                "https://*.pusher.com", // Pusher API 허용
                                "wss://*.pusher.com", // 실시간 소켓(Websocket) 연결 허용 (중요!)
                                ...(isDev
                                    ? [
                                          "http://oapi.map.naver.com",
                                          "http://nrbe.map.naver.net",
                                          "https://nrbe.map.naver.net",
                                      ]
                                    : []),
                            ].join(" ");

                            const fontSrc = [
                                "'self'",
                                "data:",
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

                            // ✅ 정확히 한 줄로 합치기 (세미콜론 + 공백 필수)
                            return [
                                `default-src 'self'`,
                                `script-src ${scriptSrc}`,
                                `style-src ${styleSrc}`,
                                `img-src ${imgSrc}`,
                                `connect-src ${connectSrc}`,
                                `font-src ${fontSrc}`,
                                `frame-src ${frameSrc}`,
                                `worker-src ${workerSrc}`,
                            ].join("; "); // ✅ 세미콜론 뒤 반드시 공백
                        })(),
                    },
                ],
            },
        ];
    },
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "images.unsplash.com" },
            { protocol: "https", hostname: "stylemap-seoul.s3.ap-northeast-2.amazonaws.com" },
            { protocol: "https", hostname: "stylemap-images.s3.ap-southeast-2.amazonaws.com" },
        ],
        unoptimized: true,

        // ⬇⬇⬇ 추가된 부분
        qualities: [70],
    },
};

module.exports = nextConfig;
