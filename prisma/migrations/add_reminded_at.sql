-- ActiveCourse에 remindedAt 추가 (21시 리마인더 중복 발송 방지)
ALTER TABLE "active_courses" ADD COLUMN IF NOT EXISTS "reminded_at" TIMESTAMP(3);
