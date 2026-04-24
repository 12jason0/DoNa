-- AlterTable: courses에 sub_title 다국어 컬럼 추가
ALTER TABLE "courses" ADD COLUMN "sub_title_en" VARCHAR(100);
ALTER TABLE "courses" ADD COLUMN "sub_title_ja" VARCHAR(100);
ALTER TABLE "courses" ADD COLUMN "sub_title_zh" VARCHAR(100);
