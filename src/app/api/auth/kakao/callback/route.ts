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

        // 🟢 [2026-01-21] mobile?redirect=... 형식 처리
        let next = normalizedState;
        let actualNext = "/";
        if (normalizedState.startsWith("mobile")) {
            // mobile?redirect=/path 형식인 경우 redirect 파라미터 추출
            try {
                const urlObj = new URL(`http://dummy${normalizedState.includes("?") ? "" : "?"}${normalizedState}`);
                const redirect = urlObj.searchParams.get("redirect");
                if (redirect) {
                    actualNext = getSafeRedirectPath(redirect, "/");
                } else {
                    actualNext = "/";
                }
            } catch {
                actualNext = "/";
            }
        } else {
            actualNext = getSafeRedirectPath(normalizedState, "/");
        }

        // 🟢 [2026-01-21] 모바일 앱 요청 감지: User-Agent 및 파라미터 확인
        // WebScreen.tsx에서 설정한 User-Agent: "DoNa_App_Android" 또는 "DoNa_App_iOS" 포함
        const userAgent = request.headers.get("user-agent") || "";
        const isMobileApp =
            userAgent.includes("DoNa_App_Android") || // 앱 안드로이드
            userAgent.includes("DoNa_App_iOS") || // 앱 iOS
            userAgent.includes("DoNa") || // 추가 안전장치
            userAgent.includes("Expo") || // Expo 환경
            userAgent.includes("ReactNative") || // React Native 환경
            normalizedState.includes("mobile"); // 파라미터 기반 감지

        const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
        const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
        const apiUrl = `${protocol}://${host}/api/auth/kakao`;

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, next: actualNext }),
        });

        const setCookie = response.headers.get("set-cookie");

        // 🟢 [2026-01-21] 모바일 앱인 경우: 앱의 커스텀 스킴으로 리다이렉트 (조건 강화)
        if (isMobileApp || normalizedState.includes("mobile")) {
            // app.json에 설정된 scheme인 duna:// 를 사용합니다.
            const appRedirectUrl = `duna://success?next=${encodeURIComponent(actualNext)}`;
            return new NextResponse(null, {
                status: 307,
                headers: {
                    Location: appRedirectUrl,
                    "Set-Cookie": setCookie || "",
                },
            });
        }

        // 🟢 웹 브라우저인 경우: 기존 팝업 닫기 로직 유지
        // next 값을 JSON.stringify로 안전하게 문자열로 변환 (XSS 방지)
        const safeNext = JSON.stringify(actualNext);

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
