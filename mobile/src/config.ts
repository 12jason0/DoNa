// 웹 서버 URL 설정
export const WEB_BASE = "https://dona.io.kr";

/**
 * 카카오 네이티브 SDK (@react-native-kakao/user) — Android 로그인 전 initializeKakaoSDK 필수.
 * app.json 의 @react-native-kakao/core 플러그인 nativeAppKey 와 동일 값 유지.
 */
export const KAKAO_NATIVE_APP_KEY =
    process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY ?? "a6c31213198b3d562121ddace8d1b65f";

// 🟢 [2026-01-21] 카카오 인증 URL: 서버가 '앱'임을 인식하도록 파라미터 강제 전달
export const KAKAO_AUTH_URL = `${WEB_BASE}/api/auth/kakao?next=mobile`;

/** 카카오 비즈니스 채널 1:1 채팅 (알림 모달·마이페이지 문의 공통) */
export const KAKAO_CHANNEL_CHAT_URL = "https://pf.kakao.com/_uxnZHn/chat";

// 🟢 CloudFront 이미지 CDN 도메인 (웹의 CloudFront 마이그레이션과 일치)
// 웹에서 사용하는 CloudFront 도메인과 동일하게 설정
export const CLOUDFRONT_DOMAIN = "d13xx6k6chk2in.cloudfront.net";
export const CLOUDFRONT_BASE_URL = `https://${CLOUDFRONT_DOMAIN}`;