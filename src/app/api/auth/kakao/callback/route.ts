import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

import { getSafeRedirectPath } from "@/lib/redirect";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // 카카오가 돌려준 next 값
    const error = searchParams.get("error");
    const error_description = searchParams.get("error_description");

    // state에서 next 경로 추출 및 검증
    const next = getSafeRedirectPath(state, "/");

    console.log("Callback received:", { code: code ? "존재" : "없음", state, next, error, error_description });

    const sendResponse = (script: string) => {
        return new Response(
            `<html>
                <head><title>카카오 로그인 처리 중...</title></head>
                <body>
                    <script>${script}</script>
                </body>
            </html>`,
            { headers: { "Content-Type": "text/html" } }
        );
    };

    if (error || !code) {
        const errorMsg = error_description || error || "인증 코드가 없습니다.";
        return sendResponse(`
            console.error('Kakao auth error:', '${errorMsg}');
            if (window.ReactNativeWebView) {
                window.location.href = '/login?error=' + encodeURIComponent('${errorMsg}');
            } else if (window.opener) {
                window.opener.postMessage({ 
                    type: 'KAKAO_AUTH_ERROR', 
                    error: '${errorMsg}' 
                }, "*");
                setTimeout(() => window.close(), 500);
            } else {
                window.location.href = '/login?error=' + encodeURIComponent('${errorMsg}');
            }
        `);
    }

    return sendResponse(`
        (function() {
            const code = '${code}';
            console.log('Authorization code received:', code);

            if (window.ReactNativeWebView) {
                fetch('/api/auth/kakao', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: code, next: '${next}' })
                })
                .then(res => {
                    // 리다이렉트 응답인 경우
                    if (res.redirected || res.url) {
                        window.location.href = res.url || '${next}';
                        return;
                    }
                    return res.json();
                })
                .then(data => {
                    if (data && data.success && data.token) {
                        localStorage.setItem('authToken', data.token);
                        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
                        
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'loginSuccess',
                            token: data.token
                        }));
                        window.location.href = '${next}';
                    } else if (data && !data.success) {
                        window.location.href = '/login?error=' + encodeURIComponent(data.error || '로그인 실패') + '&next=' + encodeURIComponent('${next}');
                    }
                })
                .catch(err => {
                    window.location.href = '/login?error=' + encodeURIComponent('서버 통신 오류') + '&next=' + encodeURIComponent('${next}');
                });
            } 
            else {
                if (window.opener && !window.opener.closed) {
                    console.log('부모 창으로 메시지 전송 시작, code:', code);
                    
                    try {
                        // 🟢 수정된 부분: 메시지를 여러 번 전송(setTimeout)하던 로직을 삭제하고
                        // 단 한 번만 전송하여 인가 코드 중복 사용 에러(400)를 방지합니다.
                        // next 값도 함께 전달
                        window.opener.postMessage({ 
                            type: 'KAKAO_AUTH_CODE', 
                            code: code,
                            next: '${next}'
                        }, '*');
                        console.log('메시지 전송 완료 (code와 next 포함)');

                        // 🟢 수정된 부분: 팝업을 닫기 전 부모 창이 데이터를 처리할 최소한의 시간을 줍니다.
                        setTimeout(() => {
                            console.log('팝업 닫기 실행');
                            if (window.opener && !window.opener.closed) {
                                window.close();
                            }
                        }, 1000); 
                    } catch (e) {
                        console.error('postMessage 실패:', e);
                        window.location.href = '/login?error=' + encodeURIComponent('인증 메시지 전송 실패') + '&next=' + encodeURIComponent('${next}');
                    }
                } else {
                    console.error('부모 창을 찾을 수 없음. 리다이렉트 시도');
                    window.location.href = '/login?error=' + encodeURIComponent('로그인 창이 닫혀있습니다.');
                }
            }
        })();
    `);
}
