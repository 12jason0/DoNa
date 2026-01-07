import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
    const { pathname, searchParams } = req.nextUrl;

    // 🟢 [Fix 1]: 쿠키 이름 일치화 (스크린샷에 나타난 'authorization' 확인)
    // 'auth'와 'authorization' 두 가지 모두를 체크하여 보안을 강화합니다.
    const authCookie = req.cookies.get("authorization")?.value || req.cookies.get("auth")?.value;
    const hasAuthCookie = Boolean(authCookie);

    // 1. Prefetch 및 RSC 요청 제외
    if (req.headers.get("x-middleware-prefetch") || searchParams.has("_rsc")) {
        return NextResponse.next();
    }

    // 🟢 [Fix 2]: 무한 리다이렉트 방지 로직 강화
    // t=... 파라미터가 붙는 이유는 캐시 방지를 위한 리다이렉트가 반복되기 때문입니다.
    const isLoginPage = pathname === "/login";
    const isSignupPage = pathname === "/signup";

    if (hasAuthCookie && (isLoginPage || isSignupPage)) {
        // 이미 로그인된 유저가 로그인 페이지 접근 시 메인으로 이동
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

    // 3. 전역 인증 가드 (보안 및 로그아웃 반영)
    // /escape로 시작하는 모든 경로는 로그인이 필수입니다.
    if (pathname.startsWith("/escape")) {
        if (!hasAuthCookie) {
            // 🟢 [Fix 3]: 로그아웃 후 접근 시 깔끔하게 로그인 페이지로 유도
            const url = new URL("/login", req.url);
            // 이전에 보던 페이지로 돌아오도록 경로 저장 (선택 사항)
            url.searchParams.set("next", pathname);
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * 다음 경로를 제외한 모든 경로에서 미들웨어 실행:
         * - api (API 라우트)
         * - _next/static (정적 파일)
         * - _next/image (이미지 최적화 파일)
         * - favicon.ico (아이콘 파일)
         */
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
};
