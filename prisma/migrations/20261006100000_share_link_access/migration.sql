-- 공유 링크 열람권: 생성 시 공유자 권한 여부·만료일, 링크별 기기 기록(5대 제한)
-- AlterTable
ALTER TABLE "shared_courses" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "sharer_has_access" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "shared_course_devices" (
    "share_id" TEXT NOT NULL,
    "device_id" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_course_devices_pkey" PRIMARY KEY ("share_id","device_id")
);

-- CreateIndex
CREATE INDEX "shared_courses_shared_by_user_id_template_course_id_created_idx" ON "shared_courses"("shared_by_user_id", "template_course_id", "created_at");

-- AddForeignKey
ALTER TABLE "shared_course_devices" ADD CONSTRAINT "shared_course_devices_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "shared_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

