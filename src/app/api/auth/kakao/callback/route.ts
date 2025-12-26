import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

import { getSafeRedirectPath } from "@/lib/redirect";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // 카카오가 돌려준 next 값
    const error = searchParams.get("error");
    const error_description = searchParams.get("error_description");

    // state에서 next 경로 추출 및 검증 (기본값: /)
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
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
    };

    if (error || !code) {
        const errorMsg = error_description || error || "인증 코드가 없습니다.";
        // 🟢 URLSearchParams를 사용하여 안전하게 URL 생성
        const params = new URLSearchParams({ error: errorMsg });
        const errorUrl = "/login?" + params.toString();
        const errorMsgJson = JSON.stringify(errorMsg);

        const script =
            "(function() {" +
            "const errorMsg = " +
            errorMsgJson +
            ";" +
            "console.error('Kakao auth error:', errorMsg);" +
            "if (window.ReactNativeWebView) {" +
            "window.location.href = " +
            JSON.stringify(errorUrl) +
            ";" +
            "} else if (window.opener) {" +
            "window.opener.postMessage({ type: 'KAKAO_AUTH_ERROR', error: errorMsg }, \"*\");" +
            "setTimeout(function() { window.close(); }, 500);" +
            "} else {" +
            "window.location.href = " +
            JSON.stringify(errorUrl) +
            ";" +
            "}" +
            "})();";
        return sendResponse(script);
    }

    return sendResponse(`
        (function() {
            const code = ${JSON.stringify(code)};
            const next = ${JSON.stringify(next)};
            console.log('Authorization code received:', code);

            if (window.ReactNativeWebView) {
                fetch('/api/auth/kakao', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: code, next: next })
                })
                .then(res => {
                    // 리다이렉트 응답인 경우
                    if (res.redirected || res.url) {
                        window.location.href = res.url || next;
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
                        window.location.href = next;
                    } else if (data && !data.success) {
                        const errorMsg = data.error || '로그인 실패';
                        const encodedError = encodeURIComponent(errorMsg);
                        const encodedNext = encodeURIComponent(next);
                        window.location.href = '/login?error=' + encodedError + '&next=' + encodedNext;
                    }
                })
                .catch(err => {
                    const errorMsg = '서버 통신 오류';
                    const encodedError = encodeURIComponent(errorMsg);
                    const encodedNext = encodeURIComponent(next);
                    window.location.href = '/login?error=' + encodedError + '&next=' + encodedNext;
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
                            next: next
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
                        const errorMsg = '인증 메시지 전송 실패';
                        const encodedError = encodeURIComponent(errorMsg);
                        const encodedNext = encodeURIComponent(next);
                        window.location.href = '/login?error=' + encodedError + '&next=' + encodedNext;
                    }
                } else {
                    // 🟢 팝업이 아닌 일반 리다이렉트의 경우: API를 호출하여 로그인 처리
                    console.log('일반 리다이렉트: API 호출하여 로그인 처리');
                    fetch('/api/auth/kakao', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: code, next: next }),
                        redirect: 'manual' // 리다이렉트를 수동으로 처리
                    })
                    .then(res => {
                        // 상태 코드 확인
                        if (res.status >= 300 && res.status < 400) {
                            // 리다이렉트 응답인 경우: Location 헤더 확인
                            const location = res.headers.get('Location');
                            if (location) {
                                window.location.href = location;
                                return;
                            }
                            // Location 헤더가 없으면 next로 이동 (쿠키는 이미 설정됨)
                            window.location.href = next;
                            return;
                        }
                        
                        // JSON 응답인 경우 (200 OK)
                        if (res.ok) {
                            return res.json();
                        } else {
                            // 에러 응답
                            return res.json().catch(() => ({ error: '로그인 실패' }));
                        }
                    })
                    .then(data => {
                        if (!data) {
                            // 데이터가 없으면 (리다이렉트 응답 처리됨) next로 이동
                            window.location.href = next;
                            return;
                        }
                        
                        if (data.success) {
                            // 로그인 성공: next 경로로 리다이렉트
                            window.location.href = next;
                        } else {
                            // 로그인 실패: 에러 메시지와 함께 로그인 페이지로
                            const errorMsg = (data && data.error) ? data.error : '로그인 실패';
                            const params = new URLSearchParams({ error: errorMsg, next: next });
                            window.location.href = '/login?' + params.toString();
                        }
                    })
                    .catch(err => {
                        console.error('로그인 처리 실패:', err);
                        // 네트워크 오류 등이 발생했지만, 쿠키가 설정되었을 수 있으므로
                        // 일단 next로 이동 시도 (실제로는 로그인이 성공했을 가능성이 높음)
                        window.location.href = next;
                    });
                }
            }
        })();
    `);
}
