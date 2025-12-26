# 환경 변수 설정 예시 (.env 파일)

## CloudFront + S3 설정

```env
# ============================================
# AWS S3 설정
# ============================================
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=ap-northeast-2
S3_BUCKET_NAME=stylemap-seoul

# ============================================
# CloudFront 설정 (보안 및 성능 최적화)
# ============================================
# CloudFront 배포 도메인 (예: d13xx6k6chk2in.cloudfront.net)
CLOUDFRONT_DOMAIN=d13xx6k6chk2in.cloudfront.net

# 또는 전체 URL 사용 가능
S3_PUBLIC_BASE_URL=https://d13xx6k6chk2in.cloudfront.net

# 클라이언트 사이드에서 사용하려면 NEXT_PUBLIC_ 접두사 필요
NEXT_PUBLIC_CLOUDFRONT_DOMAIN=d13xx6k6chk2in.cloudfront.net
NEXT_PUBLIC_S3_PUBLIC_BASE_URL=https://d13xx6k6chk2in.cloudfront.net
```

## ✅ 확인사항

### 1. 필수 항목
- [ ] `CLOUDFRONT_DOMAIN` - CloudFront 배포 도메인 (http:// 또는 https:// 없이)
- [ ] `S3_PUBLIC_BASE_URL` - 전체 URL 형식 (https:// 포함)
- [ ] `NEXT_PUBLIC_CLOUDFRONT_DOMAIN` - 클라이언트 사이드용
- [ ] `NEXT_PUBLIC_S3_PUBLIC_BASE_URL` - 클라이언트 사이드용 전체 URL

### 2. 올바른 형식
```env
# ✅ 올바른 형식
CLOUDFRONT_DOMAIN=d13xx6k6chk2in.cloudfront.net
S3_PUBLIC_BASE_URL=https://d13xx6k6chk2in.cloudfront.net
NEXT_PUBLIC_CLOUDFRONT_DOMAIN=d13xx6k6chk2in.cloudfront.net
NEXT_PUBLIC_S3_PUBLIC_BASE_URL=https://d13xx6k6chk2in.cloudfront.net

# ❌ 잘못된 형식
CLOUDFRONT_DOMAIN=https://d13xx6k6chk2in.cloudfront.net  # http:// 또는 https:// 포함하지 말 것
S3_PUBLIC_BASE_URL=d13xx6k6chk2in.cloudfront.net  # https:// 포함해야 함
```

### 3. CloudFront 도메인 확인 방법
1. AWS Console → CloudFront → Distributions
2. 배포 목록에서 도메인 이름 확인
3. 예: `d13xx6k6chk2in.cloudfront.net` (http:// 또는 https:// 없이)

## 📝 설정 후 체크리스트

- [ ] `.env` 파일에 CloudFront 관련 변수 4개 모두 설정
- [ ] Vercel 환경 변수에도 동일하게 설정
- [ ] Vercel에서 Redeploy 실행
- [ ] 브라우저 콘솔에서 `process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN` 확인 (개발 모드에서만 가능)
- [ ] 이미지 URL이 CloudFront 도메인으로 생성되는지 확인

