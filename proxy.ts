import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveUserId } from "@/lib/auth";

/** src/lib/shareAccess.ts SHARE_DEVICE_COOKIE와 같은 값 */
const SHARE_DEVICE_COOKIE = "dona_did";

async function handleRequest(req: NextRequest): Promise<NextResponse> {
    const { pathname } = req.nextUrl;

    // 공유 링크 열람권 기기 구분: 기기 ID 쿠키가 없으면 발급하고, 같은 요청의 서버 렌더에서도 보이게 요청 쿠키에 주입
    if (pathname.startsWith("/share/course/") && !req.cookies.get(SHARE_DEVICE_COOKIE)) {
        const deviceId = crypto.randomUUID();
        const headers = new Headers(req.headers);
        const cookie = headers.get("cookie");
        headers.set("cookie", `${cookie ? cookie + "; " : ""}${SHARE_DEVICE_COOKIE}=${deviceId}`);
        const res = NextResponse.next({ request: { headers } });
        res.cookies.set(SHARE_DEVICE_COOKIE, deviceId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/share",
            maxAge: 60 * 60 * 24 * 365,
        });
        return res;
    }

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

    // 로그인 여부(JWT + DB token_version)는 아래 /login·/signup·/escape 처리에만 쓰므로 그때만 확인
    const needsAuth = pathname === "/login" || pathname === "/signup" || pathname.startsWith("/escape");
    const isAuth = needsAuth && (await resolveUserId(req)) !== null;

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

/** src/lib/signupAttribution.ts FIRST_TOUCH_COOKIE와 같은 값 */
const FIRST_TOUCH_COOKIE = "dona_ft";

/** 처음 방문 기록: utm, 리퍼러 도메인(다른 사이트일 때만), 첫 페이지 경로. 개인정보·쿼리스트링은 안 남김 */
function firstTouchValue(req: NextRequest): string {
    const sp = req.nextUrl.searchParams;
    let referrer = "";
    try {
        const host = new URL(req.headers.get("referer") || "").hostname;
        if (host && host !== req.nextUrl.hostname) referrer = host;
    } catch {}
    return JSON.stringify({
        s: (sp.get("utm_source") || "").slice(0, 100),
        c: (sp.get("utm_campaign") || "").slice(0, 100),
        r: referrer.slice(0, 255),
        l: req.nextUrl.pathname.slice(0, 255),
    });
}

export async function proxy(req: NextRequest) {
    const res = await handleRequest(req);
    const isPageVisit =
        req.method === "GET" &&
        req.headers.get("sec-fetch-dest") !== "empty" && // fetch/RSC 요청 제외, 문서 요청만
        !req.headers.get("x-middleware-prefetch") &&
        !req.nextUrl.searchParams.has("_rsc");
    if (isPageVisit && !req.cookies.get(FIRST_TOUCH_COOKIE)) {
        const isProd = process.env.NODE_ENV === "production";
        res.cookies.set(FIRST_TOUCH_COOKIE, firstTouchValue(req), {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax", // 애플 로그인 콜백(다른 사이트 POST)에도 실려 오도록
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
        });
    }
    return res;
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
