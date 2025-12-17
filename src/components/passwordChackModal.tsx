"use client";

import React, { useState } from "react";

interface PasswordCheckModalProps {
    onClose: () => void;
    onConfirm: (password: string) => void;
    error?: string;
}

export default function PasswordCheckModal({ onClose, onConfirm, error }: PasswordCheckModalProps) {
    const [password, setPassword] = useState("");

    return (
        // 배경 (Overlay)
        <div className="fixed inset-0 z-[2000] flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            {/* 모달 박스 */}
            <div className="w-full max-w-[340px] bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all animate-scaleIn">
                {/* 상단 헤더 (제목 + 닫기 버튼) */}
                <div className="relative p-5 pb-0 text-center">
                    <h3 className="text-lg font-bold text-gray-900">현재 비밀번호 확인</h3>
                    <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="w-5 h-5"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 본문 내용 */}
                <div className="p-5">
                    {error && (
                        <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                            {error}
                        </div>
                    )}
                    <label className="block text-sm font-medium text-gray-500 mb-1.5 ml-1">현재 비밀번호</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="비밀번호를 입력해주세요"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        autoFocus
                    />
                </div>

                {/* 하단 버튼 영역 */}
                <div className="flex gap-2 p-5 pt-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={() => onConfirm(password)}
                        disabled={!password}
                        className={`flex-1 py-3.5 rounded-xl font-bold text-white transition-all shadow-md ${
                            password
                                ? "bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98]"
                                : "bg-gray-300 cursor-not-allowed"
                        }`}
                    >
                        다음
                    </button>
                </div>
            </div>
        </div>
    );
}
