-- 안전하게 reviews 테이블에 imageUrls 컬럼 추가
-- 기존 데이터는 모두 보존됩니다.

-- 1. 컬럼이 이미 존재하는지 확인하고 없으면 추가
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'reviews' 
        AND column_name = 'imageUrls'
    ) THEN
        ALTER TABLE "reviews" ADD COLUMN "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
        RAISE NOTICE 'imageUrls 컬럼이 성공적으로 추가되었습니다.';
    ELSE
        RAISE NOTICE 'imageUrls 컬럼이 이미 존재합니다.';
    END IF;
END $$;
