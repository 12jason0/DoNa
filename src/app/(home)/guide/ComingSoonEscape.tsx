"use client";

import { useState } from "react";

// "방탈출 미션"을 클릭하면 준비중 모달을 띄우는 클라이언트 컴포넌트.
// 서버 렌더되는 guide 페이지 안에서 이 부분만 인터랙션을 담당한다.
export default function ComingSoonEscape({ className }: { className?: string }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} className={className}>
                방탈출 미션
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setOpen(false)}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="w-full max-w-xs rounded-2xl bg-white dark:bg-[#1a241b] p-6 text-center shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="text-4xl mb-3">🚧</div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">준비 중이에요</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
                            이색 방탈출 미션은 현재 준비 중입니다. 곧 만나보실 수 있어요!
                        </p>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="w-full rounded-lg bg-[#7FCC9F] hover:bg-[#6bb88a] py-3 text-white font-semibold transition-colors"
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
