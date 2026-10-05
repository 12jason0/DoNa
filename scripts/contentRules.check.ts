// 실행: npx tsx scripts/contentRules.check.ts
import assert from "node:assert";
import { normalizeOpeningHours as n, isValidOpeningHours as v, checkConcepts, checkCategory, checkOpeningHours } from "../src/lib/contentRules";

const cases: [string, string, boolean][] = [
    ["10:00-21:00", "10:00 - 21:00", true],
    ["9:00 - 18:00", "09:00 - 18:00", true],
    ["1130 - 21:30", "11:30 - 21:30", true],
    ["17:00  03:00", "17:00 - 03:00", true],
    ["10: 00 - 22:00", "10:00 - 22:00", true],
    ["11:00~22:00", "11:00 - 22:00", true],
    ["11:00-22:00(예약제)", "11:00 - 22:00(예약제)", true],
    ["월-목: 11:00-14:00, 17:00-21:00 (브레이크 14:00-17:00); 토-일: 11:00-20:00", "월-목: 11:00 - 14:00, 17:00 - 21:00 (브레이크 14:00 - 17:00); 토-일: 11:00 - 20:00", true],
    ["24시간 개방", "24시간 개방", true],
    ["", "", true],
    ["10:00 - 21:000", "10:00 - 21:000", false],
    ["10:00 - 21-30", "10:00 - 21-30", false],
];
for (const [input, out, ok] of cases) {
    assert.equal(n(input), out, input);
    assert.equal(v(n(input)), ok, input);
}
assert.equal(checkConcepts(["힐링", "야경", "가성비"], ["가성비", "힐링", "야경"]), null); // 안 바뀜 → 통과
assert.match(checkConcepts(["힐링", "야경", "가성비"], ["힐링"])!, /최대 2개/);
assert.match(checkConcepts(["골목산책"], null)!, /목록에 없는 컨셉/);
assert.equal(checkCategory("가정,생활", "가정,생활"), null);
assert.match(checkCategory("가정,생활", "카페")!, /목록에 없는/);
assert.equal(checkOpeningHours(n("10:00-21:000"), "10:00-21:000"), null); // 기존 오타 그대로면 통과
assert.match(checkOpeningHours(n("10:00-21:000"), "10:00 - 21:00")!, /형식 오류/);
console.log("contentRules: all checks passed");
