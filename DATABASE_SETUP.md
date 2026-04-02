# 데이터베이스 설정 가이드

DoNa는 **PostgreSQL (Neon)** + **Prisma ORM** 사용.
MySQL, NEXTAUTH, 직접 SQL 방식은 모두 제거됨.

---

## 1. 환경 변수 설정

`.env.local` 파일:

```env
# Neon PostgreSQL - 앱 실행용 (연결 풀링)
DATABASE_URL="postgresql://user:password@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"

# Neon PostgreSQL - 마이그레이션용 (직접 연결, -pooler 없음)
DIRECT_URL="postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# JWT
JWT_SECRET=32자_이상의_강력한_시크릿

# 앱 URL
NEXT_PUBLIC_APP_URL=https://dona.io.kr
```

> `DATABASE_URL`과 `DIRECT_URL`의 차이는 `DATABASE_URL_SETUP.md` 참고.

---

## 2. Neon 대시보드에서 주소 확인

1. [console.neon.tech](https://console.neon.tech) 접속
2. 프로젝트 선택 → Connection Details
3. **Pooled Connection** (DATABASE_URL용): 주소에 `-pooler` 포함
4. **Direct Connection** (DIRECT_URL용): 주소에 `-pooler` 없음

---

## 3. Prisma 설정

### 3.1 Prisma Client 생성

```bash
npx prisma generate
```

### 3.2 마이그레이션 적용

```bash
# 개발 환경 (마이그레이션 파일 생성 + 적용)
npx prisma migrate dev --name 변경내용_설명

# 프로덕션 (마이그레이션 파일만 적용)
npx prisma migrate deploy
```

### 3.3 스키마 확인

```bash
npx prisma studio
```

---

## 4. 주요 테이블 구조

`prisma/schema.prisma` 참고. 주요 모델:

| 모델 | 설명 |
|------|------|
| `User` | 사용자 (이메일, 카카오ID, Apple, 구독 정보) |
| `Course` | 코스 (제목, 컨셉, 장소 목록, 태그) |
| `Place` | 장소 (이름, 좌표, 카테고리) |
| `Story` | 추억 기록 (사진, 별점, 태그) |
| `Review` | 코스 리뷰 |
| `UserFavorite` | 찜한 코스 |
| `SavedCourse` | AI 추천 저장 코스 |
| `Payment` | 결제 내역 (Toss Payments) |
| `LoginLog` | 로그인 이력 (IP 저장) |

---

## 5. 이미지 URL

모든 이미지는 **CloudFront** 경유:
- CloudFront 도메인: `d13xx6k6chk2in.cloudfront.net`
- S3 직접 접근 불가 (Private 버킷)
- S3 URL → CloudFront URL 마이그레이션은 이미 완료 (`docs/DB_MIGRATION_INSTRUCTIONS.md` 참고)

---

## 6. 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| 마이그레이션 실패 | DIRECT_URL에 `-pooler` 또는 `pgbouncer=true` | `DATABASE_URL_SETUP.md` 참고 |
| `PrismaClientKnownRequestError` | DB 연결 실패 | Neon 대시보드에서 DB 활성 상태 확인 |
| 이미지 403 Forbidden | S3 직접 URL 사용 | CloudFront URL로 변환 (`resolveImageUrl()` 사용) |
