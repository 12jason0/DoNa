-- 팁 파이프라인: 위치 없는 장소 검색어 + 통계용 기록 (2026-10)
-- 새 컬럼은 비어 있거나 기본값으로 채워짐. 기존 데이터는 바뀌지 않음. 여러 번 실행해도 안전.

ALTER TABLE places ADD COLUMN IF NOT EXISTS tip_query varchar(200);          -- 카카오에 없는 장소: 블로그 검색어(이름 + 지역)
ALTER TABLE place_tips ADD COLUMN IF NOT EXISTS edited boolean NOT NULL DEFAULT false; -- 수정 후 승인 여부

CREATE TABLE IF NOT EXISTS tip_runs (
    id             serial PRIMARY KEY,
    place_id       integer NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    kind           varchar(20) NOT NULL, -- pipeline(텔레그램·다시 모으기) / paste(붙여넣기 재생성) / translate(승인 번역)
    started_at     timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at    timestamp(3),
    source_count   integer,
    filtered_count integer,
    candidate      integer,
    official       integer,
    needs_check    integer,
    input_tokens   integer NOT NULL DEFAULT 0,
    output_tokens  integer NOT NULL DEFAULT 0,
    error          text
);
CREATE INDEX IF NOT EXISTS tip_runs_place_id_idx ON tip_runs(place_id);
CREATE INDEX IF NOT EXISTS tip_runs_started_at_idx ON tip_runs(started_at);
