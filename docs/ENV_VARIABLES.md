# 환경 변수 설정 가이드

## S3 + CloudFront 설정

### 필수 환경 변수

```env
# AWS 자격 증명
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=ap-northeast-2

# S3 버킷 설정
S3_BUCKET_NAME=your-bucket-name

# CloudFront 설정 (보안 및 성능 최적화)
# CloudFront 배포 도메인 (예: d1234567890abc.cloudfront.net)
CLOUDFRONT_DOMAIN=d1234567890abc.cloudfront.net

# 또는 전체 URL 사용 가능
S3_PUBLIC_BASE_URL=https://d1234567890abc.cloudfront.net
```

### 선택적 환경 변수

```env
# S3 엔드포인트 (R2, MinIO 등 사용 시)
S3_ENDPOINT=https://s3.ap-northeast-2.amazonaws.com

# Path-style URL 사용 여부
S3_FORCE_PATH_STYLE=false
```

## 설정 우선순위

1. `S3_PUBLIC_BASE_URL` (최우선)
2. `CLOUDFRONT_DOMAIN` (두 번째)
3. S3 직접 URL (Fallback, Private 버킷이면 접근 불가)

## CloudFront 설정 확인

CloudFront 배포가 완료되면 다음 명령으로 확인:

```bash
aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID
```

배포 상태가 "Deployed"가 되어야 정상적으로 작동합니다.

