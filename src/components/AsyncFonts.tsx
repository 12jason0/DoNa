"use client";

import { useEffect } from "react";

const FONT_URLS = [
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css",
    "https://cdn.jsdelivr.net/gh/sunn-us/SUIT/fonts/variable/stylesheet.css",
];

/**
 * 🟢 [모바일 LCP] 폰트 CSS를 클라이언트 마운트 후 주입해 렌더 블로킹 제거.
 * 첫 페인트는 시스템 폰트로 빠르게, 이후 Pretendard/SUIT 적용.
 */
export default function AsyncFonts() {
    useEffect(() => {
        FONT_URLS.forEach((href) => {
            if (typeof document === "undefined") return;
            const existing = document.querySelector(`link[href="${href}"]`);
            if (existing) return;

            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = href;
            link.dataset.asyncFont = "1";
            document.head.appendChild(link);
        });
    }, []);

    return null;
}
