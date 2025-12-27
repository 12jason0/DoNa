import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db";
import { getJwtSecret } from "@/lib/auth";
import { getSafeRedirectPath } from "@/lib/redirect";
import { getS3StaticUrl } from "@/lib/s3Static";

export const dynamic = "force-dynamic";

/**
 * 💡 Redirect URI 생성 (애플 설정과 100% 일치)
 * image_e89e4a에서 설정하신 주소와 토씨 하나 안 틀리고 똑같이 맞춰줍니다.
 */
const getAppleRedirectUri = (origin: string) => {
    const base = process.env.NODE_ENV === "production" ? "https://dona.io.kr" : origin;
    return `${base}/api/auth/apple/callback`;
};

/**
 * 1. Apple 인증 시작 (GET)
 */
export async function GET(request: NextRequest) {
    const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
    const next = getSafeRedirectPath(request.nextUrl.searchParams.get("next"), "/");

    if (!APPLE_CLIENT_ID) {
        return NextResponse.json({ error: "Apple 로그인 설정 누락" }, { status: 500 });
    }

    const origin = request.nextUrl.origin.includes("0.0.0.0") ? "http://localhost:3000" : request.nextUrl.origin;
    const APPLE_REDIRECT_URI = getAppleRedirectUri(origin);

    const params = new URLSearchParams({
        client_id: APPLE_CLIENT_ID,
        redirect_uri: APPLE_REDIRECT_URI, // 👈 invalid_request 해결 핵심
        response_type: "code id_token",
        response_mode: "form_post",
        scope: "name email",
        state: next,
    });

    const appleAuthUrl = `https://appleid.apple.com/auth/authorize?${params.toString()}`;
    return NextResponse.redirect(appleAuthUrl);
}

/**
 * 2. 통합 인증 처리 (POST)
 */
export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get("content-type") || "";

        // A. 웹/웹뷰 콜백 (Form POST 방식)
        if (contentType.includes("application/x-www-form-urlencoded")) {
            const formDataText = await request.text();
            const params = new URLSearchParams(formDataText);
            const id_token = params.get("id_token");
            const state = params.get("state") || "/";
            const next = getSafeRedirectPath(state, "/");

            if (!id_token) {
                return generateHtmlResponse(`alert('토큰이 없습니다.'); window.location.href='/login';`);
            }
            return await handleWebAppleAuthLogic(id_token, next);
        }

        // B. 앱 네이티브 (Face ID 인증 데이터 - JSON 방식)
        const body = await request.json();
        const { identityToken, fullName, email: appEmail, authorizationCode } = body;

        if (!identityToken) {
            return NextResponse.json({ error: "인증 토큰 누락" }, { status: 400 });
        }
        return await handleAppAppleAuthLogic(request, identityToken, fullName, appEmail, authorizationCode);
    } catch (error) {
        console.error("Apple POST API 오류:", error);
        return NextResponse.json({ error: "서버 오류" }, { status: 500 });
    }
}

/**
 * 💡 웹 전용 로직 (신규 가입 혜택 및 리다이렉트 포함)
 */
