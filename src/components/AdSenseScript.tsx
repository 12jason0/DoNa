"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { isMobileApp } from "@/lib/platform";

/**
 * 웹 브라우저에서만 Google AdSense 스크립트 로드.
 * 앱(WebView)에서는 로드하지 않아 스플래시와 adtrafficquality 동시 노출을 방지합니다.
 */
export default function AdSenseScript() {
    const [loadAdSense, setLoadAdSense] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!isMobileApp()) setLoadAdSense(true);
    }, []);

    if (!loadAdSense) return null;

    return (
        <Script
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1305222191440436"
            strategy="afterInteractive"
            crossOrigin="anonymous"
        />
    );
}
