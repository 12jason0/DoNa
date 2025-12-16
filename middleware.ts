import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // --- [추가] escape 경로 페이지 접근 차단 (준비 중) ---
    if (pathname.startsWith("/escape") && !pathname.startsWith("/api/")) {
        const url = req.nextUrl.clone();
        url.pathname = "/";
        url.searchParams.set("alert", "coming_soon_escape");
        return NextResponse.redirect(url);
    }

    // --- escape 전역 인증 가드: 페이지 및 API ---
    if (pathname.startsWith("/escape") || pathname.startsWith("/api/escape")) {
        const isApi = pathname.startsWith("/api/");
        const hasAuthCookie = Boolean(req.cookies.get("auth")?.value);
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

    // --- 기존 escape 경로 리다이렉트 유지 ---
    const match = pathname.match(/^\/escape\/(\d+)(?:\/?|$)/);
    if (match) {
        const id = match[1];
        const url = req.nextUrl.clone();
        url.pathname = "/escape/intro";
        url.searchParams.set("id", id);
        return NextResponse.redirect(url);
    }
    return NextResponse.next();
}

export const config = {
    matcher: ["/escape/:path*", "/api/escape/:path*"],
};
