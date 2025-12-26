// 웹 서버 URL 설정
// 개발 중: 로컬 서버 사용하려면 아래 주석을 해제하고 배포 URL을 주석 처리하세요
// export const WEB_BASE = "http://localhost:3000";  // 로컬 개발 (에뮬레이터/시뮬레이터)
// export const WEB_BASE = "http://192.168.0.XXX:3000";  // 로컬 개발 (실제 기기, 본인 IP로 변경)

// 프로덕션: 배포된 URL
export const WEB_BASE = "https://dona.io.kr";

// 🟢 CloudFront 이미지 CDN 도메인 (웹의 CloudFront 마이그레이션과 일치)
// 웹에서 사용하는 CloudFront 도메인과 동일하게 설정
export const CLOUDFRONT_DOMAIN = "d13xx6k6chk2in.cloudfront.net";
export const CLOUDFRONT_BASE_URL = `https://${CLOUDFRONT_DOMAIN}`;