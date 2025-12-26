# CloudFront 마이그레이션 가이드

## 📋 개요

S3 버킷을 Private으로 전환하고 CloudFront + OAC를 통해 이미지를 제공하도록 마이그레이션하는 가이드입니다.

## ✅ 완료된 작업

1. ✅ DB 마이그레이션 SQL 스크립트 생성 (`prisma/migrations/migrate_s3_to_cloudfront.sql`)
2. ✅ `getS3PublicUrl` 함수에서 CloudFront 우선 사용
3. ✅ `getS3StaticUrl` 헬퍼 함수 생성 (정적 이미지용)
4. ✅ `categoryImages.ts`, `onboardingData.ts` 환경 변수 기반으로 수정

## 🔧 필요한 작업

### 1. 환경 변수 설정

#### 로컬 환경 (`.env.local`)

```env
S3_PUBLIC_BASE_URL=https://d13xx6k6chk2in.cloudfront.net
CLOUDFRONT_DOMAIN=d13xx6k6chk2in.cloudfront.net

# 클라이언트 사이드에서 사용하려면 NEXT_PUBLIC_ 접두사 필요
NEXT_PUBLIC_S3_PUBLIC_BASE_URL=https://d13xx6k6chk2in.cloudfront.net
NEXT_PUBLIC_CLOUDFRONT_DOMAIN=d13xx6k6chk2in.cloudfront.net
```

#### Vercel 환경 변수

Vercel 대시보드에서 다음 환경 변수를 설정하세요:

-   `S3_PUBLIC_BASE_URL`
-   `CLOUDFRONT_DOMAIN`
-   `NEXT_PUBLIC_S3_PUBLIC_BASE_URL`
-   `NEXT_PUBLIC_CLOUDFRONT_DOMAIN`

설정 후 **Redeploy** 필요!

### 2. DB 마이그레이션 실행

```bash
# Prisma Studio에서 실행하거나
psql $DATABASE_URL -f prisma/migrations/migrate_s3_to_cloudfront.sql

# 또는 Neon Console에서 직접 실행
```

**⚠️ 중요:** 마이그레이션 전에 DB 백업 권장!

### 3. 남은 하드코딩된 URL 수정

다음 파일들에서 하드코딩된 S3 URL을 `getS3StaticUrl()` 함수로 교체해야 합니다:

#### 우선순위 높음 (자주 사용되는 파일)

-   [ ] `src/app/(home)/courses/[id]/CourseDetailClient.tsx` ✅ (완료)
-   [ ] `src/components/LayoutContent.tsx` - 홈페이지 배경 이미지
-   [ ] `src/components/mypage/ProfileTab.tsx` - 기본 프로필 이미지
-   [ ] `src/components/mypage/FootprintTab.tsx` - 마이페이지 배너 이미지
-   [ ] `src/app/(home)/layout.tsx` - 메타데이터 이미지
-   [ ] `src/app/(home)/head.tsx` - 메타데이터 이미지

#### 우선순위 중간 (탈출방 관련)

-   [ ] `src/app/(home)/escape/intro/page.tsx` - 탈출방 이미지들
-   [ ] `src/components/JongroMapFinalExact.tsx` - 지도 이미지

#### 우선순위 낮음 (로고/아이콘)

-   [ ] `src/components/DonaSplashFinal.tsx` - 스플래시 로고
-   [ ] `src/app/(home)/courses/[id]/layout.tsx` - 로고 이미지
-   [ ] `src/app/(home)/personalized-home/page.tsx` - 로고 이미지
-   [ ] `src/app/(home)/map/head.tsx` - 메타데이터 이미지

#### 사용 예시

```typescript
// 수정 전
const logoUrl = "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/logo/donalogo_512.png";

// 수정 후
import { getS3StaticUrl } from "@/lib/s3Static";
const logoUrl = getS3StaticUrl("logo/donalogo_512.png");
```

### 4. 테스트

1. **이미지 업로드 테스트**

    - 리뷰 사진 업로드
    - 탈출방 사진 업로드
    - 프로필 이미지 업로드
    - → 모든 URL이 CloudFront로 시작하는지 확인

2. **정적 이미지 테스트**

    - 로고가 제대로 표시되는지 확인
    - 아이콘들이 제대로 표시되는지 확인
    - 배경 이미지가 제대로 표시되는지 확인

3. **DB 확인**
    - 마이그레이션 후 DB의 이미지 URL들이 CloudFront 도메인으로 변경되었는지 확인

## 🐛 문제 해결

### 이미지가 표시되지 않는 경우

1. **환경 변수 확인**

    ```bash
    # 서버 사이드
    console.log(process.env.S3_PUBLIC_BASE_URL);

    # 클라이언트 사이드
    console.log(process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL);
    ```

2. **CloudFront 배포 상태 확인**

    - AWS Console → CloudFront → 배포 상태가 "Deployed"인지 확인

3. **S3 버킷 정책 확인**

    - OAC가 올바르게 설정되어 있는지 확인
    - 버킷 정책에 CloudFront ARN이 포함되어 있는지 확인

4. **브라우저 캐시 클리어**
    - 하드 리프레시 (Ctrl+Shift+R 또는 Cmd+Shift+R)

### DB 마이그레이션 후에도 이미지가 안 보이는 경우

1. **마이그레이션 결과 확인**

    ```sql
    SELECT "imageUrl" FROM "courses" LIMIT 5;
    SELECT "profileImageUrl" FROM "users" WHERE "profileImageUrl" IS NOT NULL LIMIT 5;
    ```

2. **CloudFront 캐시 무효화**
    - AWS Console → CloudFront → Invalidations → Create Invalidation
    - `/*` 입력 후 실행

## 📝 체크리스트

-   [ ] 환경 변수 설정 (로컬)
-   [ ] 환경 변수 설정 (Vercel)
-   [ ] Vercel Redeploy
-   [ ] DB 마이그레이션 실행
-   [ ] 주요 파일의 하드코딩된 URL 수정
-   [ ] 이미지 업로드 테스트
-   [ ] 정적 이미지 테스트
-   [ ] DB 확인
-   [ ] CloudFront 캐시 무효화 (필요시)

## 🔒 보안 확인

마이그레이션 후 다음을 확인하세요:

1. **S3 직접 접근 차단 확인**

    ```bash
    curl https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/logo/donalogo_512.png
    # → 403 Forbidden이어야 함
    ```

2. **CloudFront 접근 확인**
    ```bash
    curl https://d13xx6k6chk2in.cloudfront.net/logo/donalogo_512.png
    # → 200 OK 이어야 함
    ```

## 📚 참고 자료

-   [CloudFront + OAC 설정 가이드](./CLOUDFRONT_OAC_SETUP.md)
-   [환경 변수 설정 가이드](./ENV_VARIABLES.md)
