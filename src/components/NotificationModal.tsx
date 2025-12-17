"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

interface NotificationModalProps {
    onClose: () => void;
}

export default function NotificationModal({ onClose }: NotificationModalProps) {
    const router = useRouter();

    const handleSignup = () => {
        router.push("/signup");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            {/* 배경 블러 처리 (고급스러움 UP) */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* 모달 본문 */}
            <div className="bg-white w-full max-w-[320px] rounded-xl border border-gray-100 relative overflow-hidden animate-in zoom-in-95 duration-300 z-10 p-8 text-center">
                {/* 1. 비주얼 영역: 3D 아이콘이나 깔끔한 그래픽 */}
                <div className="relative w-20 h-20 mx-auto mb-6 bg-gray-50 rounded-full flex items-center justify-center">
                    <span className="text-4xl animate-bounce-slow">🎁</span>
                    {/* 장식용 반짝이 */}
                    <div className="absolute -top-2 -right-2 text-xl animate-pulse">✨</div>
                </div>

                {/* 2. 텍스트 영역: 짧고 강렬하게 */}
                <h2 className="text-2xl font-black text-gray-900 mb-3 leading-tight tracking-tight">
                    회원가입하고
                    <br />
                    <span className="text-[#7aa06f]">3,000원 쿠폰</span> 받기
                </h2>

                <p className="text-[14px] text-gray-500 font-medium leading-relaxed mb-8">
                    지금 가입하시면 야외 방탈출을
                    <br />
                    바로 할인받을 수 있어요.
                </p>

                {/* 3. 액션 버튼: 꽉 찬 브랜드 컬러 */}
                <div className="space-y-3">
                    <button
                        onClick={handleSignup}
                        style={{ backgroundColor: "#7aa06f" }}
                        className="w-full py-4 rounded-lg bg-slate-900 text-white text-[16px] font-bold hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 tracking-tight"
                    >
                        3초 만에 혜택 받기
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full py-2 text-xs text-gray-400 font-medium hover:text-gray-600 transition-colors cursor-pointer"
                    >
                        다음에 받을게요
                    </button>
                </div>

                {/* 닫기 아이콘 (우측 상단) */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2 text-gray-300 hover:text-gray-500 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