async function handleWebAppleAuthLogic(idToken: string, next: string) {
    try {
        const decoded: any = jwt.decode(idToken);
        const appleUserId = decoded.sub;
        const email = decoded.email;

        // 🟢 두나 기본 프로필 이미지 설정 (로컬 로그인과 동일)
        const DEFAULT_PROFILE_IMG = getS3StaticUrl("profileLogo.png");

        let user = await (prisma as any).user.findFirst({
            where: { provider: "apple", socialId: appleUserId },
        });

        if (!user) {
            // [기능 유지] 신규 가입 시 쿠키 3개 지급 로직
            user = await (prisma as any).user.create({
                data: {
                    email,
                    username: `user_${appleUserId.substring(0, 6)}`,
                    socialId: appleUserId,
                    provider: "apple",
                    couponCount: 3,
                    profileImageUrl: DEFAULT_PROFILE_IMG, // 🟢 두나 기본 프로필 이미지 설정
                },
            });
            await (prisma as any).userReward.create({
                data: { userId: user.id, type: "signup", amount: 3, unit: "coupon" },
            });
        } else {
            // 🟢 기존 사용자의 경우 프로필 이미지가 없으면 기본 이미지로 업데이트
            if (!user.profileImageUrl) {
                await (prisma as any).user.update({
                    where: { id: user.id },
                    data: { profileImageUrl: DEFAULT_PROFILE_IMG },
                });
                user.profileImageUrl = DEFAULT_PROFILE_IMG;
            }
        }

        const serviceToken = jwt.sign({ userId: user.id, name: user.username }, getJwtSecret(), { expiresIn: "7d" });
        const decodedNext = decodeURIComponent(next).replace(/^%2F/, "/"); // 👈 %2F 404 해결

        return generateHtmlResponse(
            `(function() {
                window.dispatchEvent(new CustomEvent('authLoginSuccess'));
                if (window.opener) {
                    window.opener.location.href = "${decodedNext}";
                    window.close();
                } else {
                    window.location.href = "${decodedNext}";
                }
            })();`,
            serviceToken
        );
    } catch (err) {
        return generateHtmlResponse(`alert('인증 실패'); window.location.href='/login';`);
    }
}

/**
 * 💡 앱 네이티브 로직 (Face ID 지원 및 로그 저장)
 */
async function handleAppAppleAuthLogic(
    request: NextRequest,
    identityToken: string,
    fullName: any,
    appEmail: string,
    authorizationCode?: string
) {
    try {
        const decoded: any = jwt.decode(identityToken);
        const appleUserId = decoded.sub;
        const email = appEmail || decoded.email;

        // 🟢 두나 기본 프로필 이미지 설정 (로컬 로그인과 동일)
        const DEFAULT_PROFILE_IMG = getS3StaticUrl("profileLogo.png");

        let user = await (prisma as any).user.findFirst({
            where: { provider: "apple", socialId: appleUserId },
        });

        if (!user) {
            user = await (prisma as any).user.create({
                data: {
                    email,
                    username: fullName
                        ? `${fullName.familyName || ""}${fullName.givenName || ""}`.trim()
                        : `user_${appleUserId.substring(0, 6)}`,
                    socialId: appleUserId,
                    provider: "apple",
                    couponCount: 3,
                    profileImageUrl: DEFAULT_PROFILE_IMG, // 🟢 두나 기본 프로필 이미지 설정
                },
            });
            await (prisma as any).userReward.create({
                data: { userId: user.id, type: "signup", amount: 3, unit: "coupon" },
            });
        } else {
            // 🟢 기존 사용자의 경우 프로필 이미지가 없으면 기본 이미지로 업데이트
            if (!user.profileImageUrl) {
                await (prisma as any).user.update({
                    where: { id: user.id },
                    data: { profileImageUrl: DEFAULT_PROFILE_IMG },
                });
                user.profileImageUrl = DEFAULT_PROFILE_IMG;
            }
        }

        const token = jwt.sign({ userId: user.id, name: user.username }, getJwtSecret(), { expiresIn: "7d" });

        // [기능 유지] 로그인 로그 저장 로직
        const ip = request.headers.get("x-forwarded-for") || "unknown";
        await (prisma as any).loginLog.create({
            data: { userId: user.id, ipAddress: Array.isArray(ip) ? ip[0] : ip },
        });

        const res = NextResponse.json({ success: true, user: { id: user.id, name: user.username } });

        // 🟢 보안 쿠키 설정 (2025-12-24 개편 내용)
        res.cookies.set("auth", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        });

        return res;
    } catch (err) {
        return NextResponse.json({ error: "App 인증 실패" }, { status: 401 });
    }
}

/**
 * 💡 공통 응답 처리 (보안 쿠키 발급)
 */
function generateHtmlResponse(script: string, token?: string) {
    const html = `<html><head><meta charset="UTF-8"></head><body><script>${script}</script></body></html>`;
    const response = new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });

    if (token) {
        response.cookies.set("auth", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        });
    }
    return response;
}
