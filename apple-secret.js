const jwt = require("jsonwebtoken");

const TEAM_ID = "RZCM47FCAG"; //
const CLIENT_ID = "kr.io.dona.dona";
const KEY_ID = "6ST6FV78K8"; //
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg/buucZm86uUh/ToN
dxiNPNohsCZgHUYIHm0yIlhc06CgCgYIKoZIzj0DAQehRANCAATVU/m0E4JIBX9K
SeJYXe+0hqjIKWl5iMx6mCUOK1AOptwasCxSBoymgfgpoJLLF03kmI8HEoJweB4A
7hW+/7WD
-----END PRIVATE KEY-----`;

const token = jwt.sign({}, PRIVATE_KEY, {
    algorithm: "ES256",
    expiresIn: "180d",
    issuer: TEAM_ID,
    subject: CLIENT_ID,
    keyid: KEY_ID,
});

console.log(token);
