"use client";

import { useEffect, useState } from "react";
import { DEMO_BLOCKED_HEADER, DEMO_BLOCKED_MESSAGE } from "@/lib/demo";

/** 체험 데모 띠 + 저장이 막혔을 때 안내 토스트. 루트 레이아웃이 DEMO_MODE일 때만 그림 */
export default function DemoBanner() {
    const [toast, setToast] = useState(false);

    useEffect(() => {
        // 서버(데모 미들웨어)가 막은 응답에는 헤더가 붙어 옴 → 어느 화면에서 저장을 눌러도 같은 안내
        const original = window.fetch;
        let timer: ReturnType<typeof setTimeout> | undefined;
        window.fetch = async (...args) => {
            const res = await original(...args);
            if (res.headers.get(DEMO_BLOCKED_HEADER)) {
                setToast(true);
                clearTimeout(timer);
                timer = setTimeout(() => setToast(false), 2500);
            }
            return res;
        };
        return () => {
            window.fetch = original;
            clearTimeout(timer);
        };
    }, []);

    return (
        <>
            <div className="fixed top-0 inset-x-0 z-[1000] h-8 flex items-center justify-center gap-2 bg-amber-400 text-amber-950 text-sm font-semibold">
                🧪 체험용 데모 · 저장되지 않음
                <span className="hidden sm:inline font-normal text-amber-900">— 회원·결제 정보는 모두 가짜 예시예요</span>
            </div>
            <div className="h-8" aria-hidden />
            {toast && (
                <div
                    role="status"
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] rounded-lg bg-gray-900 text-white text-sm px-4 py-3 shadow-lg"
                >
                    {DEMO_BLOCKED_MESSAGE} 🙂
                </div>
            )}
        </>
    );
}
