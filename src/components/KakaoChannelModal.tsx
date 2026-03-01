"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useAppLayout } from "@/context/AppLayoutContext";

interface KakaoChannelModalProps {
    onClose: () => void;
}

export default function KakaoChannelModal({ onClose }: KakaoChannelModalProps) {
    const router = useRouter();
    const { containInPhone } = useAppLayout();
    const posClass = containInPhone ? "absolute" : "fixed";

    const handleKakaoChannel = () => {
        window.open("https://pf.kakao.com/_uxnZHn/chat", "_blank");
        onClose();
    };

    return (
        <div
            className={`${posClass} inset-0 z-100 flex items-end justify-center bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200`}
            onClick={onClose}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            aria-label="카카오 채널 모달 닫기"
        >
            <div
                className={`${posClass} bottom-0 left-0 right-0 z-101 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-t-2xl bg-white dark:bg-[#1a241b] shadow-2xl flex flex-col`}
                style={{ animation: "slideUp 0.3s ease-out forwards" }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. 상단 이미지 영역 */}
                <div className="relative h-40 w-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-linear-to-br from-emerald-500/10 to-teal-500/5" />
                    <div className="text-center z-10">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white dark:bg-gray-700 shadow-sm mb-2">
                            <span className="text-2xl">☕️</span>
                        </div>
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">
                            Event Promotion
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 p-2 bg-white/50 dark:bg-black/30 hover:bg-white dark:hover:bg-gray-700 rounded-full transition-colors backdrop-blur-md"
                        aria-label="닫기"
                    >
                        <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    </button>
                </div>

                {/* 2. 컨텐츠 영역 */}
                <div className="p-6 pb-8 flex flex-col items-center text-center">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">
                        숨겨진 맛집 제보하고
                        <br />
                        <span className="text-emerald-600">스타벅스 커피</span> 받기
                    </h2>

                    <p className="text-[15px] text-gray-500 leading-relaxed mb-8 max-w-[280px]">
                        나만 아는 데이트 장소를 공유해주세요.
                        <br />
                        매달 추첨을 통해 선물을 드립니다.
                    </p>

                    {/* 3. 액션 버튼: Flat하고 단단한 디자인 (Solid UI) */}
                    <button
                        onClick={handleKakaoChannel}
                        className="w-full py-4 px-4 bg-[#FAE100] hover:bg-[#FCE620] text-[#371D1E] rounded-xl font-bold text-[16px] flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                    >
                        {/* 카카오 심볼 (SVG) */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.707 4.8 4.27 6.054-.188.702-.682 2.545-.78 2.94-.122.49.178.483.376.351.155-.103 2.48-1.7 3.48-2.378.525.076 1.065.115 1.614.115 4.97 0 9-3.185 9-7.115S16.97 3 12 3z" />
                        </svg>
                        <span>카카오톡으로 제보하기</span>
                    </button>

                    {/* 보조 버튼: 텍스트 링크 스타일 */}
                    <button
                        onClick={onClose}
                        className="mt-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline decoration-1 underline-offset-4 transition-colors"
                    >
                        다음에 참여할게요
                    </button>
                </div>
            </div>
        </div>
    );
}
