// 팁 후보 판정 규칙 확인: npx tsx scripts/check-tip-judge.ts
import assert from "node:assert";
import { countDistinctSources, judgeCandidate } from "../src/lib/tipPipeline";

const s = (id: number, source_type: string, author: string | null, url: string | null = `u${id}`) => ({ id, source_type, author, url });
const now = Date.parse("2026-10-10");
const recent = new Date("2026-08-01");
const old = new Date("2026-01-01");

// 같은 작성자 글 3개 = 1개
assert.equal(countDistinctSources([s(1, "naver_blog", "a"), s(2, "naver_blog", "a"), s(3, "naver_blog", "a")]), 1);
// 다른 플랫폼 같은 이름은 별개, 작성자 없으면 링크 기준
assert.equal(countDistinctSources([s(1, "naver_blog", "a"), s(2, "kakao_blog", "a"), s(3, "google_review", null, "x"), s(4, "google_review", null, "x")]), 3);

assert.equal(judgeCandidate(3, recent, false, now), "candidate");
assert.equal(judgeCandidate(2, recent, false, now), "needs_check"); // 출처 부족
assert.equal(judgeCandidate(5, old, false, now), "needs_check"); // 6개월 지남
assert.equal(judgeCandidate(5, null, false, now), "needs_check"); // 날짜 모름
assert.equal(judgeCandidate(5, recent, true, now), "needs_check"); // 출처끼리 다름
console.log("ok");
