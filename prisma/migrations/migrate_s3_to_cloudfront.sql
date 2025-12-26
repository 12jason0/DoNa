-- ============================================
-- DB 이미지 URL 마이그레이션: S3 → CloudFront
-- ============================================
-- 이 스크립트는 모든 테이블의 S3 직접 주소를 CloudFront 주소로 변경합니다.
-- 
-- 사용 전 확인사항:
-- 1. .env 파일에 CLOUDFRONT_DOMAIN이 올바르게 설정되어 있는지 확인
-- 2. 백업 후 실행 권장
-- 3. 테스트 환경에서 먼저 실행 권장
--
-- 실행 방법:
-- 1. Prisma Studio 또는 DB 클라이언트(TablePlus, pgAdmin 등)에서 실행
-- 2. 또는 psql로 실행: psql $DATABASE_URL -f migrate_s3_to_cloudfront.sql
-- ============================================

-- 기존 S3 직접 주소
\set OLD_S3_DOMAIN 'stylemap-seoul.s3.ap-northeast-2.amazonaws.com'

-- CloudFront 도메인 (환경 변수에서 가져오거나 직접 설정)
-- 실제 CloudFront 도메인으로 변경하세요 (예: d13xx6k6chk2in.cloudfront.net)
\set NEW_CLOUDFRONT_DOMAIN 'd13xx6k6chk2in.cloudfront.net'

-- ============================================
-- 1. users 테이블: profileImageUrl
-- ============================================
UPDATE "users"
SET "profileImageUrl" = REPLACE("profileImageUrl", :'OLD_S3_DOMAIN', :'NEW_CLOUDFRONT_DOMAIN')
WHERE "profileImageUrl" LIKE '%' || :'OLD_S3_DOMAIN' || '%';

-- ============================================
-- 2. courses 테이블: imageUrl
-- ============================================
UPDATE "courses"
SET "imageUrl" = REPLACE("imageUrl", :'OLD_S3_DOMAIN', :'NEW_CLOUDFRONT_DOMAIN')
WHERE "imageUrl" LIKE '%' || :'OLD_S3_DOMAIN' || '%';

-- ============================================
-- 3. places 테이블: imageUrl
-- ============================================
UPDATE "places"
SET "imageUrl" = REPLACE("imageUrl", :'OLD_S3_DOMAIN', :'NEW_CLOUDFRONT_DOMAIN')
WHERE "imageUrl" LIKE '%' || :'OLD_S3_DOMAIN' || '%';

-- ============================================
-- 4. stories 테이블: imageUrl
-- ============================================
UPDATE "stories"
SET "imageUrl" = REPLACE("imageUrl", :'OLD_S3_DOMAIN', :'NEW_CLOUDFRONT_DOMAIN')
WHERE "imageUrl" LIKE '%' || :'OLD_S3_DOMAIN' || '%';

-- ============================================
-- 5. reviews 테이블: imageUrls (배열)
-- ============================================
-- PostgreSQL 배열의 각 요소를 업데이트
UPDATE "reviews"
SET "imageUrls" = ARRAY(
    SELECT REPLACE(url, :'OLD_S3_DOMAIN', :'NEW_CLOUDFRONT_DOMAIN')
    FROM unnest("imageUrls") AS url
)
WHERE EXISTS (
    SELECT 1
    FROM unnest("imageUrls") AS url
    WHERE url LIKE '%' || :'OLD_S3_DOMAIN' || '%'
);

-- ============================================
-- 6. PlaceOption 테이블: imageUrl
-- ============================================
UPDATE "PlaceOption"
SET "imageUrl" = REPLACE("imageUrl", :'OLD_S3_DOMAIN', :'NEW_CLOUDFRONT_DOMAIN')
WHERE "imageUrl" LIKE '%' || :'OLD_S3_DOMAIN' || '%';

-- ============================================
-- 7. PlaceDialogue 테이블: imageUrl
-- ============================================
UPDATE "PlaceDialogue"
SET "imageUrl" = REPLACE("imageUrl", :'OLD_S3_DOMAIN', :'NEW_CLOUDFRONT_DOMAIN')
WHERE "imageUrl" LIKE '%' || :'OLD_S3_DOMAIN' || '%';

-- ============================================
-- 8. CollageTemplate 테이블: imageUrl (image_url 컬럼)
-- ============================================
UPDATE "collage_templates"
SET "image_url" = REPLACE("image_url", :'OLD_S3_DOMAIN', :'NEW_CLOUDFRONT_DOMAIN')
WHERE "image_url" LIKE '%' || :'OLD_S3_DOMAIN' || '%';

-- ============================================
-- 9. badges 테이블: image_url
-- ============================================
UPDATE "badges"
SET "image_url" = REPLACE("image_url", :'OLD_S3_DOMAIN', :'NEW_CLOUDFRONT_DOMAIN')
WHERE "image_url" LIKE '%' || :'OLD_S3_DOMAIN' || '%';

-- ============================================
-- 10. mission_submissions 테이블: photoUrl (photo_url 컬럼)
-- ============================================
UPDATE "mission_submissions"
SET "photo_url" = REPLACE("photo_url", :'OLD_S3_DOMAIN', :'NEW_CLOUDFRONT_DOMAIN')
WHERE "photo_url" LIKE '%' || :'OLD_S3_DOMAIN' || '%';

-- ============================================
-- 11. user_collages 테이블: collageUrl, thumbnailUrl
-- ============================================
UPDATE "user_collages"
SET "collage_url" = REPLACE("collage_url", :'OLD_S3_DOMAIN', :'NEW_CLOUDFRONT_DOMAIN')
WHERE "collage_url" LIKE '%' || :'OLD_S3_DOMAIN' || '%';

UPDATE "user_collages"
SET "thumbnail_url" = REPLACE("thumbnail_url", :'OLD_S3_DOMAIN', :'NEW_CLOUDFRONT_DOMAIN')
WHERE "thumbnail_url" LIKE '%' || :'OLD_S3_DOMAIN' || '%';

-- ============================================
-- 마이그레이션 완료 확인 쿼리
-- ============================================
-- 다음 쿼리로 마이그레이션 결과를 확인할 수 있습니다:

-- SELECT 
--     'users' as table_name,
--     COUNT(*) as total_records,
--     COUNT(*) FILTER (WHERE "profileImageUrl" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%') as old_url_count
-- FROM "users"
-- UNION ALL
-- SELECT 
--     'courses' as table_name,
--     COUNT(*) as total_records,
--     COUNT(*) FILTER (WHERE "imageUrl" LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%') as old_url_count
-- FROM "courses"
-- UNION ALL
-- SELECT 
--     'reviews' as table_name,
--     COUNT(*) as total_records,
--     COUNT(*) FILTER (WHERE EXISTS (
--         SELECT 1 FROM unnest("imageUrls") AS url 
--         WHERE url LIKE '%stylemap-seoul.s3.ap-northeast-2.amazonaws.com%'
--     )) as old_url_count
-- FROM "reviews";

