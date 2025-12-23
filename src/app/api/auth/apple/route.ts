import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db";
import { getJwtSecret } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * 1. Apple 인증 시작 (GET)
 * 유저가 'Apple 로그인' 버튼을 눌렀을 때 애플 로그인 페이지로 보냅니다.
 */
export async function GET(request: NextRequest) {
    const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
    // 애플 개발자 콘솔에 등록한 Return URL과 정확히 일치해야 합니다.
    const APPLE_REDIRECT_URI = "https://dona.io.kr/api/auth/apple";

    if (!APPLE_CLIENT_ID) {
        console.error("APPLE_CLIENT_ID가 설정되지 않았습니다.");
        return NextResponse.json({ error: "Apple 로그인 설정이 누락되었습니다." }, { status: 500 });
    }

    const params = new URLSearchParams({
        client_id: APPLE_CLIENT_ID,
        redirect_uri: APPLE_REDIRECT_URI,
        response_type: "code",
        response_mode: "form_post", // 유저 정보를 POST로 받기 위해 필수
        scope: "name email",
        state: "apple_login_state",
    });

    const appleAuthUrl = `https://appleid.apple.com/auth/authorize?${params.toString()}`;
    return NextResponse.redirect(appleAuthUrl);
}

/**
 * 2. 통합 인증 처리 (POST)
 * 애플 서버(Web) 또는 모바일 앱(Native)으로부터 인증 정보를 받습니다.
 */
export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get("content-type") || "";

        // A. 애플 웹 서버에서 보낸 form_post 처리 (Web/WebView용)
        if (contentType.includes("application/x-www-form-urlencoded")) {
            const formDataText = await request.text();
            const params = new URLSearchParams(formDataText);
            const code = params.get("code");
            const userJson = params.get("user"); // 최초 1회 로그인 시에만 이름 정보가 포함됨

            if (!code) {
                return generateHtmlResponse("window.location.href='/login?error=no_code'");
            }

            let userData = null;
            if (userJson) {
                try {
                    userData = JSON.parse(userJson);
                } catch (e) {
                    console.error("User JSON 파싱 실패:", e);
                }
            }

            // 실제 웹 인증 로직 실행
            return await handleWebAppleAuthLogic(code, request, userData);
        }

        // B. 모바일 앱에서 직접 보낸 JSON 처리 (App Native용)
        const body = await request.json();
        const { identityToken, fullName, email: appEmail } = body;

        if (!identityToken) {
            return NextResponse.json({ error: "Apple 인증 토큰이 필요합니다." }, { status: 400 });
        }

        return await handleAppAppleAuthLogic(identityToken, fullName, appEmail);
    } catch (error) {
        console.error("Apple POST API 오류:", error);
        return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
    }
}

/**
 * 브라우저/웹뷰에 전달할 스크립트가 담긴 HTML 응답 생성
 * 이 스크립트가 실행되어야 멈춰있던 화면이 이동합니다.
 */
function generateHtmlResponse(script: string) {
    return new Response(`<html><head><meta charset="UTF-8"></head><body><script>${script}</script></body></html>`, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}

/**
 * 웹/웹뷰용 실제 인증 및 DB 저장 로직 (핵심)
 * Apple 서버와 통신하여 유효성을 검증하고 유저를 생성/로그인 시킵니다.
 */
async function handleWebAppleAuthLogic(code: string, request: NextRequest, userData: any) {
    try {
        // 1. 애플 서버와 code를 실제 token으로 교환
        const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: process.env.APPLE_CLIENT_ID!,
                client_secret: process.env.APPLE_CLIENT_SECRET!, // Vercel 환경변수 필수
                code: code,
                grant_type: "authorization_code",
                redirect_uri: "https://dona.io.kr/api/auth/apple",
            }).toString(),
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
            throw new Error(tokenData.error_description || "애플 토큰 교환 실패");
        }

        // 2. ID 토큰 디코딩하여 유저 식별자(sub) 획득
        const decoded: any = jwt.decode(tokenData.id_token);
        const appleUserId = decoded.sub;
        const email = decoded.email || userData?.email;

        // 3. DB 유저 확인 및 생성 (Prisma)
        let user = await (prisma as any).user.findFirst({
            where: { provider: "apple", socialId: appleUserId },
        });

        if (!user) {
            // 새 유저 생성 (가입 축하 쿠폰 3개 지급 로직 포함)
            user = await (prisma as any).user.create({
                data: {
                    email,
                    username: userData?.name
                        ? `${userData.name.lastName}${userData.name.firstName}`.trim()
                        : `user_${appleUserId.substring(0, 6)}`,
                    socialId: appleUserId,
                    provider: "apple",
                    couponCount: 3,
                },
            });

            // 보상 로그 기록 (선택 사항)
            try {
                await (prisma as any).userReward.create({
                    data: { userId: user.id, type: "signup", amount: 3, unit: "coupon" },
                });
            } catch (e) {
                console.error("보상 기록 실패:", e);
            }
        }

        // 4. 우리 서비스 전용 JWT 생성 (이미 설정된 JWT_SECRET 사용)
        const serviceToken = jwt.sign({ userId: user.id, email: user.email, name: user.username }, getJwtSecret(), {
            expiresIn: "7d",
        });

        // 5. 화면 전환 스크립트 실행
        // localStorage 저장 및 모바일 앱(웹뷰)에 신호 전송
        return generateHtmlResponse(`
            (function() {
                const token = "${serviceToken}";
                localStorage.setItem('authToken', token);
                
                // 모바일 웹뷰 환경일 경우 앱에 로그인 성공 알림
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loginSuccess', token: token }));
                }
                
                // 정식 출시일(1/1) 대응 메인 페이지 이동
                window.location.href = '/?login_success=true';
            })();
        `);
    } catch (err: any) {
        console.error("Web Auth Logic Error:", err);
        return generateHtmlResponse(`window.location.href='/login?error=${encodeURIComponent(err.message)}'`);
    }
}

/**
 * 앱 네이티브용 인증 로직
 * 앱에서 이미 검증된 identityToken을 서버에서 확인하고 로그인 처리합니다.
 */
async function handleAppAppleAuthLogic(identityToken: string, fullName: any, appEmail: string) {
    try {
        const decoded: any = jwt.decode(identityToken);
        const appleUserId = decoded.sub;
        const email = appEmail || decoded.email;

        let user = await (prisma as any).user.findFirst({
            where: { provider: "apple", socialId: appleUserId },
        });

        if (!user) {
            // 앱으로 첫 가입하는 경우 유저 생성
            user = await (prisma as any).user.create({
                data: {
                    email,
                    username: fullName
                        ? `${fullName.familyName}${fullName.givenName}`.trim()
                        : `user_${appleUserId.substring(0, 6)}`,
                    socialId: appleUserId,
                    provider: "apple",
                    couponCount: 3,
                },
            });
        }

        const token = jwt.sign({ userId: user.id, email: user.email, name: user.username }, getJwtSecret(), {
            expiresIn: "7d",
        });

        return NextResponse.json({ success: true, token, user });
    } catch (err) {
        console.error("App Auth Logic Error:", err);
        return NextResponse.json({ error: "인증 처리 중 오류 발생" }, { status: 401 });
    }
}
