// 팁 후보 판정 규칙 확인: npx tsx scripts/check-tip-judge.ts
import assert from "node:assert";
import { branchOf, coreKeywords, countDistinctSources, isRelevant, judgeCandidate } from "../src/lib/tipPipeline";

const s = (id: number, source_type: string, author: string | null, url: string | null = `u${id}`) => ({ id, source_type, author, url });
const now = Date.parse("2026-10-10");
const recent = new Date("2026-08-01");
const old = new Date("2026-01-01");

// 같은 작성자 글 3개 = 1개
assert.equal(countDistinctSources([s(1, "naver_blog", "a"), s(2, "naver_blog", "a"), s(3, "naver_blog", "a")]), 1);
// 다른 플랫폼 같은 이름은 별개, 작성자 없으면 링크 기준
assert.equal(countDistinctSources([s(1, "naver_blog", "a"), s(2, "kakao_blog", "a"), s(3, "google_review", null, "x"), s(4, "google_review", null, "x")]), 3);

assert.equal(judgeCandidate(3, recent, false, false, now), "candidate");
assert.equal(judgeCandidate(2, recent, false, false, now), "needs_check"); // 출처 부족
assert.equal(judgeCandidate(5, old, false, false, now), "needs_check"); // 6개월 지남
assert.equal(judgeCandidate(5, null, false, false, now), "needs_check"); // 날짜 모름
assert.equal(judgeCandidate(5, recent, true, false, now), "needs_check"); // 출처끼리 다름
assert.equal(judgeCandidate(1, old, false, true, now), "official"); // 가게 공지·메뉴판의 사실은 1개, 오래돼도 인정
assert.equal(judgeCandidate(1, recent, true, true, now), "needs_check"); // 그래도 출처끼리 다르면 확인 필요
// 가게 이름 핵심 단어: 지점명 빼고, 띄어쓰기 무시
const kw = coreKeywords("한림칼국수 공항점");
assert.deepEqual(kw, ["한림칼국수"]);
assert.ok(isRelevant(kw, "제주 한림 칼국수 후기", null));
assert.ok(!isRelevant(kw, "전국 로또 판매점 주소록", "칼국수 맛집"));
assert.ok(isRelevant(coreKeywords("4233 마음센터"), "안국 4233마음센터 다녀옴", null));
// 지점: 다른 지점이 브랜드 바로 뒤에 적힌 글만 관련 없음
const br = branchOf("한림칼국수 공항점");
assert.equal(br, "공항점");
assert.equal(branchOf("4233 마음센터"), null);
assert.ok(!isRelevant(kw, "제주도 여행 4일차", "한림칼국수 함덕점으로 갔다", br));
assert.ok(!isRelevant(kw, "한림칼국수 제주본점 보말칼국수", null, br));
assert.ok(isRelevant(kw, "한림 칼국수 제주공항점 후기", null, br)); // 우리 지점
assert.ok(isRelevant(kw, "본점 또는 표선점, 한림칼국수 제주공항점", null, br)); // 우리 지점도 언급
assert.ok(isRelevant(kw, "한림칼국수 다녀왔어요", "점심으로 딱", br)); // 지점 언급 없음
assert.ok(isRelevant(kw, "한림칼국수점심 메뉴", null, br)); // "점심"은 지점 아님
console.log("ok");
