# CloudFront 이미지 로드 문제 해결 가이드

## 🔍 문제 진단 체크리스트

### 1. 환경 변수 확인

#### 서버 사이드 확인
브라우저에서 다음 URL로 접속하여 확인:
```
http://localhost:3000/api/debug/s3-url?key=test/image.jpg
```

또는 서버 로그에서 확인:
```bash
# 터미널에서 확인
node -e "require('dotenv').config(); console.log('S3_PUBLIC_BASE_URL:', process.env.S3_PUBLIC_BASE_URL)"
```

#### Vercel 환경 변수 확인
1. Vercel Dashboard → 프로젝트 → Settings → Environment Variables
2. 다음 변수들이 모두 설정되어 있는지 확인:
   - `S3_PUBLIC_BASE_URL`
   - `CLOUDFRONT_DOMAIN`
   - `NEXT_PUBLIC_S3_PUBLIC_BASE_URL`
   - `NEXT_PUBLIC_CLOUDFRONT_DOMAIN`

**⚠️ 중요:** 환경 변수 변경 후 반드시 **Redeploy** 필요!

---

### 2. DB 마이그레이션 확인

기존에 저장된 이미지 URL이 여전히 S3 직접 주소일 수 있습니다.

#### 확인 방법
```sql
-- DB에서 S3 직접 주소가 남아있는지 확인
SELECT "imageUrl" FROM "courses" 
WHERE "imageUrl" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%' 
LIMIT 5;

SELECT "profileImageUrl" FROM "users" 
WHERE "profileImageUrl" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%' 
LIMIT 5;
```

#### 해결 방법
DB 마이그레이션 SQL 실행:
```bash
psql $DATABASE_URL -f prisma/migrations/migrate_s3_to_cloudfront.sql
```

---

### 3. CloudFront 배포 상태 확인

#### AWS Console에서 확인
1. AWS Console → CloudFront → Distributions
2. 배포 상태가 **"Deployed"**인지 확인
3. 상태가 "In Progress"이면 완료될 때까지 대기 (5-15분 소요)

#### 배포 상태 확인 (CLI)
```bash
aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID --query 'Distribution.Status'
# → "Deployed"이어야 함
```

---

### 4. S3 버킷 정책 및 OAC 확인

#### 버킷 정책 확인
1. AWS Console → S3 → 버킷 선택 → 권한 → 버킷 정책
2. CloudFront OAC를 허용하는 정책이 있는지 확인:

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
            "Resource": "arn:aws:s3:::stylemap-seoul/*",
            "Condition": {
                "StringEquals": {
                    "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
                }
            }
        }
    ]
}
```

#### OAC 확인
1. AWS Console → CloudFront → Distributions → 원본 선택
2. "Origin access" 설정에서 "Origin Access Control"이 선택되어 있는지 확인

---

### 5. 직접 접근 테스트

#### S3 직접 접근 (차단되어야 함)
```bash
curl -I https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/logo/donalogo_512.png
# → 403 Forbidden이어야 함 (Private 버킷)
```

#### CloudFront 접근 (정상 작동해야 함)
```bash
curl -I https://d13xx6k6chk2in.cloudfront.net/logo/donalogo_512.png
# → 200 OK이어야 함
```

---

### 6. 브라우저 네트워크 탭 확인

1. 브라우저 개발자 도구 (F12) → Network 탭
2. 이미지가 로드되지 않는 페이지 새로고침
3. 실패한 요청 확인:
   - **요청 URL**: CloudFront URL인지, S3 직접 URL인지 확인
   - **상태 코드**: 403, 404, 500 등 확인
   - **에러 메시지**: 확인

---

## 🛠️ 해결 방법

### 문제 1: 환경 변수가 로드되지 않음

**증상:**
- 서버 로그에 "S3_PUBLIC_BASE_URL이 설정되지 않았습니다" 경고
- 생성된 URL이 S3 직접 주소

**해결:**
1. `.env.local` 파일 확인 (로컬 개발 시)
2. Vercel 환경 변수 확인 및 설정
3. Vercel에서 **Redeploy** 실행

---

### 문제 2: DB에 S3 직접 주소가 남아있음

**증상:**
- 새로 업로드한 이미지는 정상, 기존 이미지는 안 보임
- DB 쿼리 결과가 S3 직접 주소

**해결:**
```bash
# DB 마이그레이션 실행
psql $DATABASE_URL -f prisma/migrations/migrate_s3_to_cloudfront.sql
```

---

### 문제 3: CloudFront 배포가 완료되지 않음

**증상:**
- CloudFront URL로 접근 시 404 또는 502 에러

**해결:**
1. AWS Console에서 배포 상태 확인
2. "In Progress"이면 완료될 때까지 대기 (최대 15분)
3. 배포 완료 후 브라우저 캐시 클리어

---

### 문제 4: S3 버킷 정책 문제

**증상:**
- CloudFront URL로 접근 시 403 Forbidden

**해결:**
1. S3 버킷 정책에 CloudFront OAC 허용 규칙 추가
2. CloudFront 배포 ID가 정확한지 확인
3. 정책 적용 후 5분 정도 대기

---

### 문제 5: 브라우저 캐시 문제

**증상:**
- CloudFront URL로 접근해도 오래된 이미지 또는 404

**해결:**
1. 하드 리프레시 (Ctrl+Shift+R 또는 Cmd+Shift+R)
2. CloudFront 캐시 무효화:
   - AWS Console → CloudFront → Invalidations
   - Create Invalidation → `/*` 입력 → 실행

---

## 🔍 디버깅 도구

### API 엔드포인트 테스트
```
GET /api/debug/s3-url?key=test/image.jpg
```

응답 예시:
```json
{
  "success": true,
  "testKey": "test/image.jpg",
  "generatedUrl": "https://d13xx6k6chk2in.cloudfront.net/test/image.jpg",
  "environmentVariables": {
    "S3_PUBLIC_BASE_URL": "https://d13xx6k6chk2in.cloudfront.net",
    "CLOUDFRONT_DOMAIN": "d13xx6k6chk2in.cloudfront.net"
  },
  "isCloudFront": true,
  "isS3Direct": false
}
```

### 서버 로그 확인

업로드 시 서버 로그 확인:
```
[/api/upload] Successfully uploaded. Public URL: https://d13xx6k6chk2in.cloudfront.net/reviews/...
```

CloudFront URL로 시작해야 합니다!

---

## ✅ 최종 체크리스트

- [ ] 환경 변수 4개 모두 설정 (로컬 + Vercel)
- [ ] Vercel Redeploy 완료
- [ ] DB 마이그레이션 실행 완료
- [ ] CloudFront 배포 상태 "Deployed"
- [ ] S3 버킷 정책에 OAC 허용 규칙 추가
- [ ] S3 직접 접근 차단 확인 (403)
- [ ] CloudFront 접근 정상 확인 (200)
- [ ] 브라우저 캐시 클리어
- [ ] 새 이미지 업로드 테스트

---

## 📞 추가 도움

문제가 계속되면 다음 정보와 함께 확인하세요:

1. **디버그 API 응답**: `/api/debug/s3-url`
2. **브라우저 네트워크 탭**: 실패한 요청의 URL과 상태 코드
3. **서버 로그**: 업로드 시 생성된 URL
4. **DB 쿼리 결과**: `SELECT "imageUrl" FROM "courses" LIMIT 5;`

