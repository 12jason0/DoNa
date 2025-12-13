"use client";

import { useRouter } from "next/navigation";
import { X, ArrowRight, Clock } from "lucide-react"; // 시계 아이콘 추가

interface NotificationModalProps {
    onClose: () => void;
}

export default function NotificationModal({ onClose }: NotificationModalProps) {
    const router = useRouter();

    const handleButtonClick = () => {
        router.push("/signup");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            {/* 배경 */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* 모달 본문 */}
            <div className="bg-white w-full max-w-[360px] rounded-[32px] shadow-2xl relative overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-300 z-10 border border-gray-100">
                {/* 상단 띠지: "접속자 폭주" -> "기간 한정"으로 톤 변경 (신뢰도 UP) */}
                <div className="bg-emerald-600 text-white text-[12px] font-bold text-center py-2 absolute top-0 w-full z-20 flex items-center justify-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    오픈 기념! 웰컴 혜택 기간입니다
                </div>

                {/* 닫기 버튼 */}
                <button
                    onClick={onClose}
                    className="absolute top-9 right-4 p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-400 transition-colors z-20"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center text-center pt-16 pb-6 px-6">
                    {/* 2. 헤드라인 */}
                    <h2 className="text-[22px] font-extrabold text-gray-900 mb-3 leading-tight">
                        선착순 웰컴 혜택
                        <br />
                        <span className="text-emerald-600">기존 1장에서 3장으로!</span>
                    </h2>

                    <p className="text-gray-500 text-[15px] leading-relaxed mb-6">
                        지금 가입하지 않으면
                        <br />
                        <span className="font-bold text-gray-800 underline decoration-emerald-200 decoration-4">
                            추가 쿠폰 2장
                        </span>
                        이 사라져요.
                        <br />
                        <span className="text-sm text-gray-400">(총 3장 혜택)</span>
                    </p>

                    {/* 3. [수정됨] 거짓 숫자 제거 -> 상태 강조 */}
                    <div className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-6">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-xs font-bold text-gray-500">이벤트 현황</span>
                            {/* 구체적 숫자 대신 '마감 임박' 텍스트 사용 */}
                            <span className="text-xs font-bold text-emerald-600 animate-pulse">🔥 마감 임박</span>
                        </div>
                        {/* 프로그레스 바: 꽉 찬 느낌을 주되 수치는 숨김 */}
                        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 w-[85%] rounded-full relative">
                                <div className="absolute top-0 left-0 bottom-0 right-0 bg-white/30 animate-[shimmer_2s_infinite] skew-x-12"></div>
                            </div>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-2 text-left">
                            * 준비된 예산 소진 시 이벤트가 조기 종료될 수 있습니다.
                        </p>
                    </div>

                    {/* 4. 액션 버튼 */}
                    <button
                        onClick={handleButtonClick}
                        className="group w-full py-4 rounded-xl bg-gray-900 text-white font-bold text-[17px] hover:bg-gray-800 active:scale-95 transition-all shadow-xl shadow-gray-300 flex items-center justify-center gap-2 relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
                        지금 쿠폰 3장 받고 시작하기{" "}
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button
                        onClick={onClose}
                        className="mt-4 text-xs text-gray-400 underline decoration-gray-300 hover:text-gray-600 transition-colors"
                    >
                        괜찮습니다, 추가 혜택을 포기할게요
                    </button>
                </div>
            </div>
        </div>
    );
}
