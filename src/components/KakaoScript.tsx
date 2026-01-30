"use client";

import Script from "next/script";

/**
 * Kakao JS SDK 로드 및 초기화.
 * onLoad는 클라이언트에서만 사용 가능하므로 Client Component로 분리.
 */
export default function KakaoScript() {
    return (
        <Script
            src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
            strategy="afterInteractive"
            onLoad={() => {
                if (
                    typeof window !== "undefined" &&
                    (window as any).Kakao &&
                    !(window as any).Kakao.isInitialized?.()
                ) {
                    const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
                    if (jsKey) (window as any).Kakao.init(jsKey);
                }
            }}
        />
    );
}
