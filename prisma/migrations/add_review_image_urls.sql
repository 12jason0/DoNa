-- Add imageUrls column to reviews table
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
