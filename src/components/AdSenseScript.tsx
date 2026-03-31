"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { isMobileApp } from "@/lib/platform";

/**
 * 웹 브라우저에서만 Google AdSense 스크립트 로드.
 * 앱(WebView)에서는 로드하지 않아 스플래시와 adtrafficquality 동시 노출을 방지합니다.
 * 🟢 data-page-level-ads="false": Auto ads 비활성화 → 수동 배치 슬롯(하단 배너)에만 광고 표시
 */
export default function AdSenseScript() {
    const [loadAdSense, setLoadAdSense] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!isMobileApp()) setLoadAdSense(true);
    }, []);

    if (!loadAdSense) return null;

    // 🟢 동적 주입으로 data-page-level-ads="false" 확실 적용 (Next.js Script는 data 속성 전달이 불확실할 수 있음)
    return (
        <Script
            id="adsense-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
                __html: `(function(){
                    var s=document.createElement('script');
                    s.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_ID}';
                    s.setAttribute('data-page-level-ads','false');
                    s.crossOrigin='anonymous';
                    s.async=true;
                    document.head.appendChild(s);
                })();`,
            }}
        />
    );
}
