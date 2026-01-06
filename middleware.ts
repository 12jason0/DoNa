import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
    const { pathname, searchParams } = req.nextUrl;
    // 서버 사이드 보안 쿠키(httpOnly) 확인
    const hasAuthCookie = Boolean(req.cookies.get("auth")?.value);

    // 1. Prefetch(RSC) 요청은 리다이렉트 로직에서 제외
    if (req.headers.get("x-middleware-prefetch") || searchParams.has("_rsc")) {
        return NextResponse.next();
    }

    // 🟢 [Fix]: 이미 로그인된 유저가 로그인/회원가입 페이지 접근 시 홈으로 튕겨냄
    // 로그인이 성공했는데도 로그인 페이지에 머물러 있는 현상을 방지합니다.
    if (hasAuthCookie && (pathname === "/login" || pathname === "/signup")) {
        return NextResponse.redirect(new URL("/", req.url));
    }

    // 2. 특정 상세 경로 리다이렉트 (escape 관련)
    const match = pathname.match(/^\/escape\/(\d+)(?:\/?|$)/);
    if (match) {
        const id = match[1];
        const url = req.nextUrl.clone();
        url.pathname = "/escape/intro";
        url.searchParams.set("id", id);
        return NextResponse.redirect(url);
    }

    // 3. "준비 중" 차단 로직 (escape)
    const isEscapePage = pathname.startsWith("/escape") && !pathname.startsWith("/api/");
    const isExcludedPath = pathname.startsWith("/escape/intro") || pathname === "/login";

    if (isEscapePage && !isExcludedPath) {
        const url = req.nextUrl.clone();
        url.pathname = "/";
        url.searchParams.set("alert", "coming_soon_escape");
        return NextResponse.redirect(url);
    }

    // 4. 전역 인증 가드 (보안 강화)
    if (pathname.startsWith("/escape") || pathname.startsWith("/api/escape")) {
        const isApi = pathname.startsWith("/api/");

        if (!hasAuthCookie) {
            if (isApi) {
                return new NextResponse(JSON.stringify({ error: "로그인이 필요합니다." }), {
                    status: 401,
                    headers: { "content-type": "application/json; charset=utf-8" },
                });
            } else {
                const url = req.nextUrl.clone();
                url.pathname = "/login";
                url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
                return NextResponse.redirect(url);
            }
        }
    }

    return NextResponse.next();
}

export const config = {
    // 🟢 [Update]: /login과 /signup도 미들웨어가 감시하도록 matcher 추가
    matcher: [
        "/login",
        "/signup",
        "/escape/:path*",
        "/api/escape/:path*",
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};
