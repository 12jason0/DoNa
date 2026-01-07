import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // 🟢 [배포용 최종 Fix]: 서버 API에서 사용하는 이름과 반드시 일치시켜야 합니다.
    // 쿠키 이름 불일치로 인한 무한 루프 방지
    const token = req.cookies.get("authorization")?.value || req.cookies.get("auth")?.value;
    const isAuth = Boolean(token);

    // 1. Prefetch 및 RSC 요청 제외
    if (req.headers.get("x-middleware-prefetch") || req.nextUrl.searchParams.has("_rsc")) {
        return NextResponse.next();
    }

    // 🟢 [배포용 최종 Fix]: 로그아웃 후 리다이렉트 루프 방지
    // 로그인/회원가입 페이지 예외 처리 - 타임스탬프 파라미터 무시
    if (isAuth && (pathname === "/login" || pathname === "/signup")) {
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

    // 3. 인증이 필요한 경로 가드
    // 🟢 [배포용 최종 Fix]: ?t= 대신 깔끔하게 로그인 페이지로 리다이렉트
    if (pathname.startsWith("/escape") && !isAuth) {
        return NextResponse.redirect(new URL("/login", req.url));
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
