// src/components/LogoutModal.tsx

"use client";

import React, { useEffect, useState } from "react";

interface LogoutModalProps {
    onClose: () => void;
    onConfirm: () => void;
}

export default function LogoutModal({ onClose, onConfirm }: LogoutModalProps) {
    const [slideUp, setSlideUp] = useState(false);

    useEffect(() => {
        const t = requestAnimationFrame(() => setSlideUp(true));
        return () => cancelAnimationFrame(t);
    }, []);

    return (
        <>
            {/* 배경 딤드 */}
            <div
                className="fixed inset-0 z-2000 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
                aria-hidden
            />
            {/* 하단 시트: 아래·양쪽에 붙이고 상단만 둥글게 */}
            <div className="fixed left-0 right-0 bottom-0 z-2001 w-full">
                <div
                    className="bg-white dark:bg-[#1a241b] rounded-t-2xl border-t border-gray-100 dark:border-gray-800 w-full shadow-2xl transition-transform duration-300 ease-out"
                    style={{
                        transform: slideUp ? "translateY(0)" : "translateY(100%)",
                    }}
                >
                    <div className="p-6 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                        <div className="text-center mb-6 tracking-tight">
                            <div className="flex justify-center mb-4">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-14 w-14 text-gray-400 dark:text-gray-500"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">잠깐만요!</h3>
                            <p className="text-gray-500 dark:text-gray-400 font-medium tracking-tight">정말 로그아웃 하시겠어요?</p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-bold text-[15px] hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors tracking-tight"
                            >
                                머물기
                            </button>
                            <button
                                onClick={onConfirm}
                                className="flex-1 px-4 py-3.5 bg-slate-900 dark:bg-slate-800 text-white rounded-lg font-bold text-[15px] hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors tracking-tight"
                            >
                                로그아웃
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
