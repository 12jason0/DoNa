-- CreateTable: 인기 검색어 집계용 검색 로그 (검색어·시간만, 사용자 정보 없음)
CREATE TABLE "search_logs" (
    "id" SERIAL NOT NULL,
    "keyword" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_logs_created_at_idx" ON "search_logs"("created_at");
