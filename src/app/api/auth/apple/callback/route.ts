import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    const origin = request.nextUrl.origin;

    try {
        // 💡 [수정] 타입을 any로 캐스팅하여 'get' 속성 오류를 해결합니다.
        const formData = (await request.formData()) as any;
        const id_token = formData.get("id_token") as string;
        const state = (formData.get("state") as string) || "/";

        const apiUrl = `${origin}/api/auth/apple`;
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identityToken: id_token }),
        });

        const setCookie = response.headers.get("set-cookie");
        // state 디코딩을 통해 /%2F 404 에러 방지
        const decodedNext = decodeURIComponent(state).replace(/^%2F/, "/");

        return new Response(
            `<html><body><script>
                if (window.opener) {
                    window.opener.location.href = "${decodedNext}";
                    window.close();
                } else {
                    window.location.href = "${decodedNext}";
                }
            </script></body></html>`,
            {
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Set-Cookie": setCookie || "",
                },
            }
        );
    } catch (err) {
        console.error("애플 콜백 에러:", err);
        return NextResponse.redirect(new URL("/login?error=apple_callback_failed", origin));
    }
}
