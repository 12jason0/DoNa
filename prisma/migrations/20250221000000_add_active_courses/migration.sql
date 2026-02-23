-- CreateTable
CREATE TABLE "active_courses" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reminded_at" TIMESTAMP(3),

    CONSTRAINT "active_courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "active_courses_user_id_key" ON "active_courses"("user_id");

-- CreateIndex
CREATE INDEX "active_courses_user_id_started_at_idx" ON "active_courses"("user_id", "started_at");

-- AddForeignKey
ALTER TABLE "active_courses" ADD CONSTRAINT "active_courses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_courses" ADD CONSTRAINT "active_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
