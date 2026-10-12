// 잠긴 코스 장소 자리표시에 장소를 알아낼 단서가 없는지: npx tsx scripts/check-locked-place.ts
import assert from "node:assert";
import { LOCKED_PLACE_NAME, lockedPlace } from "../src/lib/tipAccess";

const p = lockedPlace("카페");
assert.equal(p.name, LOCKED_PLACE_NAME);
assert.equal(p.category, "카페"); // 앱 잠금 요약 "카페 · 야경 6곳"용
for (const k of ["id", "address", "latitude", "longitude", "imageUrl", "phone", "opening_hours", "reservationUrl", "name_en"] as const)
    assert.equal(p[k], null, k);
assert.equal(lockedPlace(undefined).category, null);
console.log("ok");
