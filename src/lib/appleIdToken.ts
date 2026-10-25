import { createRemoteJWKSet, jwtVerify } from "jose";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_BUNDLE_ID = "kr.io.dona.dona"; // 앱(mobile/app.json bundleIdentifier)에서 받은 토큰의 aud
const appleJwks = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));

/** 애플 identity token 서명·iss·aud(앱 번들 ID, 웹 Services ID)·exp 확인. 실패하면 throw */
export async function verifyAppleIdToken(idToken: string): Promise<{ sub: string; email: string | null }> {
    const webClientId = process.env.APPLE_CLIENT_ID || process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
    const { payload } = await jwtVerify(idToken, appleJwks, {
        issuer: APPLE_ISSUER,
        audience: webClientId ? [APPLE_BUNDLE_ID, webClientId] : [APPLE_BUNDLE_ID],
        algorithms: ["RS256"],
        requiredClaims: ["sub", "exp"],
    });
    return { sub: String(payload.sub), email: typeof payload.email === "string" ? payload.email : null };
}
