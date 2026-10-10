// 팝업 표시·영문명 검증 확인: npx tsx scripts/check-popup-format.ts
import assert from "node:assert";
import ko from "../src/i18n/messages/ko/translation.json";
import en from "../src/i18n/messages/en/translation.json";
import ja from "../src/i18n/messages/ja/translation.json";
import { popupBadge, popupName, popupPeriod, popupRegion, type PopupItem } from "../src/lib/popupFormat";
import { verifyOfficialName } from "../src/lib/popupTranslate";

const tOf = (m: any) => (key: string, p?: Record<string, string | number>) =>
    String(key.split(".").reduce((o, k) => o?.[k], m) ?? key).replace(/\{(\w+)\}/g, (_, k) => String(p?.[k] ?? ""));
const base: PopupItem = {
    id: 1, name: "놀자! 시공간 대모험", name_en: "Let's Play! Space-Time Adventure", name_ja: null, name_zh: null, imageUrl: null,
    address: "서울 성동구 연무장5길 9-29", address_en: "9-29, Yeonmujang 5-gil, Seongdong-gu, Seoul", address_ja: "ソウル 城東区 練武場5ギル 9-29", address_zh: null,
    startDate: "2026-10-17", endDate: "2027-01-24", daysToStart: null, daysToEnd: 3, courses: [],
};
assert.equal(popupPeriod(base, tOf(ko), 2026), "10.17 ~ 2027.1.24");
assert.equal(popupPeriod(base, tOf(en), 2026), "10/17 – 1/24/2027");
assert.equal(popupPeriod(base, tOf(ja), 2026), "10月17日〜2027年1月24日");
assert.equal(popupBadge(base, tOf(ko)), "D-3 종료");
assert.equal(popupBadge({ ...base, daysToEnd: 0 }, tOf(en)), "Ends today");
assert.equal(popupBadge({ ...base, daysToEnd: 30 }, tOf(ko)), null);
assert.equal(popupBadge({ ...base, daysToStart: 5 }, tOf(ja)), "5日後に開始");
assert.equal(popupName(base, "en"), "Let's Play! Space-Time Adventure");
assert.equal(popupName(base, "zh"), "놀자! 시공간 대모험"); // 번역 칸 없으면 원문
assert.equal(popupRegion(base, "ko"), "성동구");
assert.equal(popupRegion(base, "en"), "Seongdong-gu");
assert.equal(popupRegion(base, "ja"), "城東区");
// 공식 영문명은 자료에 그대로 있을 때만
assert.equal(verifyOfficialName("Crayon Shinchan Exhibition", ["짱구 전시 (Crayon Shinchan  Exhibition) 성수"]), "Crayon Shinchan Exhibition");
assert.equal(verifyOfficialName("Made Up Name", ["짱구 전시 성수"]), null);
assert.equal(verifyOfficialName(null, ["x"]), null);
// 띄어쓰기 없는 일본어·중국어 주소 (실제 423 번역 결과)
assert.equal(popupRegion({ ...base, address_ja: "ソウル特別市城東区練武場5キル9-29" }, "ja"), "城東区");
assert.equal(popupRegion({ ...base, address_zh: "首尔市城东区练武场5街9-29" }, "zh"), "城东区");
assert.equal(popupRegion({ ...base, address: "서울특별시 성동구 연무장5길 9-29" }, "ko"), "성동구");
console.log("ok");
