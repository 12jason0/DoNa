-- AlterTable
ALTER TABLE "places" ADD COLUMN "address_en" VARCHAR(500);
ALTER TABLE "places" ADD COLUMN "address_ja" VARCHAR(500);
ALTER TABLE "places" ADD COLUMN "address_zh" VARCHAR(500);

-- AlterTable
ALTER TABLE "course_places" ADD COLUMN "tips_en" TEXT;
ALTER TABLE "course_places" ADD COLUMN "tips_ja" TEXT;
ALTER TABLE "course_places" ADD COLUMN "tips_zh" TEXT;
