-- 팝업·전시처럼 기간 한정 장소 (2026-10)
-- null 허용, null = 상설. 기존 장소는 모두 null(상설)로 남음. 여러 번 실행해도 안전.
ALTER TABLE places ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE places ADD COLUMN IF NOT EXISTS end_date date;
