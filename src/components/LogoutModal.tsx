// src/components/LogoutModal.tsx

"use client";

import React from "react";

interface LogoutModalProps {
    onClose: () => void;
    onConfirm: () => void;
}

export default function LogoutModal({ onClose, onConfirm }: LogoutModalProps) {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-2000 animate-in fade-in duration-200">
            {/* 모달 박스 */}
            <div className="bg-white rounded-xl border border-gray-100 p-8 w-80 transform transition-all animate-in zoom-in-95 duration-200">
                <div className="text-center mb-6 tracking-tight">
                    {/* 아이콘 */}
                    <div className="flex justify-center mb-4">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-16 w-16 text-gray-400"
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
                    <h3 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">잠깐만요!</h3>
                    <p className="text-gray-500 font-medium tracking-tight">정말 로그아웃 하시겠어요?</p>
                </div>

                <div className="flex gap-3">
                    {/* 머물기 버튼 (취소) */}
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3.5 bg-gray-100 text-gray-700 rounded-lg font-bold text-[15px] hover:bg-gray-200 transition-colors tracking-tight"
                    >
                        머물기
                    </button>

                    {/* 로그아웃 버튼 (확인) - 검정색으로 변경 */}
                    <button
                        onClick={onConfirm}
                        className="flex-1 px-4 py-3.5 bg-slate-900 text-white rounded-lg font-bold text-[15px] hover:bg-slate-800 transition-colors tracking-tight"
                    >
                        로그아웃
                    </button>
                </div>
            </div>
        </div>
    );
}
