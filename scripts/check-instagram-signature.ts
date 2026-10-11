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
