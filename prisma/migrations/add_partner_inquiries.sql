-- 제휴·광고 문의 (/partner 폼 → 관리자 /admin/partner) (2026-10)
-- 새 테이블만 추가. 기존 데이터는 바뀌지 않음. 여러 번 실행해도 안전.

CREATE TABLE IF NOT EXISTS partner_inquiries (
    id           serial PRIMARY KEY,
    brand_name   varchar(100) NOT NULL,
    contact_name varchar(50)  NOT NULL,
    contact      varchar(100) NOT NULL, -- 전화 또는 이메일
    inquiry_type varchar(20)  NOT NULL CHECK (inquiry_type IN ('popup', 'place', 'ad', 'etc')),
    message      varchar(2000) NOT NULL,
    status       varchar(20)  NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'done')),
    created_at   timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS partner_inquiries_created_at_idx ON partner_inquiries(created_at);
