"use client";

import { useState, useEffect } from "react";
import { loadTossPayments } from "@tosspayments/payment-sdk";
import { X, Check, Sparkles, ChevronRight } from "lucide-react";

const PLANS = [
    {
        id: "sub_basic",
        type: "sub",
        name: "베이직 멤버십",
        price: 4900,
        originalPrice: 9900,
        desc: "평생 할인 혜택이 적용되는 얼리버드 찬스!",
        badge: "EARLY BIRD",
        features: ["AI 코스 추천 무제한", "광고 제거", "보관함 영구 저장"],
        tier: "BASIC",
    },
    {
        id: "sub_premium",
        type: "sub",
        name: "프리미엄 멤버십",
        price: 9900,
        desc: "베이직 혜택 + 남들 모르는 시크릿 스팟 공개",
        badge: "VIP",
        features: ["베이직 혜택 포함", "시크릿 스팟 정보", "테마별 스페셜 코스"],
        tier: "PREMIUM",
    },
    { id: "ticket_light", type: "ticket", name: "쿠폰 3개", price: 2900, desc: "주말 데이트용" },
    { id: "ticket_standard", type: "ticket", name: "쿠폰 5개", price: 4500, desc: "한 달 코스용" },
    { id: "ticket_pro", type: "ticket", name: "쿠폰 10개", price: 7900, desc: "완벽 마스터용" },
];

