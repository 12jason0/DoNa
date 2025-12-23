const jwt = require("jsonwebtoken");

// 1월 1일 "두나" 배포 성공을 위한 필수 수정
const TEAM_ID = "RZCM47FCAG";
const KEY_ID = "6ST6FV78K8";

/** * ⚠️ 가장 중요한 수정 부분:
 * 앱 번들 ID(kr.io.dona.dona)가 아니라
 * 반드시 .sid로 끝나는 서비스 ID를 넣어야 합니다.
 */
const CLIENT_ID = "kr.io.dona.dona.sid";

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg/buucZm86uUh/ToN
dxiNPNohsCZgHUYIHm0yIlhc06CgCgYIKoZIzj0DAQehRANCAATVU/m0E4JIBX9K
SeJYXe+0hqjIKWl5iMx6mCUOK1AOptwasCxSBoymgfgpoJLLF03kmI8HEoJweB4A
7hW+/7WD
-----END PRIVATE KEY-----`;

const token = jwt.sign({}, PRIVATE_KEY, {
    algorithm: "ES256",
    expiresIn: "180d", // 유효기간 6개월
    issuer: TEAM_ID,
    subject: CLIENT_ID, // ⚠️ 서비스 ID가 들어감
    keyid: KEY_ID,
    audience: "https://appleid.apple.com", // ⚠️ 애플 서버 검증용 수신자 추가
});

console.log("--------------------------------------------------");
console.log("새로운 APPLE_CLIENT_SECRET입니다. 복사해서 Vercel에 넣으세요:");
console.log(token);
console.log("--------------------------------------------------");
