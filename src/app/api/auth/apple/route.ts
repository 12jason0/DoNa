import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db";
import { getJwtSecret } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 1. 애플 인증 시작 (GET)
export async function GET(request: NextRequest) {
    const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
    const APPLE_REDIRECT_URI = "https://dona.io.kr/api/auth/apple"; // 설정과 일치 필수

    if (!APPLE_CLIENT_ID) return NextResponse.json({ error: "설정 누락" }, { status: 500 });

    const params = new URLSearchParams({
        client_id: APPLE_CLIENT_ID,
        redirect_uri: APPLE_REDIRECT_URI,
        response_type: "code",
        response_mode: "form_post", //
        scope: "name email",
        state: "apple_login_state",
    });

    return NextResponse.redirect(`https://appleid.apple.com/auth/authorize?${params.toString()}`);
}

// 2. 통합 인증 처리 (POST)
export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get("content-type") || "";
        let body: any;

        // A. 애플 서버에서 보낸 form_post 처리 (Web/WebView용)
        if (contentType.includes("application/x-www-form-urlencoded")) {
            const formDataText = await request.text();
            const params = new URLSearchParams(formDataText);
            const code = params.get("code");
            const user = params.get("user"); // 최초 1회만 제공됨

            if (!code) return generateHtmlResponse("window.location.href='/login?error=no_code'");

            // 웹 인증 로직 실행 (handleWebAppleAuth의 로직을 여기서 직접 호출하거나 처리)
            return await handleWebAppleAuthLogic(code, request, user ? JSON.parse(user) : null);
        }

        // B. 모바일 앱에서 직접 보낸 JSON 처리 (App용)
        body = await request.json();
        const { identityToken } = body;

        if (!identityToken) return NextResponse.json({ error: "토큰 없음" }, { status: 400 });

        // identityToken 검증 및 로그인 로직 (기존 앱 로직 사용)
        return await handleAppAppleAuthLogic(identityToken, request);
    } catch (error) {
        console.error("Apple POST Error:", error);
        return NextResponse.json({ error: "서버 오류" }, { status: 500 });
    }
}

// 브라우저/웹뷰에 전달할 HTML 응답 생성 함수
function generateHtmlResponse(script: string) {
    return new Response(`<html><body><script>${script}</script></body></html>`, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}

// 웹/웹뷰용 인증 로직 (토큰 교환 후 부모 창에 알림)
async function handleWebAppleAuthLogic(code: string, request: NextRequest, userData: any) {
    // 1. 애플 서버와 code를 token으로 교환 (APPLE_CLIENT_SECRET 사용)
    // 2. DB 유저 확인 및 생성 (Prisma)
    // 3. 성공 시 JWT 생성
    // ... (기존 handleWebAppleAuth의 DB 저장 로직 수행) ...

    const token = "생성된_JWT_토큰"; // 실제 토큰 생성 로직 필요

    // 마지막에 브라우저에 스크립트 전달
    return generateHtmlResponse(`
        if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loginSuccess', token: '${token}' }));
            window.location.href = '/?login_success=true';
        } else if (window.opener) {
            window.opener.postMessage({ type: 'APPLE_AUTH_CODE', token: '${token}' }, "*");
            window.close();
        } else {
            window.location.href = '/?token=${token}';
        }
    `);
}

// 앱용 로직 (JSON 응답)
async function handleAppAppleAuthLogic(identityToken: string, request: NextRequest) {
    // ... 기존 POST 핸들러의 identityToken 검증 로직 ...
    return NextResponse.json({ success: true, token: "JWT_TOKEN" });
}