const TicketPlans = ({ onClose }: { onClose: () => void }) => {
    const [selectedPlanId, setSelectedPlanId] = useState<string>("sub_basic");
    const [loading, setLoading] = useState(false);
    const [currentTier, setCurrentTier] = useState<"FREE" | "BASIC" | "PREMIUM">("FREE");

    // 🟢 현재 사용자 등급 확인
    useEffect(() => {
        const fetchUserTier = async () => {
            try {
                // 🟢 쿠키 기반 인증: authenticatedFetch 사용
                const { authenticatedFetch } = await import("@/lib/authClient");
                const data = await authenticatedFetch("/api/users/profile");
                
                if (!data) {
                    setCurrentTier("FREE");
                    return;
                }

                const response = { ok: true, json: async () => data };

                if (response.ok) {
                    const data = await response.json();
                    const tier = data?.user?.subscriptionTier || "FREE";
                    setCurrentTier(tier as "FREE" | "BASIC" | "PREMIUM");

                    // 🟢 현재 등급이 BASIC 이상이면 첫 번째 티켓 플랜을 기본 선택으로 변경
                    if (tier !== "FREE" && selectedPlanId.startsWith("sub_")) {
                        const firstTicket = PLANS.find((p) => p.type === "ticket");
                        if (firstTicket) {
                            setSelectedPlanId(firstTicket.id);
                        }
                    }
                }
            } catch (error) {
                console.error("사용자 등급 조회 실패:", error);
            }
        };

        fetchUserTier();
    }, []);

    const selectedPlan = PLANS.find((p) => p.id === selectedPlanId);

    const getClientKey = () => {
        if (!selectedPlan) return "test_ck_QbgMGZzorz4ojKx7pm5k3l5E1em4";
        return selectedPlan.type === "sub"
            ? "test_ck_LkKEYpNARWYWGqeQEZGL3lmeaxYG"
            : "test_ck_QbgMGZzorz4ojKx7pm5k3l5E1em4";
    };

    const handlePayment = async () => {
        if (!selectedPlan) return;

        // 🟢 이미 보유한 등급 이상의 플랜은 결제 불가
        if (selectedPlan.type === "sub" && selectedPlan.tier) {
            if (
                (currentTier === "BASIC" && selectedPlan.tier === "BASIC") ||
                (currentTier === "PREMIUM" && (selectedPlan.tier === "BASIC" || selectedPlan.tier === "PREMIUM"))
            ) {
                alert("이미 이용 중인 멤버십입니다.");
                return;
            }
        }

        setLoading(true);

        try {
            const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
            const user = userStr ? JSON.parse(userStr) : null;
            const userId = user?.id || user?.user?.id || null;

            if (!userId) {
                alert("로그인이 필요합니다.");
                setLoading(false);
                return;
            }

            const currentClientKey = getClientKey();
            const tossPayments = await loadTossPayments(currentClientKey);

            if (selectedPlan.type === "sub") {
                const customerKey = `user_${userId}`;
                const planId = selectedPlan.id;
                await tossPayments.requestBillingAuth("카드", {
                    customerKey: customerKey,
                    successUrl: `${window.location.origin}/pay/success-billing?customerKey=${customerKey}&planId=${planId}`,
                    failUrl: `${window.location.origin}/personalized-home/pay/fail`,
                });
            } else {
                const orderId = `order_${selectedPlan.id}_${Date.now()}`;
                await tossPayments.requestPayment("카드", {
                    amount: selectedPlan.price,
                    orderId: orderId,
                    orderName: selectedPlan.name,
                    successUrl: `${window.location.origin}/personalized-home/pay/success?plan=${selectedPlan.id}`,
                    failUrl: `${window.location.origin}/personalized-home/pay/fail`,
                });
            }
        } catch (error) {
            console.error("결제창 에러", error);
            alert("다시 시도해주세요.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-5">
            <div className="bg-white w-full max-w-lg h-[92vh] sm:h-auto sm:max-h-[85vh] rounded-t-[2rem] sm:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl transition-all">
                {/* 상단 헤더 */}
                <div className="px-6 pt-8 pb-4 flex justify-between items-start shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 leading-tight">
                            두나 멤버십으로
                            <br />
                            <span className="text-emerald-500">데이트 고민 끝! ✨</span>
                        </h2>
                        <p className="text-gray-400 text-sm mt-1 font-medium">
                            합리적인 가격으로 즐기는 스마트한 데이트
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:rotate-90 transition-all">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* 스크롤 가능한 콘텐츠 영역 */}
                <div className="flex-1 overflow-y-auto px-6 space-y-8 pb-10 custom-scrollbar">
                    {/* 구독 플랜 */}
                    <div className="space-y-4 pt-2">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">
                            Monthly Membership
                        </h4>
                        {PLANS.filter((p) => p.type === "sub").map((plan) => {
                            // 🟢 현재 등급이 해당 플랜 등급 이상이면 비활성화
                            const isDisabled =
                                (currentTier === "BASIC" && plan.tier === "BASIC") ||
                                (currentTier === "PREMIUM" && (plan.tier === "BASIC" || plan.tier === "PREMIUM"));

                            return (
                                <div
                                    key={plan.id}
                                    onClick={() => !isDisabled && setSelectedPlanId(plan.id)}
                                    className={`group relative p-5 rounded-2xl border-2 transition-all duration-200 ${
                                        isDisabled
                                            ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                                            : selectedPlanId === plan.id
                                            ? "border-emerald-500 bg-emerald-50/50 shadow-lg shadow-emerald-100 cursor-pointer"
                                            : "border-gray-100 bg-white hover:border-emerald-200 cursor-pointer"
                                    }`}
                                >
                                    {plan.badge && !isDisabled && (
                                        <span
                                            className={`absolute -top-3 left-5 px-3 py-1 rounded-full text-[10px] font-black text-white ${
                                                plan.badge === "EARLY BIRD" ? "bg-red-500" : "bg-gray-800"
                                            }`}
                                        >
                                            {plan.badge}
                                        </span>
                                    )}
                                    {isDisabled && (
                                        <span className="absolute -top-3 left-5 px-3 py-1 rounded-full text-[10px] font-black text-white bg-emerald-500">
                                            현재 이용 중
                                        </span>
                                    )}
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3
                                                    className={`font-bold text-lg ${
                                                        isDisabled ? "text-gray-400" : "text-gray-900"
                                                    }`}
                                                >
                                                    {plan.name}
                                                </h3>
                                                {selectedPlanId === plan.id && !isDisabled && (
                                                    <Check className="w-5 h-5 text-emerald-500" />
                                                )}
                                            </div>
                                            <p
                                                className={`text-xs mt-0.5 line-clamp-1 ${
                                                    isDisabled ? "text-gray-400" : "text-gray-500"
                                                }`}
                                            >
                                                {isDisabled ? "이미 이용 중인 멤버십입니다" : plan.desc}
                                            </p>
                                            <div className="mt-3 flex items-baseline gap-1.5">
                                                <span
                                                    className={`text-2xl font-black ${
                                                        isDisabled ? "text-gray-400" : "text-gray-900"
                                                    }`}
                                                >
                                                    {plan.price.toLocaleString()}원
                                                </span>
                                                {plan.originalPrice && !isDisabled && (
                                                    <span className="text-sm text-gray-300 line-through font-medium">
                                                        {plan.originalPrice.toLocaleString()}원
                                                    </span>
                                                )}
                                                {!isDisabled && (
                                                    <span className="text-xs font-bold text-gray-400">/ 월</span>
                                                )}
                                            </div>
                                        </div>
                                        <ul
                                            className={`hidden sm:block space-y-1 p-3 rounded-xl border ${
                                                isDisabled
                                                    ? "bg-gray-50/50 border-gray-100"
                                                    : "bg-white/50 border-emerald-100/50"
                                            }`}
                                        >
                                            {plan.features?.map((f, i) => (
                                                <li
                                                    key={i}
                                                    className={`text-[10px] flex items-center gap-1.5 font-semibold ${
                                                        isDisabled ? "text-gray-400" : "text-gray-500"
                                                    }`}
                                                >
                                                    <Check
                                                        className={`w-3 h-3 ${
                                                            isDisabled ? "text-gray-300" : "text-emerald-400"
                                                        }`}
                                                    />{" "}
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 티켓 플랜 */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">
                            One-time Ticket
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                            {PLANS.filter((p) => p.type === "ticket").map((plan) => (
                                <div
                                    key={plan.id}
                                    onClick={() => setSelectedPlanId(plan.id)}
                                    className={`p-4 rounded-xl border-2 transition-all flex justify-between items-center cursor-pointer ${
                                        selectedPlanId === plan.id
                                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                                            : "border-gray-50 bg-gray-50/50 text-gray-600 hover:bg-white"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`w-2 h-2 rounded-full ${
                                                selectedPlanId === plan.id ? "bg-emerald-500" : "bg-gray-300"
                                            }`}
                                        />
                                        <span className="font-bold text-sm">{plan.name}</span>
                                    </div>
                                    <span className="font-black text-sm">{plan.price.toLocaleString()}원</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 하단 약관 및 사업자 정보 (스크롤 영역 안으로 이동하여 버튼 공간 확보) */}
                    <div className="pt-6 border-t border-gray-100 space-y-4 pb-4">
                        <div className="text-[10px] text-gray-400 text-center space-y-1">
                            <p className="font-bold text-gray-500 underline underline-offset-4 mb-2">
                                서비스 이용 및 환불 정책
                            </p>
                            <p>• 멤버십 및 쿠폰 구매 후 미사용 시 7일 이내 환불 가능합니다.</p>
                            <p>• 콘텐츠 열람 이력이 있는 경우 환불이 제한될 수 있습니다.</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl text-[9px] text-gray-400 leading-relaxed text-center">
                            <p className="font-bold text-gray-500 mb-1">두나(DoNa) 사업자 정보</p>
                            <p>대표: 오승용 | 사업자등록번호: 166-10-03081</p>
                            <p>주소: 충청남도 홍성군 홍북읍 신대로 33</p>
                            <p>통신판매업: 제 2025-충남홍성-0193 호 | 12jason@donacouse.com</p>
                            <p className="mt-1 text-emerald-500 font-bold font-sans">고객센터: 010-2271-9824</p>
                        </div>
                    </div>
                </div>

                {/* 하단 고정 결제 버튼 */}
                <div className="p-6 bg-white border-t border-gray-50 shrink-0">
                    <button
                        onClick={handlePayment}
                        disabled={loading}
                        className="w-full py-5 rounded-2xl bg-gray-900 text-white font-black text-lg hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
                    >
                        {loading ? (
                            "결제창을 불러오고 있어요..."
                        ) : (
                            <>
                                <span>{selectedPlan?.name} 시작하기</span>
                                <ChevronRight className="w-5 h-5 text-emerald-400" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TicketPlans;
