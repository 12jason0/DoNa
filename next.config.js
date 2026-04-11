/** @type {import('next').NextConfig} */
const os = require("os");
const { withSentryConfig } = require("@sentry/nextjs");

// 🟢 [추가]: 현재 개발 장비의 로컬 IP 주소를 동적으로 가져오는 로직
const getLocalExternalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === "IPv4" && alias.address !== "127.0.0.1" && !alias.internal) {
                return alias.address;
            }
        }
    }
    return "localhost";
};

const localIp = getLocalExternalIP();

const nextConfig = {
    // 🟢 [2026-01-21 추가]: 카카오톡 인앱 브라우저 404 오류 해결
    // URL 끝의 슬래시(/) 유무를 하나로 통일하여 경로 매칭 실패를 방지합니다.
    trailingSlash: false,

    // TypeScript 빌드 오류 엄격 검사 활성화
    typescript: { ignoreBuildErrors: false },

    // 🟢 [추가]: 개발 모드 이중 렌더링 방지 (Violation 및 setInterval 지연 해결 핵심)
    reactStrictMode: false,

    // 2. 기존 유지: 개발 툴 배지 비활성화
    devIndicators: {
        buildActivity: false,
        appIsrStatus: false,
    },

    // 🟢 [추가]: 패키지 임포트 최적화 (Fast Refresh·번들 사이즈 개선)
    experimental: {
        optimizePackageImports: ["lucide-react", "date-fns", "framer-motion", "lodash", "recharts"],
        // 🟢 [수정]: Next.js 16 대응 - 'allowedDevOrigins' 대신 'serverActions.allowedOrigins' 사용
        // 🔴 [수정]: 하드코딩된 IP 삭제하고 동적 변수 사용
        serverActions: {
            allowedOrigins: [`${localIp}:3000`, "localhost:3000", "dona.io.kr"],
        },
    },

    // 🟢 [2026-01-21] 무한 리다이렉트 루프 방지: 웹에 실제 /courses/[id] 페이지가 존재하므로 리다이렉트 제거
    // 웹 사용자는 직접 /courses/[id] 경로로 접근 가능하며, 앱이 없을 경우에도 정상적으로 코스 상세 페이지가 표시됩니다.
    // async redirects() {
    //     return [
    //         {
    //             source: "/courses/:id",
    //             destination: "/?courseId=:id",
    //             permanent: false,
    //         },
    //     ];
    // },

    async headers() {
        return [
            // 🟢 [신규 추가]: 구글 앱 링크 검증용 Content-Type 설정
            {
                source: "/.well-known/assetlinks.json",
                headers: [{ key: "Content-Type", value: "application/json" }],
            },
            // 🟢 [2025-12-28] iOS App Links 검증용 Content-Type 설정
            {
                source: "/.well-known/apple-app-site-association",
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
                    // 🟢 Vercel Edge 캐시(s-maxage) + 브라우저 재검증(no-cache) 분리
                    // s-maxage: CDN이 60초 캐시 → RES 점수 개선
                    // no-cache: 브라우저는 항상 서버에 재검증 → 웹뷰 오래된 화면 방지
                    {
                        key: "Cache-Control",
                        value: "public, s-maxage=60, stale-while-revalidate=300, no-cache",
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
                                "https://va.vercel-scripts.com",
                                "https://*.vercel-scripts.com",
                                "https://*.tosspayments.com",
                                "https://www.googletagmanager.com",
                                "https://www.google-analytics.com",
                                "https://developers.kakao.com",
                                "https://t1.kakaocdn.net",
                                "https://t1.daumcdn.net",
                                "http://t1.daumcdn.net",
                                "https://pagead2.googlesyndication.com",
                                "https://googleadservices.com",
                                "https://tpc.googlesyndication.com",
                                "https://*.adtrafficquality.google",
                                "https://fundingchoicesmessages.google.com",
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

                            // 3. API 및 소켓 연결 허용 (IP 동적 적용)
                            const connectSrc = [
                                "'self'",
                                "https://*.naver.com",
                                "https://*.navercorp.com",
                                "https://*.pstatic.net",
                                "https://*.kakao.com",
                                "https://*.onkakao.net",
                                "https://bc.ad.daum.net",
                                "http://bc.ad.daum.net",
                                "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com",
                                "https://*.s3.ap-northeast-2.amazonaws.com",
                                "https://*.s3.amazonaws.com",
                                "https://dona.io.kr",
                                "https://*.pusher.com",
                                "wss://*.pusher.com",
                                "https://*.tosspayments.com",
                                "https://www.google-analytics.com",
                                "https://region1.google-analytics.com",
                                "https://analytics.google.com",
                                "https://stats.g.doubleclick.net",
                                "https://pagead2.googlesyndication.com",
                                "https://googleads.g.doubleclick.net",
                                "https://tpc.googlesyndication.com",
                                "https://ep1.adtrafficquality.google",
                                "https://*.adtrafficquality.google",
                                "https://csi.gstatic.com",
                                "https://fundingchoicesmessages.google.com",
                                "https://*.fundingchoicesmessages.google.com",
                                // 🔴 [수정]: 하드코딩된 192.168.219.220을 삭제하고 동적 변수 적용
                                `http://${localIp}:3000`,
                                `ws://${localIp}:3000`,
                                "localhost:3000",
                                "ws://localhost:3000",
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
        remotePatterns: [
            { protocol: "https", hostname: "d13xx6k6chk2in.cloudfront.net" },
            { protocol: "https", hostname: "stylemap-seoul.s3.ap-northeast-2.amazonaws.com" }, // 🟢 코스/장소 이미지
            { protocol: "https", hostname: "k.kakaocdn.net" }, // 🟢 카카오 프로필 이미지 CDN 허용
            { protocol: "https", hostname: "images.unsplash.com" }, // 🟢 Unsplash 이미지 허용
            { protocol: "http", hostname: "localhost", port: "3000", pathname: "/**" },
            { protocol: "http", hostname: "localhost", port: "3001", pathname: "/**" },
            { protocol: "https", hostname: "dona.io.kr", pathname: "/**" },
        ],
        qualities: [50, 55, 60, 65, 70, 75, 80, 85, 90],
        deviceSizes: [640, 750, 828, 1080, 1200],
        imageSizes: [16, 32, 48, 64, 96],
    },
};

module.exports = withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG || "",
    project: process.env.SENTRY_PROJECT || "",
    authToken: process.env.SENTRY_AUTH_TOKEN,
    // auth token 없을 때 나오는 경고 숨김 (소스맵 업로드 안 함). 토큰 설정 시 정상 업로드
    silent: true,
});
