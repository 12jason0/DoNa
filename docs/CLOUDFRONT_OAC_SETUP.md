# CloudFront + OAC 설정 가이드

S3 버킷을 Private로 설정하고 CloudFront를 통해 안전하고 빠르게 이미지를 제공하는 방법입니다.

## 🎯 목표

- **보안**: S3 버킷을 Private로 설정하여 직접 접근 차단
- **성능**: CloudFront CDN을 통한 빠른 이미지 로딩 (2030 세대 선호)
- **비용**: CloudFront 캐싱으로 S3 요청 비용 절감

---

## 1단계: S3 버킷 Private 설정

### AWS Console에서 설정

1. **S3 버킷 접근**
   - AWS Console → S3 → 버킷 선택

2. **퍼블릭 액세스 차단**
   - "권한" 탭 → "퍼블릭 액세스 차단 설정"
   - ✅ 모든 퍼블릭 액세스 차단 활성화

3. **버킷 정책 확인**
   - "권한" 탭 → "버킷 정책"
   - 퍼블릭 읽기 정책이 있다면 제거

---

## 2단계: CloudFront 배포 생성

### AWS Console에서 설정

1. **CloudFront 배포 생성**
   - AWS Console → CloudFront → "배포 생성"

2. **원본 설정**
   ```
   원본 도메인: [버킷 이름].s3.[리전].amazonaws.com
   원본 경로: (비워둠)
   이름: [버킷 이름]-origin
   ```

3. **OAC(Origin Access Control) 설정**
   - "원본 액세스" → "Origin Access Control 설정(권장)" 선택
   - "새 OAC 생성" 클릭
   - OAC 이름: `s3-bucket-oac`
   - 서명 동작: "서명 요청" 선택
   - 생성 후 생성된 OAC 선택

4. **기본 동작 설정**
   ```
   뷰어 프로토콜 정책: Redirect HTTP to HTTPS
   허용된 HTTP 메서드: GET, HEAD, OPTIONS
   캐시 정책: CachingOptimized (또는 CachingDisabled for dynamic)
   ```

5. **배포 생성**
   - "배포 생성" 클릭
   - 배포 완료까지 5-15분 소요

---

## 3단계: S3 버킷 정책 업데이트 (OAC 허용)

CloudFront OAC가 S3에 접근할 수 있도록 버킷 정책을 업데이트합니다.

### 버킷 정책 예시

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontServicePrincipal",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*",
            "Condition": {
                "StringEquals": {
                    "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
                }
            }
        }
    ]
}
```

**변경 사항:**
- `YOUR_BUCKET_NAME`: 실제 버킷 이름
- `ACCOUNT_ID`: AWS 계정 ID
- `DISTRIBUTION_ID`: CloudFront 배포 ID

### AWS CLI로 설정 (선택사항)

```bash
# OAC ID 확인
aws cloudfront list-origin-access-controls

# 버킷 정책 업데이트
aws s3api put-bucket-policy --bucket YOUR_BUCKET_NAME --policy file://bucket-policy.json
```

---

## 4단계: 환경 변수 설정

`.env.local` 또는 배포 환경에 다음 변수 추가:

```env
# CloudFront 배포 URL (예: https://d1234567890abc.cloudfront.net)
CLOUDFRONT_DOMAIN=d1234567890abc.cloudfront.net

# 또는 커스텀 도메인 사용 시
# CLOUDFRONT_DOMAIN=cdn.yourdomain.com

# 기존 S3_PUBLIC_BASE_URL을 CloudFront URL로 변경
S3_PUBLIC_BASE_URL=https://${CLOUDFRONT_DOMAIN}
```

---

## 5단계: 코드 확인

코드는 이미 `S3_PUBLIC_BASE_URL` 환경 변수를 지원하므로, 환경 변수만 설정하면 자동으로 CloudFront URL이 사용됩니다.

```typescript
// src/lib/s3.ts의 getS3PublicUrl 함수가 자동으로 처리
export function getS3PublicUrl(key: string): string {
    const customBase = process.env.S3_PUBLIC_BASE_URL; // CloudFront URL
    if (customBase) {
        return `${customBase.replace(/\/$/, "")}/${key}`;
    }
    // Fallback: S3 직접 URL (Private이므로 접근 불가)
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}
```

---

## 6단계: 테스트

1. **이미지 업로드 테스트**
   ```bash
   curl -X POST http://localhost:3000/api/upload \
     -F "photos=@test-image.jpg" \
     -F "type=review" \
     -F "courseId=1"
   ```

2. **CloudFront URL 확인**
   - 응답의 `photo_urls`가 CloudFront URL로 시작하는지 확인
   - 예: `https://d1234567890abc.cloudfront.net/reviews/user_1/course_1/...`

3. **직접 S3 접근 차단 확인**
   - S3 직접 URL로 접근 시도 → 403 Forbidden 확인

---

## 7단계: CloudFront 캐싱 최적화 (선택사항)

### 캐시 정책 커스터마이징

1. **CloudFront Console** → "정책" → "캐시 정책" → "캐시 정책 생성"

2. **설정 예시**
   ```
   TTL 최소값: 86400 (1일)
   TTL 최대값: 31536000 (1년)
   기본 TTL: 86400 (1일)
   ```

3. **응답 헤더 정책**
   - `Cache-Control` 헤더 추가
   - `Access-Control-Allow-Origin` 설정 (CORS)

---

## 8단계: 모니터링 및 비용 최적화

### CloudWatch 메트릭 확인
- CloudFront → "모니터링" → "메트릭"
- 주요 지표:
  - `Requests`: 요청 수
  - `BytesDownloaded`: 다운로드 용량
  - `CacheHitRate`: 캐시 적중률 (높을수록 좋음)

### 비용 최적화 팁
1. **캐시 적중률 향상**: 적절한 TTL 설정
2. **압축 활성화**: CloudFront 자동 압축 사용
3. **지리적 제한**: 불필요한 지역 차단

---

## 🔒 보안 체크리스트

- [ ] S3 버킷 퍼블릭 액세스 차단 활성화
- [ ] CloudFront OAC 생성 및 연결
- [ ] S3 버킷 정책에 OAC 허용 규칙 추가
- [ ] `S3_PUBLIC_BASE_URL` 환경 변수 설정
- [ ] HTTPS 강제 (CloudFront 설정)
- [ ] 직접 S3 접근 차단 확인

---

## 🚀 성능 개선 효과

- **로딩 속도**: CDN 엣지 서버를 통한 빠른 전송
- **전역 성능**: 전 세계 엣지 로케이션 활용
- **비용 절감**: 캐싱으로 S3 요청 감소
- **보안 강화**: Private 버킷 + OAC로 안전한 접근

---

## 문제 해결

### 이미지가 표시되지 않는 경우

1. **CloudFront 배포 상태 확인**
   - 배포가 "배포됨" 상태인지 확인

2. **OAC 설정 확인**
   - CloudFront 원본 설정에서 OAC가 올바르게 연결되었는지 확인

3. **버킷 정책 확인**
   - OAC의 ARN이 버킷 정책에 포함되어 있는지 확인

4. **환경 변수 확인**
   - `S3_PUBLIC_BASE_URL`이 올바르게 설정되었는지 확인

### 403 Forbidden 오류

- S3 버킷 정책이 OAC를 허용하지 않음
- CloudFront 배포 ID가 버킷 정책의 ARN과 일치하지 않음

---

## 참고 자료

- [AWS CloudFront OAC 가이드](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [S3 버킷 정책 예시](https://docs.aws.amazon.com/AmazonS3/latest/userguide/example-bucket-policies.html)

