# CloudFront + OAC 설정 요약

## 🚀 빠른 시작

### 1. 스크립트 실행 (자동 설정)

```bash
./scripts/setup-cloudfront-oac.sh YOUR_BUCKET_NAME ap-northeast-2 YOUR_ACCOUNT_ID
```

### 2. 환경 변수 설정

`.env.local` 또는 배포 환경에 추가:

```env
CLOUDFRONT_DOMAIN=d1234567890abc.cloudfront.net
# 또는
S3_PUBLIC_BASE_URL=https://d1234567890abc.cloudfront.net
```

### 3. 완료!

코드는 자동으로 CloudFront URL을 사용합니다.

---

## 📚 상세 가이드

- [CloudFront + OAC 설정 가이드](./docs/CLOUDFRONT_OAC_SETUP.md)
- [환경 변수 설정](./docs/ENV_VARIABLES.md)

---

## ✅ 보안 및 성능 개선

- ✅ S3 버킷 Private 설정
- ✅ CloudFront OAC를 통한 안전한 접근
- ✅ CDN을 통한 빠른 이미지 로딩
- ✅ 전 세계 엣지 서버 활용

---

## 🔍 확인 사항

1. CloudFront 배포 상태: "배포됨"
2. S3 버킷 정책: OAC 허용 규칙 포함
3. 환경 변수: `CLOUDFRONT_DOMAIN` 또는 `S3_PUBLIC_BASE_URL` 설정
4. 이미지 URL: CloudFront 도메인으로 시작하는지 확인

