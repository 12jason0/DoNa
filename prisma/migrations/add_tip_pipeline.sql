-- 두나 팁 파이프라인 1차 (2026-10)
-- 모두 새 테이블/새 nullable 컬럼이라 기존 데이터에 영향 없음. 여러 번 실행해도 안전.

ALTER TABLE places ADD COLUMN IF NOT EXISTS tip_status varchar(20); -- collecting / review / done / recheck

CREATE TABLE IF NOT EXISTS tip_sources (
    id           serial PRIMARY KEY,
    place_id     integer NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    source_type  varchar(20) NOT NULL, -- google_info / google_review / naver_blog / kakao_blog / kakao_cafe / owner_text
    author       varchar(200),
    title        text,
    content      text,
    url          text,
    written_at   timestamp(3),
    collected_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS tip_sources_place_id_idx ON tip_sources(place_id);

CREATE TABLE IF NOT EXISTS tip_candidates (
    id               serial PRIMARY KEY,
    place_id         integer NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    category         varchar(30) NOT NULL,
    content          text NOT NULL,
    status           varchar(20) NOT NULL, -- candidate / needs_check / approved / rejected
    conflict         boolean NOT NULL DEFAULT false,
    source_ids       integer[] NOT NULL DEFAULT '{}',
    source_count     integer NOT NULL DEFAULT 0,
    latest_source_at timestamp(3),
    created_at       timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at       timestamp(3)
);
CREATE INDEX IF NOT EXISTS tip_candidates_place_id_idx ON tip_candidates(place_id);

CREATE TABLE IF NOT EXISTS place_tips (
    id           serial PRIMARY KEY,
    place_id     integer NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    category     varchar(30) NOT NULL,
    content      text NOT NULL,
    content_en   text,
    content_ja   text,
    content_zh   text,
    candidate_id integer,
    approved_at  timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS place_tips_place_id_idx ON place_tips(place_id);

CREATE TABLE IF NOT EXISTS tip_work_logs (
    id               serial PRIMARY KEY,
    place_id         integer NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    opened_at        timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_approved_at timestamp(3),
    approved_count   integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS tip_work_logs_place_id_idx ON tip_work_logs(place_id);
