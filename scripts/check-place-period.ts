// 기간 인식 확인: npx tsx scripts/check-place-period.ts
import assert from "node:assert";
import { kstToday, parsePeriod, ymd } from "../src/lib/placePeriod";

const now = new Date("2026-10-10T03:00:00Z"); // KST 2026-10-10 12:00
const p = (s: string) => {
    const r = parsePeriod(s, now);
    return r && [r.rest, ymd(r.start), ymd(r.end)];
};
assert.deepEqual(p("놀자! 시공간 대모험, 성수, 10/17~1/24"), ["놀자! 시공간 대모험, 성수", "2026-10-17", "2027-01-24"]); // 종료가 앞이면 다음 해
assert.deepEqual(p("짱구 전시 | 성수 | 10/17~12/24"), ["짱구 전시 | 성수", "2026-10-17", "2026-12-24"]);
assert.deepEqual(p("짱구 전시 성수 10/17 ~ 1/24"), ["짱구 전시 성수", "2026-10-17", "2027-01-24"]);
assert.deepEqual(p("짱구 전시, 성수, 2026.11.1-2027.2.28"), ["짱구 전시, 성수", "2026-11-01", "2027-02-28"]);
assert.deepEqual(p("짱구 전시 10월17일~1월24일"), ["짱구 전시", "2026-10-17", "2027-01-24"]);
assert.equal(p("4233 마음센터, 안국"), null); // 기간 없음 = 상설
assert.equal(p("짱구 전시 13/1~2/30"), null); // 잘못된 날짜
assert.equal(ymd(kstToday(new Date("2026-10-10T16:00:00Z"))), "2026-10-11"); // UTC 16시 = KST 다음날 1시
console.log("ok");
