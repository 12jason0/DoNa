-- AlterTable: regions에 다국어 컬럼 추가
ALTER TABLE "regions" ADD COLUMN "name_en" TEXT;
ALTER TABLE "regions" ADD COLUMN "name_ja" TEXT;
ALTER TABLE "regions" ADD COLUMN "name_zh" TEXT;
