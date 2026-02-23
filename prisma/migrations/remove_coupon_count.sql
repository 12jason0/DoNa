-- Remove couponCount column from users table (쿠폰 없음, 언락 기록만)
ALTER TABLE "users" DROP COLUMN IF EXISTS "couponCount";
