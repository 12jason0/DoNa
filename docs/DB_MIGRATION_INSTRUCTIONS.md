# DB 이미지 URL 마이그레이션 가이드

## 문제 상황

DB에 저장된 이미지 URL이 `stylemap-seoul.s3.ap-northeast-2.amazonaws.com`으로 되어 있어서, S3 버킷이 Private로 전환된 후 403 Forbidden 에러가 발생합니다.

## 해결 방법

`prisma/migrations/migrate_s3_to_cloudfront.sql` 파일을 실행하여 모든 이미지 URL을 CloudFront 도메인(`d13xx6k6chk2in.cloudfront.net`)으로 변경해야 합니다.

## 실행 방법

### 방법 1: Neon Console에서 실행 (권장)

1. Neon Console (https://console.neon.tech) 접속
2. 프로젝트 선택 → Database → SQL Editor
3. `prisma/migrations/migrate_s3_to_cloudfront.sql` 파일 내용 복사
4. SQL Editor에 붙여넣기
5. `\set` 명령어를 제거하고 실제 값으로 교체:

```sql
-- 기존 S3 직접 주소
-- \set OLD_S3_DOMAIN 'stylemap-seoul.s3.ap-northeast-2.amazonaws.com'

-- CloudFront 도메인
-- \set NEW_CLOUDFRONT_DOMAIN 'd13xx6k6chk2in.cloudfront.net'

-- 그 다음 각 UPDATE 문에서 :'OLD_S3_DOMAIN'을 'stylemap-seoul.s3.ap-northeast-2.amazonaws.com'으로 교체
-- :'NEW_CLOUDFRONT_DOMAIN'을 'd13xx6k6chk2in.cloudfront.net'으로 교체
```

실제 SQL (Neon에서 실행용):

```sql
-- users 테이블
UPDATE "users"
SET "profileImageUrl" = REPLACE("profileImageUrl", 'stylemap-seoul.s3.ap-northeast-2.amazonaws.com', 'd13xx6k6chk2in.cloudfront.net')
WHERE "profileImageUrl" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%';

-- courses 테이블
UPDATE "courses"
SET "imageUrl" = REPLACE("imageUrl", 'stylemap-seoul.s3.ap-northeast-2.amazonaws.com', 'd13xx6k6chk2in.cloudfront.net')
WHERE "imageUrl" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%';

-- places 테이블
UPDATE "places"
SET "imageUrl" = REPLACE("imageUrl", 'stylemap-seoul.s3.ap-northeast-2.amazonaws.com', 'd13xx6k6chk2in.cloudfront.net')
WHERE "imageUrl" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%';

-- stories 테이블
UPDATE "stories"
SET "imageUrl" = REPLACE("imageUrl", 'stylemap-seoul.s3.ap-northeast-2.amazonaws.com', 'd13xx6k6chk2in.cloudfront.net')
WHERE "imageUrl" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%';

-- mission_submissions 테이블
UPDATE "mission_submissions"
SET "photoUrl" = REPLACE("photoUrl", 'stylemap-seoul.s3.ap-northeast-2.amazonaws.com', 'd13xx6k6chk2in.cloudfront.net')
WHERE "photoUrl" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%';

-- PlaceOption 테이블
UPDATE "PlaceOption"
SET "imageUrl" = REPLACE("imageUrl", 'stylemap-seoul.s3.ap-northeast-2.amazonaws.com', 'd13xx6k6chk2in.cloudfront.net')
WHERE "imageUrl" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%';

-- PlaceDialogue 테이블
UPDATE "PlaceDialogue"
SET "imageUrl" = REPLACE("imageUrl", 'stylemap-seoul.s3.ap-northeast-2.amazonaws.com', 'd13xx6k6chk2in.cloudfront.net')
WHERE "imageUrl" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%';

-- collage_templates 테이블
UPDATE "collage_templates"
SET "image_url" = REPLACE("image_url", 'stylemap-seoul.s3.ap-northeast-2.amazonaws.com', 'd13xx6k6chk2in.cloudfront.net')
WHERE "image_url" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%';

-- badges 테이블
UPDATE "badges"
SET "image_url" = REPLACE("image_url", 'stylemap-seoul.s3.ap-northeast-2.amazonaws.com', 'd13xx6k6chk2in.cloudfront.net')
WHERE "image_url" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%';

-- reviews 테이블 (배열 타입)
UPDATE "reviews"
SET "imageUrls" = ARRAY(SELECT REPLACE(elem, 'stylemap-seoul.s3.ap-northeast-2.amazonaws.com', 'd13xx6k6chk2in.cloudfront.net') FROM unnest("imageUrls") AS elem)
WHERE EXISTS (SELECT 1 FROM unnest("imageUrls") AS elem WHERE elem LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%');

-- user_collages 테이블
UPDATE "user_collages"
SET "collage_url" = REPLACE("collage_url", 'stylemap-seoul.s3.ap-northeast-2.amazonaws.com', 'd13xx6k6chk2in.cloudfront.net')
WHERE "collage_url" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%';

UPDATE "user_collages"
SET "thumbnail_url" = REPLACE("thumbnail_url", 'stylemap-seoul.s3.ap-northeast-2.amazonaws.com', 'd13xx6k6chk2in.cloudfront.net')
WHERE "thumbnail_url" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%';
```

### 방법 2: psql 명령줄에서 실행

```bash
psql $DATABASE_URL -f prisma/migrations/migrate_s3_to_cloudfront.sql
```

## 확인 방법

마이그레이션 후 다음 SQL로 확인:

```sql
-- S3 직접 주소가 남아있는지 확인
SELECT COUNT(*) FROM "courses" WHERE "imageUrl" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%';
SELECT COUNT(*) FROM "places" WHERE "imageUrl" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%';
SELECT COUNT(*) FROM "users" WHERE "profileImageUrl" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%';
```

모두 0이 나와야 정상입니다.
