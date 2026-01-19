-- ✅ 안전하게 RewardType enum에 personal_memory_milestone 값 추가
-- ⚠️ 기존 데이터는 모두 보존됩니다!

-- enum 값이 이미 존재하는지 확인하고 없으면 추가
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'personal_memory_milestone' 
        AND enumtypid = (
            SELECT oid 
            FROM pg_type 
            WHERE typname = 'RewardType'
        )
    ) THEN
        ALTER TYPE "RewardType" ADD VALUE 'personal_memory_milestone';
        RAISE NOTICE '✅ personal_memory_milestone 값이 성공적으로 추가되었습니다.';
    ELSE
        RAISE NOTICE 'ℹ️ personal_memory_milestone 값이 이미 존재합니다.';
    END IF;
END $$;
