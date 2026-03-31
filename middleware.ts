import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

async function resolveUserIdEdge(req: NextRequest): Promise<number | null> {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) return null;

    const token =
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        req.cookies.get("auth")?.value ||
        req.cookies.get("authorization")?.value ||
        null;
    if (!token) return null;

    try {
        const key = new TextEncoder().encode(secret);
        const { payload } = await jwtVerify(token, key);
        const userId = Number((payload as any).userId);
        return Number.isFinite(userId) && userId > 0 ? userId : null;
    } catch {
        return null;
    }
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Edge Runtime 호환: jose 사용 (jsonwebtoken은 Node.js crypto 미지원)
    const resolvedUserId = await resolveUserIdEdge(req);
    const isAuth = Boolean(resolvedUserId && resolvedUserId > 0);

    // 1. Prefetch 및 RSC 요청 제외
    if (req.headers.get("x-middleware-prefetch") || req.nextUrl.searchParams.has("_rsc")) {
        return NextResponse.next();
    }

    // 🔴 [Fix]: 로그아웃 파라미터 처리 - 로그아웃 직후 메인으로 이동할 때 리다이렉트 방지
    if (req.nextUrl.searchParams.has("logout")) {
        // 로그아웃 파라미터가 있으면 메인 페이지에서 인증 체크를 건너뛰고 통과
        if (pathname === "/") {
            return NextResponse.next();
        }
        // 다른 경로에서는 파라미터 제거하여 깔끔한 URL 유지
        const cleanUrl = req.nextUrl.clone();
        cleanUrl.searchParams.delete("logout");
        return NextResponse.redirect(cleanUrl);
    }

    // 🟢 [배포용 최종 Fix]: 로그아웃 후 리다이렉트 루프 방지
    // 로그인/회원가입 페이지 예외 처리 - 타임스탬프 파라미터 무시
    if (isAuth && (pathname === "/login" || pathname === "/signup")) {
        // 🟢 [Fix]: 절대 URL 생성 시 IP 노출 방지 - clone() 사용
        const homeUrl = req.nextUrl.clone();
        homeUrl.pathname = "/";
        return NextResponse.redirect(homeUrl);
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
    // 🟢 [Fix]: API 요청(fetch)인데 인증이 없는 경우 리다이렉트 대신 401 응답
    // 앱에서 fetch 호출 시 302 리다이렉트가 발생하면 에러가 날 수 있음
    const isApiRequest = pathname.startsWith("/api");

    if (pathname.startsWith("/escape") && !isAuth) {
        if (isApiRequest) {
            return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }
        // 🟢 [Fix]: 절대 URL 생성 시 IP 노출 방지 - clone() 사용
        const loginUrl = req.nextUrl.clone();
        loginUrl.pathname = "/login";
        return NextResponse.redirect(loginUrl);
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
