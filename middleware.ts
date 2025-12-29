import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
    const { pathname, searchParams } = req.nextUrl;

    // 1. Prefetch(RSC) 요청은 리다이렉트 로직에서 제외하여 성능 부하 감소
    if (req.headers.get("x-middleware-prefetch") || searchParams.has("_rsc")) {
        return NextResponse.next();
    }

    // 2. [수정] 특정 상세 경로 리다이렉트를 상단으로 이동 (우선순위 조정)
    const match = pathname.match(/^\/escape\/(\d+)(?:\/?|$)/);
    if (match) {
        const id = match[1];
        const url = req.nextUrl.clone();
        url.pathname = "/escape/intro";
        url.searchParams.set("id", id);
        return NextResponse.redirect(url);
    }

    // 3. [수정] "준비 중" 차단 로직에서 'intro' 등 허용 경로는 제외하여 루프 방지
    // /escape/intro 자체도 /로 튕겨버리면 무한 루프가 발생함
    const isEscapePage = pathname.startsWith("/escape") && !pathname.startsWith("/api/");
    const isExcludedPath = pathname.startsWith("/escape/intro") || pathname === "/login";

    if (isEscapePage && !isExcludedPath) {
        const url = req.nextUrl.clone();
        url.pathname = "/";
        url.searchParams.set("alert", "coming_soon_escape");
        return NextResponse.redirect(url);
    }

    // 4. 전역 인증 가드 (보안 강화 반영)
    if (pathname.startsWith("/escape") || pathname.startsWith("/api/escape")) {
        const isApi = pathname.startsWith("/api/");
        // 서버 사이드 보안 쿠키(httpOnly) 확인
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

    return NextResponse.next();
}

export const config = {
    // 최적화: 불필요한 이미지, 정적 파일 요청은 미들웨어를 타지 않도록 설정
    matcher: ["/escape/:path*", "/api/escape/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
