-- 가입 유입 경로 (처음 방문 기준): utm_source, utm_campaign, 리퍼러 도메인, 첫 페이지 경로
ALTER TABLE "users" ADD COLUMN "signup_utm_source" VARCHAR(100),
ADD COLUMN "signup_utm_campaign" VARCHAR(100),
ADD COLUMN "signup_referrer" VARCHAR(255),
ADD COLUMN "signup_landing" VARCHAR(255);
