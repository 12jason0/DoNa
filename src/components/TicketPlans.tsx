"use client";

import { useState } from "react";
import { loadTossPayments } from "@tosspayments/payment-sdk";
import { X, Check, Sparkles } from "lucide-react";

// 상품 데이터
const PLANS = [
    // 1. 구독 (메인)
    {
        id: "sub_basic",
        type: "sub",
        name: "베이직 멤버십",
        price: 4900,
        originalPrice: 9900, // 정가 표시용 (할인 강조)
        desc: "지금 구독하면 평생 이 가격! (곧 인상 예정)",
        badge: "EARLY BIRD",
        features: ["AI 코스 추천 무제한", "광고 없이 쾌적하게", "코스 보관함 영구 저장"],
    },
    {
        id: "sub_premium",
        type: "sub",
        name: "프리미엄 멤버십",
        price: 9900,
        desc: "베이직 혜택 + 두나의 시크릿 정보",
        badge: "VIP",
        features: ["베이직 혜택 전체 포함", "남들은 모르는 시크릿 스팟", "테마별 스페셜 코스 열람"],
    },
    // 2. 쿠폰 (서브)
    { id: "ticket_light", type: "ticket", name: "쿠폰 3개", price: 2900, desc: "가볍게 주말 데이트" },
    { id: "ticket_standard", type: "ticket", name: "쿠폰 5개", price: 4500, desc: "한 달 코스 걱정 끝" },
    { id: "ticket_pro", type: "ticket", name: "쿠폰 10개", price: 7900, desc: "넉넉한 핫플 탐방" },
];

