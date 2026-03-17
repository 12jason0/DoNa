-- 컨셉 통합 (20개 → 10개)
-- Neon 또는 psql에서 직접 실행: npx prisma migrate deploy 또는 SQL 편집기에서 실행

UPDATE courses SET concept = '이색데이트'
  WHERE concept IN ('테마파크', '핫플레이스', '힙스터');

UPDATE courses SET concept = '감성데이트'
  WHERE concept IN ('전통문화', '골목투어');

UPDATE courses SET concept = '맛집탐방'
  WHERE concept IN ('카페투어');

UPDATE courses SET concept = '실내데이트'
  WHERE concept IN ('쇼핑');

UPDATE courses SET concept = '공연·전시'
  WHERE concept IN ('문화예술', '체험', '기타');
