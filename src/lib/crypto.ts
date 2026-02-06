// src/lib/crypto.ts
// AES-256-CBC 암호화 모듈 (디지털 금고 구현용)
import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const ENCRYPTION_KEY = process.env.AES_ENCRYPTION_KEY || "";
const IV_LENGTH = 16;

// 키 유효성 검사 (서버 시작 시 체크용)
if (!ENCRYPTION_KEY || Buffer.byteLength(ENCRYPTION_KEY, "utf8") !== 32) {
    console.warn(
        "[Warning] AES_ENCRYPTION_KEY is not 32 bytes. Check .env (AES-256 requires exactly 32 bytes)"
    );
}

/**
 * AES-256-CBC 암호화 (데이터 저장 시 사용)
 */
export function encrypt(text: string): string {
    if (!text || typeof text !== "string") return text || "";
    if (!ENCRYPTION_KEY) return text;

    const iv = crypto.randomBytes(IV_LENGTH);
    const key = Buffer.from(ENCRYPTION_KEY, "utf8").subarray(0, 32);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return iv.toString("hex") + ":" + encrypted.toString("hex");
}

/**
 * AES-256-CBC 복호화 (데이터 조회 시 사용)
 * 기존 평문 데이터 호환: 복호화 실패 시 원본 반환
 */
export function decrypt(text: string): string {
    if (!text || typeof text !== "string") return text || "";
    if (!ENCRYPTION_KEY) return text;

    const textParts = text.split(":");
    if (textParts.length < 2) return text; // 기존 평문 데이터

    try {
        const iv = Buffer.from(textParts.shift()!, "hex");
        const encryptedText = Buffer.from(textParts.join(":"), "hex");
        const key = Buffer.from(ENCRYPTION_KEY, "utf8").subarray(0, 32);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString("utf8");
    } catch {
        return text; // 복호화 실패 시 원본 반환 (기존 데이터 호환)
    }
}
