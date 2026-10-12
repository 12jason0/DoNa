// 팁 활동 가격 확인 규칙: npx tsx scripts/check-tip-price.ts
import assert from "node:assert";
import { contentPriceMismatch, hasPrice, moneyAmounts, pickTipPrice, priceInSource } from "../src/lib/tipPrice";

// 금액 읽기: 단위 변환만, "원" 붙은 것만
assert.deepEqual(moneyAmounts("대여 10,000원 / 필름 5천원"), [5000, 10000]);
assert.deepEqual(moneyAmounts("1만 5천원"), [15000]);
assert.deepEqual(moneyAmounts("1.5만원"), [15000]);
assert.deepEqual(moneyAmounts("하루 1만명 방문, 5천보 걷기"), []);
assert.deepEqual(moneyAmounts("2인 3만원"), [30000]);

// 근거에 같은 금액이 있어야 인정 (표기 달라도 같은 금액이면 OK)
assert.ok(priceInSource("1만원(필름 별도)", "필름카메라 대여는 10,000원이고 필름은 따로 사야 해요"));
assert.ok(!priceInSource("1만원", "대여료 12,000원")); // 다른 금액
assert.ok(!priceInSource("2만원", "1인 1만원")); // 계산(×2) 금지
assert.ok(!priceInSource("저렴함", "1만원")); // 금액 없음
assert.ok(priceInSource("무료", "체험은 무료로 진행돼요"));
assert.ok(!priceInSource("무료", "체험비 5,000원")); // 근거에 무료 없으면 무료 아님

// 근거별 가격이 다르면 가장 최근 글, 나머지는 others, 근거에 없는 숫자는 unverified
const src = new Map([
    [1, { text: "대여 8,000원", written_at: new Date("2025-03-01") }],
    [2, { text: "대여 1만원 (필름 별도)", written_at: new Date("2026-09-01") }],
    [3, { text: "후기 좋음", written_at: new Date("2026-10-01") }],
    [4, { text: "1만원이었어요", written_at: null }],
]);
const p = pickTipPrice(
    [
        { value: "8천원", source_id: 1 },
        { value: "1만원", source_id: 2 },
        { value: "1만2천원", source_id: 3 },
        { value: "1만원", source_id: 4 },
        { value: "1만원", source_id: 99 }, // 없는 근거 번호는 버림
    ],
    src
);
assert.equal(p.value, "1만원");
assert.equal(p.source_id, 2);
assert.equal(p.written_at, "2026-09-01");
assert.deepEqual(p.others, [{ value: "8천원", source_id: 1, written_at: "2025-03-01" }]); // 같은 값(#4)은 안 보임
assert.deepEqual(p.unverified, [{ value: "1만2천원", source_id: 3 }]);
// 못 찾으면 value null = 가격 확인 필요
assert.equal(pickTipPrice([], src).value, null);

// 문장 가격 확인
assert.ok(hasPrice("필름카메라 대여 1만원 — 다음날 반납"));
assert.ok(!hasPrice("필름카메라 대여 가능 — 다음날 반납"));
assert.ok(contentPriceMismatch("대여 8천원 — 다음날 반납", p));
assert.ok(!contentPriceMismatch("대여 10,000원 — 다음날 반납", p));
assert.ok(!contentPriceMismatch("대여 가능 — 다음날 반납", p));

console.log("팁 가격 규칙 통과");
