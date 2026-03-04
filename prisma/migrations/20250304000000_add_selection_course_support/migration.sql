-- Add segment/order_in_segment to course_places (선택형 코스: brunch/dinner 등)
ALTER TABLE "course_places" ADD COLUMN IF NOT EXISTS "segment" VARCHAR(50);
ALTER TABLE "course_places" ADD COLUMN IF NOT EXISTS "order_in_segment" INTEGER;

-- Add is_selection_type to courses
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "is_selection_type" BOOLEAN NOT NULL DEFAULT false;

-- Create user_course_selections table
CREATE TABLE IF NOT EXISTS "user_course_selections" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "template_course_id" INTEGER NOT NULL,
    "selected_place_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_course_selections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_course_selections_user_id_idx" ON "user_course_selections"("user_id");
CREATE INDEX IF NOT EXISTS "user_course_selections_template_course_id_idx" ON "user_course_selections"("template_course_id");

-- Alter active_courses
ALTER TABLE "active_courses" ADD COLUMN IF NOT EXISTS "user_course_selection_id" TEXT;
ALTER TABLE "active_courses" ALTER COLUMN "course_id" DROP NOT NULL;
CREATE UNIQUE INDEX "active_courses_user_course_selection_id_key" ON "active_courses"("user_course_selection_id");

-- Alter saved_courses
DROP INDEX IF EXISTS "saved_courses_user_id_course_id_key";
ALTER TABLE "saved_courses" ADD COLUMN IF NOT EXISTS "user_course_selection_id" TEXT;
ALTER TABLE "saved_courses" ALTER COLUMN "course_id" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "saved_courses_course_id_idx" ON "saved_courses"("course_id");
CREATE INDEX IF NOT EXISTS "saved_courses_user_course_selection_id_idx" ON "saved_courses"("user_course_selection_id");

-- Alter CompletedCourses
ALTER TABLE "CompletedCourses" ADD COLUMN IF NOT EXISTS "user_course_selection_id" TEXT;
ALTER TABLE "CompletedCourses" ALTER COLUMN "courseId" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "CompletedCourses_user_course_selection_id_idx" ON "CompletedCourses"("user_course_selection_id");

-- Add foreign keys
ALTER TABLE "user_course_selections" ADD CONSTRAINT "user_course_selections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_course_selections" ADD CONSTRAINT "user_course_selections_template_course_id_fkey" FOREIGN KEY ("template_course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "active_courses" ADD CONSTRAINT "active_courses_user_course_selection_id_fkey" FOREIGN KEY ("user_course_selection_id") REFERENCES "user_course_selections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompletedCourses" ADD CONSTRAINT "CompletedCourses_user_course_selection_id_fkey" FOREIGN KEY ("user_course_selection_id") REFERENCES "user_course_selections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_courses" ADD CONSTRAINT "saved_courses_user_course_selection_id_fkey" FOREIGN KEY ("user_course_selection_id") REFERENCES "user_course_selections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