const TicketPlans = ({ onClose }: { onClose: () => void }) => {
    const [selectedPlanId, setSelectedPlanId] = useState<string>("sub_basic"); // 기본 선택
    const [loading, setLoading] = useState(false);

    const selectedPlan = PLANS.find((p) => p.id === selectedPlanId);

    const handlePayment = async () => {
        if (!selectedPlan) return;
        setLoading(true);

        const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;
        if (!clientKey) return alert("토스 키가 설정되지 않았습니다.");

        try {
            const tossPayments = await loadTossPayments(clientKey);
            const orderId = `order_${selectedPlan.id}_${Date.now()}`;

            await tossPayments.requestPayment("카드", {
                amount: selectedPlan.price,
                orderId: orderId,
                orderName: selectedPlan.name,
                successUrl: `${window.location.origin}/personalized-home/pay/success?plan=${selectedPlan.id}`,
                failUrl: `${window.location.origin}/personalized-home/pay/fail`,
            });
        } catch (error) {
            console.error("결제 에러", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            {/* 모달 컨테이너 */}
            <div className="bg-white w-full max-w-md h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-xl sm:rounded-xl border border-gray-100 flex flex-col relative overflow-hidden">
                {/* 헤더 */}
                <div className="px-6 pt-8 pb-4 bg-white z-10">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h2 className="text-2xl font-extrabold text-gray-900 leading-tight tracking-tight">
                                더 완벽한 데이트, <br />
                                <span className="text-emerald-500">두나 멤버십</span>으로 ✨
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                    <p className="text-gray-500 text-sm">지금 가입해야 가장 저렴합니다!</p>
                </div>

                {/* 스크롤 영역 */}
                <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-6">
                    {/* 1. 구독 플랜 */}
                    <div className="space-y-3">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                            Monthly Plan
                        </div>
                        {PLANS.filter((p) => p.type === "sub").map((plan) => (
                            <div
                                key={plan.id}
                                onClick={() => setSelectedPlanId(plan.id)}
                                className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                                    selectedPlanId === plan.id
                                        ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500"
                                        : "border-gray-100 bg-white hover:border-emerald-200"
                                }`}
                            >
                                {/* 뱃지 */}
                                {plan.badge && (
                                    <div
                                        className={`absolute -top-3 left-6 px-3 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1 tracking-tight ${
                                            plan.badge === "EARLY BIRD"
                                                ? "bg-gradient-to-r from-red-500 to-pink-500"
                                                : "bg-gray-800"
                                        }`}
                                    >
                                        {plan.badge === "EARLY BIRD" && (
                                            <Sparkles className="w-3 h-3 text-yellow-200" />
                                        )}
                                        {plan.badge === "EARLY BIRD" ? "🔥 런칭 특가 (50% OFF)" : "👑 VIP ONLY"}
                                    </div>
                                )}

                                <div className="flex justify-between items-center mb-1 mt-1">
                                    <h3
                                        className={`font-bold text-lg ${
                                            selectedPlanId === plan.id ? "text-emerald-800" : "text-gray-700"
                                        }`}
                                    >
                                        {plan.name}
                                    </h3>
                                    {selectedPlanId === plan.id && <Check className="w-6 h-6 text-emerald-500" />}
                                </div>

                                <p className="text-xs text-gray-500 mb-3">{plan.desc}</p>

                                <div className="flex items-end gap-2 mb-3">
                                    {/* 정가(취소선) 표시 - 얼리버드 상품인 경우 */}
                                    {plan.originalPrice && (
                                        <span className="text-sm text-gray-400 line-through decoration-gray-400 decoration-1">
                                            {plan.originalPrice.toLocaleString()}원
                                        </span>
                                    )}
                                    <div className="flex items-end gap-1">
                                        <span
                                            className={`text-2xl font-black ${
                                                plan.badge === "EARLY BIRD" ? "text-red-500" : "text-gray-900"
                                            }`}
                                        >
                                            {plan.price.toLocaleString()}
                                        </span>
                                        <span className="text-sm font-medium text-gray-400 mb-1">원 / 월</span>
                                    </div>
                                </div>

                                {/* 특징 리스트 */}
                                {plan.features && (
                                    <ul className="space-y-1.5 pt-3 border-t border-dashed border-gray-200">
                                        {plan.features.map((feat, idx) => (
                                            <li key={idx} className="text-xs text-gray-600 flex items-center gap-1.5">
                                                <div
                                                    className={`w-1 h-1 rounded-full ${
                                                        plan.badge === "EARLY BIRD" ? "bg-red-400" : "bg-emerald-400"
                                                    }`}
                                                />
                                                {feat}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* 2. 쿠폰 플랜 */}
                    <div className="space-y-3">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                            One-time Ticket
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {PLANS.filter((p) => p.type === "ticket").map((plan) => (
                                <div
                                    key={plan.id}
                                    onClick={() => setSelectedPlanId(plan.id)}
                                    className={`p-3 rounded-2xl border-2 cursor-pointer text-center transition-all ${
                                        selectedPlanId === plan.id
                                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                                            : "border-gray-100 bg-gray-50 text-gray-500 hover:bg-white"
                                    }`}
                                >
                                    <div className="text-sm font-bold mb-1">{plan.name}</div>
                                    <div className="text-sm font-extrabold">{plan.price.toLocaleString()}원</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="h-4" />
                </div>

                {/* 하단 고정 결제 버튼 */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-white/0">
                    <button
                        onClick={handlePayment}
                        disabled={loading}
                        className="w-full py-4 rounded-lg bg-slate-900 text-white font-bold text-lg hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed tracking-tight"
                    >
                        {loading ? (
                            "결제창 띄우는 중..."
                        ) : (
                            <>
                                <span>{selectedPlan?.name} 시작하기</span>
                                <Sparkles className="w-5 h-5 text-yellow-200 fill-yellow-200" />
                            </>
                        )}
                    </button>
                    <p className="text-[10px] text-center text-gray-400 mt-3">
                        본 상품은 디지털 콘텐츠 특성상 결제 즉시 사용 처리되며, <br />
                        단순 변심에 의한 <strong>취소 및 환불이 불가능</strong>합니다.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TicketPlans;
