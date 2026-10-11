// 인스타 계정 추출·주소 비교 점검: npx tsx scripts/check-instagram-handle.ts
import assert from "node:assert";
import { instagramHandleFromUrl, sameAddress } from "../src/lib/instagramHandle";

assert.equal(instagramHandleFromUrl("https://www.instagram.com/pixel.per.inch/"), "pixel.per.inch");
assert.equal(instagramHandleFromUrl("http://instagram.com/Gamegol_Food?hl=ko"), "gamegol_food");
assert.equal(instagramHandleFromUrl("instagram.com/moyang_market"), "moyang_market");
assert.equal(instagramHandleFromUrl("https://www.instagram.com/p/C1abcDEF/"), null); // 게시물
assert.equal(instagramHandleFromUrl("https://www.instagram.com/someone/reels/"), null);
assert.equal(instagramHandleFromUrl("https://linktr.ee/someone"), null); // 링크 모음
assert.equal(instagramHandleFromUrl("https://blog.naver.com/someone"), null);
assert.equal(instagramHandleFromUrl(""), null);

assert.equal(sameAddress("서울 용산구 한강대로54길 7 301호", "서울특별시 용산구 한강대로54길 7"), true);
assert.equal(sameAddress("서울 중구 남대문시장4길 21", "서울특별시 중구 남대문시장4길 9"), false); // 번지 다름
assert.equal(sameAddress("서울 마포구 연남동 390-24", "서울특별시 중구 마른내로2길 15-24", "서울특별시 중구 초동 46"), false);
assert.equal(sameAddress("경기 부천시 원미구 역곡동 79", "경기도 부천시 원미구 부일로 714", "경기도 부천시 원미구 역곡동 79"), true);
console.log("ok");
