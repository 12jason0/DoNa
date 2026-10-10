// 팝업 주소 추출 확인: npx tsx scripts/check-popup-address.ts
import assert from "node:assert";
import { extractRoadAddresses } from "../src/lib/popupAddress";

assert.deepEqual(extractRoadAddresses("위치: 서울 성동구 연무장5길 9-29 2층"), ["성동구 연무장5길 9-29"]);
assert.deepEqual(extractRoadAddresses("성동구 연무장 5길 9-29"), ["성동구 연무장5길 9-29"]); // 띄어쓰기 달라도 같은 주소
assert.deepEqual(extractRoadAddresses("성수역에서 차로 5분, 입장료 10,000원"), []);
assert.deepEqual(extractRoadAddresses("제주시 광평중길 82 / 서귀포시 표선관정로117번길 1"), ["제주시 광평중길 82", "서귀포시 표선관정로117번길 1"]);
assert.deepEqual(extractRoadAddresses("서울특별시 성동구연무장5길 9-29"), ["성동구 연무장5길 9-29"]); // 구와 길 이름을 붙여 쓴 경우
console.log("ok");
