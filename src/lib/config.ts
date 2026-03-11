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
    /** 🟢 [보안] 테스트 계정 이메일 목록 (쉼표 구분). 프로덕션에서는 빈 값 권장. GPS 등 특수 로직 건너뛸 때만 사용 */
    testAccounts: process.env.TEST_ACCOUNTS
        ? process.env.TEST_ACCOUNTS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
        : [],
};

export function assertServerConfig(): void {
    if (!serverConfig.jwtSecret) {
        throw new Error("JWT_SECRET (or NEXTAUTH_SECRET) is required");
    }
}

/**
 * 테스트 계정 여부 (환경변수 TEST_ACCOUNTS 기준).
 * 프로덕션에서는 TEST_ACCOUNTS를 비우고 사용할 것.
 */
export function isTestAccount(email: string | null | undefined): boolean {
    if (!email || serverConfig.testAccounts.length === 0) return false;
    return serverConfig.testAccounts.includes(email.trim().toLowerCase());
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