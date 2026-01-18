// 웹 서버 URL 설정
// 🟢 [2026-01-21] 로컬 테스트 지원: 개발 모드일 때는 로컬 IP 사용
// __DEV__는 Expo 개발 모드일 때 true가 됩니다.
export const WEB_BASE =
    typeof __DEV__ !== "undefined" && __DEV__
        ? "http://192.168.124.102:3000" // 로컬 개발 (유저님 PC의 IP)
        : "https://dona.io.kr"; // 프로덕션: 배포된 URL

// 🟢 [2026-01-21] 카카오 인증 URL: 서버가 '앱'임을 인식하도록 파라미터 강제 전달
export const KAKAO_AUTH_URL = `${WEB_BASE}/api/auth/kakao?next=mobile`;

// 🟢 CloudFront 이미지 CDN 도메인 (웹의 CloudFront 마이그레이션과 일치)
// 웹에서 사용하는 CloudFront 도메인과 동일하게 설정
export const CLOUDFRONT_DOMAIN = "d13xx6k6chk2in.cloudfront.net";
export const CLOUDFRONT_BASE_URL = `https://${CLOUDFRONT_DOMAIN}`;
