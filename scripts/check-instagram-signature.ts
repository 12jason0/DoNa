// 인스타 웹훅 서명 검증 점검: npx tsx scripts/check-instagram-signature.ts
import assert from "node:assert";
import { createHmac } from "node:crypto";
import { validMetaSignature } from "../src/lib/instagramDm";

const secret = "test-secret";
const body = '{"object":"instagram","entry":[{"id":"1","messaging":[{"message":{"text":"안녕하세요"}}]}]}';
const sig = "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");

assert.equal(validMetaSignature(body, sig, secret), true);
assert.equal(validMetaSignature(body + " ", sig, secret), false); // 본문 바뀜
assert.equal(validMetaSignature(body, sig, "other-secret"), false); // 다른 앱 시크릿
assert.equal(validMetaSignature(body, sig.replace("sha256=", ""), secret), false); // 접두사 없음
assert.equal(validMetaSignature(body, null, secret), false);
assert.equal(validMetaSignature(body, sig, undefined), false); // 시크릿 없으면 전부 거부
console.log("ok");

// 원본 바이트로 계산: 한글이 이스케이프된 본문을 파싱 후 다시 문자열로 만들면 서명이 달라짐
const bs = String.fromCharCode(92); // 백슬래시
const escaped = Buffer.from(`{"text":"${bs}uc548${bs}ub155"}`, "utf8"); // 메타처럼 한글("안녕")을 유니코드 이스케이프한 본문
const sig2 = "sha256=" + createHmac("sha256", secret).update(escaped).digest("hex");
assert.equal(validMetaSignature(escaped, sig2, secret), true);
assert.equal(validMetaSignature(JSON.stringify(JSON.parse(escaped.toString())), sig2, secret), false);
// 시크릿 앞뒤 공백·줄바꿈은 무시
assert.equal(validMetaSignature(escaped, sig2, ` ${secret}\n`), true);
console.log("ok bytes");
