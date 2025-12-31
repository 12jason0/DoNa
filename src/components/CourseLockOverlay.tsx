import React from "react";

interface CourseLockOverlayProps {
    grade?: string;
}

export default function CourseLockOverlay({ grade = "PREMIUM" }: CourseLockOverlayProps) {
    // 🟢 z-index를 20으로 설정하여 뱃지(z-[30]) 아래에 위치하도록 보장
    return (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] pointer-events-none">
            <div className="rounded-full bg-white/20 p-3 backdrop-blur-md mb-2">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                </svg>
            </div>
            <span className="text-white font-bold text-[13px] bg-black/60 px-3 py-1 rounded-full backdrop-blur-md border border-white/20 tracking-tight">
                {grade} 전용
            </span>
        </div>
    );
}
