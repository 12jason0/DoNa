# 환경 변수 목록

`.env.local` (개발) 또는 Vercel 환경 변수 (프로덕션)에 설정.
실제 값은 팀 내부 공유 채널에서 확인.

---

## 데이터베이스

```env
# Neon PostgreSQL — 앱 실행용 (연결 풀링, -pooler 포함)
DATABASE_URL=postgresql://...

# Neon PostgreSQL — Prisma 마이그레이션용 (직접 연결, -pooler 없음)
DIRECT_URL=postgresql://...
```

> 두 URL의 차이: `DATABASE_URL_SETUP.md` 참고

---

## 인증 / 보안

```env
JWT_SECRET=32자_이상_랜덤_문자열
ADMIN_JWT_SECRET=관리자_전용_JWT_시크릿
ADMIN_PASSWORD=관리자_페이지_비밀번호
AES_ENCRYPTION_KEY=AES_암호화_키
CRON_SECRET=크론_잡_인증_시크릿
```

---

## 카카오

```env
# 서버용
KAKAO_CLIENT_ID=카카오_REST_API_키
KAKAO_CLIENT_SECRET=카카오_클라이언트_시크릿

# 클라이언트용
NEXT_PUBLIC_KAKAO_CLIENT_ID=카카오_REST_API_키
NEXT_PUBLIC_KAKAO_JS_KEY=카카오_JavaScript_키
NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY=카카오_JavaScript_키  # 위와 동일, 호환용
```

---

## Apple 로그인 (웹)

```env
NEXT_PUBLIC_APPLE_CLIENT_ID=com.your.app
NEXT_PUBLIC_APPLE_REDIRECT_URI=https://dona.io.kr/api/auth/apple/callback
```

> 앱(네이티브)은 `expo-apple-authentication` 사용으로 별도 환경변수 불필요.

---

## AWS S3 + CloudFront

```env
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=ap-northeast-2

S3_BUCKET_NAME=your-bucket-name
S3_PUBLIC_BASE_URL=https://d13xx6k6chk2in.cloudfront.net
CLOUDFRONT_DOMAIN=d13xx6k6chk2in.cloudfront.net

# 클라이언트에서 이미지 URL 생성 시 사용
NEXT_PUBLIC_S3_PUBLIC_BASE_URL=https://d13xx6k6chk2in.cloudfront.net
NEXT_PUBLIC_CLOUDFRONT_DOMAIN=d13xx6k6chk2in.cloudfront.net
```

---

## 결제 / 구독

```env
# Toss Payments
TOSS_SECRET_KEY_GENERAL=test_sk_...또는_live_sk_...

# RevenueCat 웹훅 검증
REVENUECAT_WEBHOOK_SECRET=your_webhook_secret
```

---

## 네이버 지도 (길찾기 API — 서버용)

```env
NAVER_MAP_API_KEY_ID=your_ncp_api_key_id
NAVER_MAP_API_KEY=your_ncp_api_key
```

> 앱의 네이버 지도 SDK 키는 `mobile/app.json`에 설정.

---

## 푸시 알림

```env
EXPO_ACCESS_TOKEN=expo_액세스_토큰
```

---

## Redis (Rate Limiting / 캐시)

```env
UPSTASH_REDIS_REST_URL=https://your-upstash-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

---

## 모니터링 / 분석

```env
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ADSENSE_ID=ca-pub-XXXXXXXXXXXXXXXX
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
```

---

## 날씨 API

```env
KMA_API_KEY=기상청_API_키
AIRKOREA_API_KEY=에어코리아_API_키
```

---

## 기타

```env
NEXT_PUBLIC_APP_URL=https://dona.io.kr
NEXT_PUBLIC_SITE_URL=https://dona.io.kr
TEST_ACCOUNTS=test@test.com  # GPS 체크 건너뛸 테스트 계정 (프로덕션에서 제거 권장)
ENABLE_TOKEN_RESPONSE=true   # 로그인 응답에 토큰 포함 여부 (앱용)
```
