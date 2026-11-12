import { createRemoteJWKSet, jwtVerify } from "jose";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_BUNDLE_ID = "kr.io.dona.dona"; // 앱(mobile/app.json bundleIdentifier)에서 받은 토큰의 aud
const appleJwks = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));

/** 웹 로그인(Services ID) client_id. 2025-12 웹에서 받은 옛 refresh_token은 모두 이 값으로 발급됨 */
export function appleWebClientId(): string | undefined {
    return process.env.APPLE_CLIENT_ID || process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
}

/** 웹 로그인 Redirect URI (애플 개발자 포털 값과 정확히 일치해야 함). code 교환 때도 같은 값을 보내야 함 */
export function getAppleRedirectUri(origin: string): string {
    if (process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI) {
        return process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI;
    }
    // 프로덕션은 고정 도메인, 개발은 동적 origin
    const base = process.env.NODE_ENV === "production" ? "https://dona.io.kr" : origin;
    return `${base}/api/auth/apple/callback`;
}

/** 애플 identity token 서명·iss·aud(앱 번들 ID, 웹 Services ID)·exp 확인. 실패하면 throw.
 *  aud = 이 토큰을 받은 client_id (앱: 번들 ID, 웹: Services ID) */
export async function verifyAppleIdToken(
    idToken: string
): Promise<{ sub: string; email: string | null; aud: string }> {
    const webClientId = appleWebClientId();
    const { payload } = await jwtVerify(idToken, appleJwks, {
        issuer: APPLE_ISSUER,
        audience: webClientId ? [APPLE_BUNDLE_ID, webClientId] : [APPLE_BUNDLE_ID],
        algorithms: ["RS256"],
        requiredClaims: ["sub", "exp"],
    });
    const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
    return {
        sub: String(payload.sub),
        email: typeof payload.email === "string" ? payload.email : null,
        aud: String(aud),
    };
}

/** 애플 토큰 API(/auth/token, /auth/revoke)용 client_secret. clientId는 토큰을 받은/받을 client_id와 같아야 함 */
export function appleClientSecret(clientId: string): string {
    const privateKey = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
    return jwt.sign({}, privateKey, {
        algorithm: "ES256",
        expiresIn: "1h",
        audience: APPLE_ISSUER, // 빠지면 애플이 invalid_client로 거절함 (2025-12 앱 경로가 이걸로 실패)
        issuer: process.env.APPLE_TEAM_ID!,
        subject: clientId,
        keyid: process.env.APPLE_KEY_ID!,
    });
}

/**
 * 로그인 때 받은 authorization code를 refresh_token으로 바꿔 저장 (탈퇴 시 연동 해제용).
 * 실패해도 throw하지 않음: 로그인은 이 결과와 상관없이 진행돼야 함.
 * redirectUri: 웹은 authorize 때 보낸 값과 같아야 하고, 앱 네이티브는 넘기지 않음.
 */
export async function saveAppleRefreshToken(
    userId: number,
    code: string | null | undefined,
    clientId: string,
    redirectUri?: string
): Promise<void> {
    if (!code) return;
    try {
        const body = new URLSearchParams({
            client_id: clientId,
            client_secret: appleClientSecret(clientId),
            code,
            grant_type: "authorization_code",
        });
        if (redirectUri) body.set("redirect_uri", redirectUri);
        const res = await fetch(`${APPLE_ISSUER}/auth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.refresh_token) {
            console.error(`[Apple Auth] refresh_token 교환 실패 (User ${userId}, client ${clientId}):`, res.status, data.error);
            return;
        }
        await (prisma as any).user.update({
            where: { id: userId },
            data: { appleRefreshToken: data.refresh_token, appleTokenClientId: clientId },
        });
    } catch (e) {
        console.error(`[Apple Auth] refresh_token 저장 중 오류 (User ${userId}):`, (e as Error).message);
    }
}
