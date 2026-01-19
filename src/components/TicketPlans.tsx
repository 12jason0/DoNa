"use client";

import { useState, useEffect } from "react";
import { X, Check, Sparkles, ChevronRight } from "lucide-react";
import { isMobileApp } from "@/lib/platform";

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
    // 🟢 [IN-APP PURCHASE]: 모바일 앱(WebView)에서만 인앱결제 사용
    const isMobileNative = isMobileApp();
    
    // 🟢 [수정]: 웹에서도 모달 표시 (결제 방식만 분기 처리)

    const [selectedPlanId, setSelectedPlanId] = useState<string>("sub_basic");
    const [loading, setLoading] = useState(false);
    const [currentTier, setCurrentTier] = useState<"FREE" | "BASIC" | "PREMIUM">("FREE");
    // 🟢 [IN-APP PURCHASE]: RevenueCat 상품 정보
    const [revenueCatProducts, setRevenueCatProducts] = useState<Record<string, any>>({});

    // 🟢 현재 사용자 등급 확인
    useEffect(() => {
        const fetchUserTier = async () => {
            try {
                // 🟢 쿠키 기반 인증: authenticatedFetch 사용
                const { authenticatedFetch } = await import("@/lib/authClient");
                // 🟢 타입 명시: authenticatedFetch는 이미 파싱된 데이터를 반환
                const data = await authenticatedFetch<{ user?: { subscriptionTier?: string } }>("/api/users/profile");

                if (!data) {
                    setCurrentTier("FREE");
                    return;
                }

                // 🟢 authenticatedFetch는 이미 파싱된 데이터를 반환하므로 직접 사용
                const tier = data?.user?.subscriptionTier || "FREE";
                setCurrentTier(tier as "FREE" | "BASIC" | "PREMIUM");

                // 🟢 현재 등급이 BASIC 이상이면 첫 번째 티켓 플랜을 기본 선택으로 변경
                if (tier !== "FREE" && selectedPlanId.startsWith("sub_")) {
                    const firstTicket = PLANS.find((p) => p.type === "ticket");
                    if (firstTicket) {
                        setSelectedPlanId(firstTicket.id);
                    }
                }
            } catch (error) {
                console.error("사용자 등급 조회 실패:", error);
                setCurrentTier("FREE");
            }
        };

        fetchUserTier();
    }, []);

    // 🟢 [IN-APP PURCHASE]: RevenueCat 상품 정보 수신
    useEffect(() => {
        if (typeof window === "undefined" || !isMobileNative) return;

        const handleRevenueCatProducts = (event: CustomEvent) => {
            const products = event.detail;
            const productMap: Record<string, any> = {};
            
            // 🟢 [수정]: planId를 키로 사용하여 매핑 (RevenueCat Product ID → plan.id 변환 완료)
            products.forEach((item: any) => {
                // planId가 있으면 그것을 키로 사용 (이미 변환됨)
                const planId = item.planId;
                if (planId && item.product) {
                    productMap[planId] = item.product;
                }
                // fallback: productIdentifier도 시도
                const productId = item.productIdentifier || item.product?.identifier;
                if (productId && item.product) {
                    productMap[productId] = item.product;
                }
            });
            
            console.log("[TicketPlans] RevenueCat 상품 정보 수신:", productMap);
            setRevenueCatProducts(productMap);
        };

        window.addEventListener('revenueCatProductsLoaded', handleRevenueCatProducts as EventListener);

        return () => {
            window.removeEventListener('revenueCatProductsLoaded', handleRevenueCatProducts as EventListener);
        };
    }, [isMobileNative]);

    // 🟢 [IN-APP PURCHASE]: WebView 브리지로부터 결제 결과 수신
    useEffect(() => {
        if (typeof window === "undefined") return;

        const handlePurchaseResult = (event: CustomEvent) => {
            const { success, error, planId } = event.detail || {};
            
            setLoading(false);

            if (success) {
                // 결제 성공
                alert("결제가 완료되었습니다!");
                onClose();
                // 쿠폰 개수 또는 구독 상태 갱신을 위해 페이지 리로드 또는 이벤트 발생
                window.dispatchEvent(new CustomEvent("purchaseSuccess"));
            } else {
                // 결제 실패
                const errorMessage = error || "결제 처리 중 오류가 발생했습니다.";
                alert(errorMessage);
            }
        };

        window.addEventListener("purchaseResult", handlePurchaseResult as EventListener);

        return () => {
            window.removeEventListener("purchaseResult", handlePurchaseResult as EventListener);
        };
    }, [onClose]);

    // 🟢 RevenueCat 상품 정보로 PLANS 업데이트
    const updatedPlans = PLANS.map(plan => {
        const revenueCatProduct = revenueCatProducts[plan.id];
        if (revenueCatProduct && isMobileNative) {
            // 가격을 숫자로 변환 (예: "₩7,900" -> 7900)
            const priceMatch = revenueCatProduct.priceString?.match(/[\d,]+/);
            const price = priceMatch ? parseInt(priceMatch[0].replace(/,/g, ''), 10) : plan.price;
            
            return {
                ...plan,
                name: revenueCatProduct.title || plan.name,
                price: price || plan.price,
            };
        }
        return plan;
    });

    const selectedPlan = updatedPlans.find((p) => p.id === selectedPlanId);

    // 🟢 [IN-APP PURCHASE]: RevenueCat 인앱결제 처리 함수
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
            // 🟢 쿠키 기반 인증 확인 (localStorage 대신)
            const { fetchSession } = await import("@/lib/authClient");
            const session = await fetchSession();

            if (!session.authenticated || !session.user) {
                alert("로그인이 필요합니다.");
                setLoading(false);
                return;
            }

            // 🟢 [IN-APP PURCHASE]: 모바일 앱에서는 인앱결제 사용
            if (isMobileNative && typeof window !== "undefined" && (window as any).ReactNativeWebView) {
                (window as any).ReactNativeWebView.postMessage(
                    JSON.stringify({
                        type: "requestInAppPurchase",
                        planId: selectedPlan.id,
                        planType: selectedPlan.type,
                    })
                );
                // 로딩 상태는 WebView에서 결과를 받을 때까지 유지
                // 실제 결과 처리는 WebView 브리지에서 처리
                return;
            }

            // 🟢 [WEB PAYMENT]: 웹 브라우저에서는 토스페이먼츠 사용 (구독권/쿠폰 모두)
            if (!isMobileNative) {
                const userId = session.user.id;
                const customerKey = `user_${userId}`;
                
                // 🟢 토스페이먼츠 결제 (웹 전용)
                const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
                const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY_GENERAL;
                
                // 🟢 [Debug]: 클라이언트 키 확인
                console.log("[TicketPlans] 클라이언트 키 확인:", {
                    hasKey: !!clientKey,
                    keyPrefix: clientKey?.substring(0, 20) + "...",
                    fullKey: clientKey
                });
                
                if (!clientKey) {
                    throw new Error("토스페이먼츠 클라이언트 키가 설정되지 않았습니다. NEXT_PUBLIC_TOSS_CLIENT_KEY_GENERAL 환경 변수를 확인해주세요.");
                }
                
                // 🟢 [Fix]: 클라이언트 키가 API 개별 연동 키인지 확인 (ck_로 시작해야 함)
                if (!clientKey.startsWith("live_ck_") && !clientKey.startsWith("test_ck_")) {
                    console.error("[TicketPlans] 잘못된 클라이언트 키 형식:", clientKey);
                    throw new Error(`토스페이먼츠 클라이언트 키 형식이 올바르지 않습니다. API 개별 연동 키(ck_로 시작)를 사용해주세요. 현재 키: ${clientKey.substring(0, 20)}...`);
                }
                
                const tossPayments = await loadTossPayments(clientKey);

                const orderId = `${selectedPlan.id}_${Date.now()}`;
                
                // 🟢 [Fix]: 토스페이먼츠 리다이렉트 시 파라미터 손실 대비 - sessionStorage에 저장
                // 인앱 결제 환경(웹뷰)이나 특정 브라우저에서 successUrl 파라미터가 유실될 수 있어
                // 성공 페이지에서 복원할 수 있도록 미리 저장
                if (typeof window !== "undefined") {
                    sessionStorage.setItem('pendingPaymentPlan', selectedPlan.id);
                    sessionStorage.setItem('pendingPaymentOrderId', orderId);
                }
                
                const payment = tossPayments.payment({ customerKey });

                // 🟢 웹에서는 구독권/쿠폰 모두 일반 결제로 처리
                await payment.requestPayment({
                    method: "CARD",
                    amount: {
                        currency: "KRW",
                        value: selectedPlan.price,
                    },
                    orderId: orderId,
                    orderName: selectedPlan.name,
                    successUrl: `${window.location.origin}/personalized-home/pay/success?plan=${selectedPlan.id}&orderId=${orderId}`,
                    failUrl: `${window.location.origin}/pay/fail`,
                });
                return;
            }

            // 🟢 모바일 앱이지만 ReactNativeWebView가 없는 경우 (예외 처리)
            alert("결제를 진행할 수 없습니다. 앱을 최신 버전으로 업데이트해주세요.");
            setLoading(false);
        } catch (error: any) {
            console.error("[인앱결제 에러]:", error);
            const errorMessage = error?.message || "결제 처리 중 오류가 발생했습니다.";
            alert(errorMessage);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-10000 flex items-end sm:items-center justify-center bg-black/70 dark:bg-black/80 backdrop-blur-md p-0 sm:p-5">
            <div className="bg-white dark:bg-[#1a241b] w-full max-w-lg h-[92vh] sm:h-auto sm:max-h-[85vh] rounded-t-4xl sm:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl transition-all">
                {/* 상단 헤더 */}
                <div className="px-6 pt-8 pb-4 flex justify-between items-start shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                            두나 멤버십으로
                            <br />
                            <span className="text-emerald-500 dark:text-emerald-400">데이트 고민 끝! ✨</span>
                        </h2>
                        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1 font-medium">
                            합리적인 가격으로 즐기는 스마트한 데이트
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:rotate-90 transition-all">
                        <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* 스크롤 가능한 콘텐츠 영역 */}
                <div className="flex-1 overflow-y-auto px-6 space-y-8 pb-10 custom-scrollbar">
                    {/* 구독 플랜 */}
                    <div className="space-y-4 pt-2">
                        <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">
                            Monthly Membership
                        </h4>
                        {updatedPlans.filter((p) => p.type === "sub").map((plan) => {
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
                                            ? "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 opacity-50 cursor-not-allowed"
                                            : selectedPlanId === plan.id
                                            ? "border-emerald-500 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/30 shadow-lg shadow-emerald-100 dark:shadow-emerald-900/20 cursor-pointer"
                                            : "border-gray-100 dark:border-gray-800 bg-white dark:bg-[#0f1710] hover:border-emerald-200 dark:hover:border-emerald-800 cursor-pointer"
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
                                                        isDisabled ? "text-gray-400 dark:text-gray-600" : "text-gray-900 dark:text-white"
                                                    }`}
                                                >
                                                    {plan.name}
                                                </h3>
                                                {selectedPlanId === plan.id && !isDisabled && (
                                                    <Check className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                                                )}
                                            </div>
                                            <p
                                                className={`text-xs mt-0.5 line-clamp-1 ${
                                                    isDisabled ? "text-gray-400 dark:text-gray-600" : "text-gray-500 dark:text-gray-400"
                                                }`}
                                            >
                                                {isDisabled ? "이미 이용 중인 멤버십입니다" : plan.desc}
                                            </p>
                                            <div className="mt-3 flex items-baseline gap-1.5">
                                                <span
                                                    className={`text-2xl font-black ${
                                                        isDisabled ? "text-gray-400 dark:text-gray-600" : "text-gray-900 dark:text-white"
                                                    }`}
                                                >
                                                    {plan.price.toLocaleString()}원
                                                </span>
                                                {plan.originalPrice && !isDisabled && (
                                                    <span className="text-sm text-gray-300 dark:text-gray-600 line-through font-medium">
                                                        {plan.originalPrice.toLocaleString()}원
                                                    </span>
                                                )}
                                                {!isDisabled && (
                                                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500">/ 월</span>
                                                )}
                                            </div>
                                        </div>
                                        <ul
                                            className={`hidden sm:block space-y-1 p-3 rounded-xl border ${
                                                isDisabled
                                                    ? "bg-gray-50/50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800"
                                                    : "bg-white/50 dark:bg-[#0f1710]/50 border-emerald-100/50 dark:border-emerald-900/30"
                                            }`}
                                        >
                                            {plan.features?.map((f, i) => (
                                                <li
                                                    key={i}
                                                    className={`text-[10px] flex items-center gap-1.5 font-semibold ${
                                                        isDisabled ? "text-gray-400 dark:text-gray-600" : "text-gray-500 dark:text-gray-400"
                                                    }`}
                                                >
                                                    <Check
                                                        className={`w-3 h-3 ${
                                                            isDisabled ? "text-gray-300 dark:text-gray-700" : "text-emerald-400 dark:text-emerald-500"
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
                        <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">
                            One-time Ticket
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                            {updatedPlans.filter((p) => p.type === "ticket").map((plan) => (
                                <div
                                    key={plan.id}
                                    onClick={() => setSelectedPlanId(plan.id)}
                                    className={`p-4 rounded-xl border-2 transition-all flex justify-between items-center cursor-pointer ${
                                        selectedPlanId === plan.id
                                            ? "border-emerald-500 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-400"
                                            : "border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-[#0f1710]"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`w-2 h-2 rounded-full ${
                                                selectedPlanId === plan.id ? "bg-emerald-500 dark:bg-emerald-400" : "bg-gray-300 dark:bg-gray-600"
                                            }`}
                                        />
                                        <span className="font-bold text-sm dark:text-white">{plan.name}</span>
                                    </div>
                                    <span className="font-black text-sm dark:text-white">{plan.price.toLocaleString()}원</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 하단 약관 및 사업자 정보 (스크롤 영역 안으로 이동하여 버튼 공간 확보) */}
                    <div className="pt-6 border-t border-gray-100 dark:border-gray-800 space-y-4 pb-4">
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 text-center space-y-1">
                            <p className="font-bold text-gray-500 dark:text-gray-400 underline underline-offset-4 mb-2">
                                서비스 이용 및 환불 정책
                            </p>
                            <p className="dark:text-gray-400">• 멤버십 및 쿠폰 구매 후 미사용 시 7일 이내 환불 가능합니다.</p>
                            <p className="dark:text-gray-400">• 콘텐츠 열람 이력이 있는 경우 환불이 제한될 수 있습니다.</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl text-[9px] text-gray-400 dark:text-gray-500 leading-relaxed text-center">
                            <p className="font-bold text-gray-500 dark:text-gray-400 mb-1">두나(DoNa) 사업자 정보</p>
                            <p className="dark:text-gray-400">대표: 오승용 | 사업자등록번호: 166-10-03081</p>
                            <p className="dark:text-gray-400">주소: 충청남도 홍성군 홍북읍 신대로 33</p>
                            <p className="dark:text-gray-400">통신판매업: 제 2025-충남홍성-0193 호 | 12jason@donacourse.com</p>
                            <p className="mt-1 text-emerald-500 dark:text-emerald-400 font-bold font-sans">고객센터: 010-2271-9824</p>
                        </div>
                    </div>
                </div>

                {/* 하단 고정 결제 버튼 */}
                <div className="p-6 bg-white dark:bg-[#1a241b] border-t border-gray-50 dark:border-gray-800 shrink-0">
                    <button
                        onClick={handlePayment}
                        disabled={loading}
                        className="w-full py-5 rounded-2xl bg-gray-900 dark:bg-gray-800 text-white font-black text-lg hover:bg-black dark:hover:bg-gray-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
                    >
                        {loading ? (
                            "결제창을 불러오고 있어요..."
                        ) : (
                            <>
                                <span>{selectedPlan?.name} 시작하기</span>
                                <ChevronRight className="w-5 h-5 text-emerald-400 dark:text-emerald-500" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TicketPlans;
