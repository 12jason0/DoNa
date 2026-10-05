-- 테스트 결제 표시 (매출 집계 제외용). 코드 배포 전에 운영 DB에 먼저 적용.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- 2026-01-19 ~ 2026-05-24 인앱 테스트 결제 (0원 11건 + 5월 중복 기록)
UPDATE payments SET is_test = true
WHERE method = 'IN_APP' AND approved_at < '2026-06-01';

-- 2026-07-17 본인 계정 테스트 결제
UPDATE payments SET is_test = true WHERE order_id = 'rc_100_1784300637065';
