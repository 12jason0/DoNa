// 데모 빌드 전용 미들웨어 앞단 (scripts/demo/prepare.mjs가 만든 middleware.ts에서만 import)
// 운영 middleware.ts는 /api를 거치지 않으므로, 데모 빌드에서만 /api까지 넓혀 여기서 막음
import { NextResponse, type NextRequest } from "next/server";
import { demoBlockedResponse, isDemoMode } from "./demo";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** 읽기여도 바깥 서비스를 부르거나 무언가를 바꾸는 경로: 크론·웹훅·결제·푸시·텔레그램·인스타 등 (vercel.json crons 포함) */
const BLOCKED_PREFIXES = [
    "/api/cron",
    "/api/subscriptions/renew",
    "/api/admin/legal-cleanup",
    "/api/admin/logs/cleanup",
    "/api/admin/migrate-heic",
    "/api/admin/send-event-notification",
    "/api/admin/places/google-map",
    "/api/webhooks",
    "/api/telegram",
    "/api/instagram",
    "/api/pay",
    "/api/payments",
    "/api/push",
    "/api/refund",
    "/api/translate",
];

/** 데모에 공개하는 /admin 하위 화면 (사이드바는 src/app/(admin)/layout.tsx). 나머지 /admin/* 는 대시보드로 보냄 */
const PUBLIC_ADMIN_PREFIXES = ["/admin/tips", "/admin/courses", "/admin/card-news", "/admin/telegram-demo"];

const isUnder = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** null이면 다음(원래 미들웨어)으로 */
export function demoGuard(req: NextRequest): Response | null {
    if (!isDemoMode()) return null;
    const { pathname } = req.nextUrl;
    if (BLOCKED_PREFIXES.some((p) => isUnder(pathname, p))) {
        return demoBlockedResponse();
    }
    // 페이지 POST(서버 액션) 포함 모든 저장·수정·삭제 요청
    if (!READ_METHODS.has(req.method)) return demoBlockedResponse();
    if (pathname.startsWith("/admin/") && !PUBLIC_ADMIN_PREFIXES.some((p) => isUnder(pathname, p))) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin";
        url.search = "";
        return NextResponse.redirect(url);
    }
    // /api 읽기는 원래 미들웨어(페이지용)를 거치지 않게 바로 통과
    if (pathname.startsWith("/api/")) return NextResponse.next();
    return null;
}
