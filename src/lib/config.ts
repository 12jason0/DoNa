export const publicConfig = {
    kakaoClientId: process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
};

export function assertPublicConfig(): void {
    if (!publicConfig.kakaoClientId) {
        throw new Error("NEXT_PUBLIC_KAKAO_CLIENT_ID is required");
    }
}

export const serverConfig = {
    jwtSecret: process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET,
    kakaoClientId: process.env.KAKAO_CLIENT_ID,
    kakaoClientSecret: process.env.KAKAO_CLIENT_SECRET,
};

export function assertServerConfig(): void {
    if (!serverConfig.jwtSecret) {
        throw new Error("JWT_SECRET (or NEXTAUTH_SECRET) is required");
    }
}

/**
 * Apple Client Secret 생성 함수 (JWT 기반)
 * Apple 인증 서버와 통신할 때 사용하는 클라이언트 시크릿을 동적으로 생성합니다.
 */
export function generateAppleClientSecret(
    teamId: string,
    keyId: string,
    privateKey: string,
    clientId: string
): string {
    const jwt = require("jsonwebtoken");
    const token = jwt.sign({}, privateKey, {
        algorithm: "ES256",
        expiresIn: "180d", // 6개월
        issuer: teamId,
        subject: clientId,
        keyid: keyId,
    });
    return token;
}