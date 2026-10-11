// 승인 팁 수정·내리기 때 코스 팁 JSON 편집 점검: npx tsx scripts/check-tip-json-edit.ts
import assert from "node:assert";
import { replaceTipInJson } from "../src/lib/tipPipeline";
import { parseTipsFromDb } from "../src/types/tip";

const col = JSON.stringify([
    { category: "CAUTION", content: "A" },
    { category: "GOOD_TO_KNOW", content: "B" },
    { category: "CAUTION", content: "B" },
]);
const read = (c: string | null) => parseTipsFromDb(c).map((t) => `${t.category}:${t.content}`);

// 빼기: 카테고리까지 같은 것만
assert.deepEqual(read(replaceTipInJson(col, "CAUTION", "B", null)), ["CAUTION:A", "GOOD_TO_KNOW:B"]);
// 바꾸기: 자리 유지
assert.deepEqual(read(replaceTipInJson(col, "CAUTION", "A", { category: "WAITING", content: "A2" })), ["WAITING:A2", "GOOD_TO_KNOW:B", "CAUTION:B"]);
// 없는 문장·빈 칸은 그대로
assert.equal(replaceTipInJson(col, "CAUTION", "없음", null), col);
assert.equal(replaceTipInJson(null, "CAUTION", "A", null), null);
assert.equal(replaceTipInJson(col, "CAUTION", null, null), col);
console.log("ok");
