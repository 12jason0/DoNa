"use client";

import { useRouter } from "next/navigation";
import { X, Gift } from "lucide-react"; // Gift 아이콘 추가

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
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-500"
                onClick={onClose}
            />

            <div className="bg-white w-full max-w-[340px] rounded-[2rem] relative overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 z-10 p-10 text-center shadow-2xl">
                {/* 비주얼 포인트: 2030 선호 감성 */}
                <div className="relative w-24 h-24 mx-auto mb-8 bg-emerald-50 rounded-full flex items-center justify-center">
                    <span className="text-5xl animate-bounce">🎁</span>
                    <div className="absolute -top-1 -right-1 bg-white p-1 rounded-full shadow-sm">
                        <Gift className="w-6 h-6 text-emerald-500" />
                    </div>
                </div>

                <h2 className="text-[26px] font-black text-gray-900 mb-4 leading-tight tracking-tight">
                    방탈출 <span className="text-emerald-500">3,000원</span>
                    <br />
                    지금 바로 할인!
                </h2>

                <p className="text-[15px] text-gray-400 font-medium leading-relaxed mb-10">
                    회원가입 즉시 쿠폰함에 쏙!
                    <br />
                    데이트 코스 추천까지 받아보세요.
                </p>

                <div className="space-y-4">
                    <button
                        onClick={handleSignup}
                        className="w-full py-5 rounded-2xl bg-gray-900 text-white text-[17px] font-bold active:scale-[0.97] transition-all shadow-xl"
                    >
                        3초 만에 쿠폰 받기
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full py-2 text-[14px] text-gray-400 font-semibold hover:text-gray-600 transition-colors"
                    >
                        아쉽지만 다음에 할게요
                    </button>
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 text-gray-300 hover:text-gray-900 transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
}
