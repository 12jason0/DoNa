import { NextRequest, NextResponse } from "next/server";
import { getSafeRedirectPath } from "@/lib/redirect";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const { searchParams, origin } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) return NextResponse.redirect(new URL("/login?error=no_code", origin));

    try {
        // state(원래 가려던 주소)를 안전하게 디코딩 및 검증
        const decodedState = state ? decodeURIComponent(state) : "/";
        // %2F 같은 잘못된 인코딩이 남아있으면 정규화
        const normalizedState = decodedState.replace(/^%2F/, "/").replace(/\/+/g, "/");
        const next = getSafeRedirectPath(normalizedState, "/");

        const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
        const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
        const apiUrl = `${protocol}://${host}/api/auth/kakao`;

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, next }),
        });

        const setCookie = response.headers.get("set-cookie");

        // 💡 팝업창을 닫으면서 부모 창을 정상적인 주소로 이동시킵니다.
        // next 값을 JSON.stringify로 안전하게 문자열로 변환 (XSS 방지)
        const safeNext = JSON.stringify(next);

            return new Response(
                `<html><body><script>
                    (function() {
                    const redirectPath = ${safeNext};
                    if (window.opener) {
                        window.opener.location.href = redirectPath;
                            window.close();
                    } else {
                        window.location.href = redirectPath;
                        }
                    })();
                </script></body></html>`,
                {
                    headers: {
                        "Content-Type": "text/html; charset=utf-8",
                    "Set-Cookie": setCookie || "", // 💡 여기서 쿠키를 확실히 심어줘야 합니다.
                    },
                }
            );
    } catch (err) {
        console.error("Callback 처리 중 오류:", err);
        return NextResponse.redirect(new URL("/login?error=server_error", origin));
    }
}
