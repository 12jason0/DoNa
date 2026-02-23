"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Check, Sparkles, ChevronRight, ArrowLeft } from "lucide-react";
import { isMobileApp } from "@/lib/platform";
import Link from "next/link";

const PLANS = [
    {
        id: "sub_basic",
        type: "sub",
        name: "베이직 멤버십",
        price: 4900,
        originalPrice: 9900,
        desc: "평생 할인 혜택이 적용되는 얼리버드 찬스!",
        badge: "EARLY BIRD",
        features: [
            "BASIC 등급 코스 활성화",
            "나만의 추억 최대 10개 저장",
            "FREE/BASIC 데이트 팁",
            "광고 없이 쾌적한 이용",
        ],
        tier: "BASIC",
    },
    {
        id: "sub_premium",
        type: "sub",
        name: "프리미엄 멤버십",
        price: 9900,
        desc: "베이직 혜택 + 남들 모르는 시크릿 스팟 공개",
        badge: "VIP",
        features: [
            "모든 코스 및 시크릿 스팟",
            "나만의 추억 무제한 저장",
            "모든 전문 데이트 팁 활성화",
            "광고 없이 쾌적한 이용",
            "베이직 모든 혜택 포함",
        ],
        tier: "PREMIUM",
    },
    {
        id: "ticket_basic",
        type: "ticket",
        name: "BASIC 코스 열람권",
        price: 990,
        desc: "BASIC 등급 코스 1개 열람",
        tier: "BASIC",
    },
    {
        id: "ticket_premium",
        type: "ticket",
        name: "PREMIUM 코스 열람권",
        price: 1900,
        desc: "PREMIUM 등급 코스 1개 열람",
        tier: "PREMIUM",
    },
];

export interface TicketPlansProps {
    onClose: () => void;
    isModal?: boolean;
    /** 코스 컨텍스트: 이 코스 열람을 위한 결제 */
    courseId?: number;
    /** 코스 등급: BASIC이면 ticket_premium 비활성화, PREMIUM이면 ticket_basic 비활성화 */
    courseGrade?: "BASIC" | "PREMIUM";
    /** TIPS: 유료 팁 잠금 해제로 열림 | COURSE: 코스 열람으로 열림 → 카피(제목/옵션/버튼) 분기 */
    context?: "TIPS" | "COURSE";
}

const TicketPlans = ({ onClose, isModal = true, courseId, courseGrade, context = "COURSE" }: TicketPlansProps) => {
    const router = useRouter();
    // 🟢 [IN-APP PURCHASE]: 모바일 앱(WebView)에서만 인앱결제 사용
    const isMobileNative = isMobileApp();

    // 🟢 [수정]: 웹에서도 모달 표시 (결제 방식만 분기 처리)

    const [selectedPlanId, setSelectedPlanId] = useState<string>("sub_basic");
    const [loading, setLoading] = useState(false);
    const [currentTier, setCurrentTier] = useState<"FREE" | "BASIC" | "PREMIUM">("FREE");
    // 🟢 클릭 시 바로 표시: 모달은 항상 클라이언트 클릭 후에만 렌더되므로 window 체크로 즉시 표시
    const [modalMounted, setModalMounted] = useState(() => typeof window !== "undefined");
    const [modalSlideUp, setModalSlideUp] = useState(false);
    // 🟢 [IN-APP PURCHASE]: RevenueCat 상품 정보
    const [revenueCatProducts, setRevenueCatProducts] = useState<Record<string, any>>({});
    // 🟢 [결제 속도]: 웹에서 토스 SDK·인스턴스 미리 로드
    const tossPaymentsRef = useRef<any>(null);
    const selectedPlanIdRef = useRef(selectedPlanId);

    // 🟢 selectedPlanId ref 동기화 (fetchUserTier에서 최신값 사용)
    useEffect(() => {
        selectedPlanIdRef.current = selectedPlanId;
    }, [selectedPlanId]);

    // 🟢 [결제 속도]: 웹에서 토스 SDK·loadTossPayments 미리 로드
    useEffect(() => {
        if (isMobileNative || typeof window === "undefined") return;
        const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY_GENERAL;
        if (!clientKey || (!clientKey.startsWith("live_ck_") && !clientKey.startsWith("test_ck_"))) return;
        import("@tosspayments/tosspayments-sdk")
            .then((mod) => {
                mod.loadTossPayments(clientKey)
                    .then((instance) => {
                        tossPaymentsRef.current = instance;
                    })
                    .catch(() => {});
            })
            .catch(() => {});
    }, [isMobileNative]);

    // 🟢 [결제 속도]: 인앱결제 시 결제 버튼 클릭 전 fetchSession 캐시 예열 (모달 열릴 때 세션 미리 확인)
    useEffect(() => {
        if (!isMobileNative || typeof window === "undefined") return;
        import("@/lib/authClient").then(({ fetchSession }) => fetchSession()).catch(() => {});
    }, [isMobileNative]);

    // 🟢 현재 사용자 등급 확인 함수 (재사용 가능하도록 useCallback으로 정의)
    const fetchUserTier = useCallback(async () => {
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
            const tier = (data?.user?.subscriptionTier || "FREE") as "FREE" | "BASIC" | "PREMIUM";
            setCurrentTier(tier);

            // 🟢 선택한 멤버십이 이미 보유 등급이어서 구매 불가일 때만 첫 번째 티켓으로 전환
            // (업그레이드 가능한 멤버십·열람권 선택은 그대로 유지)
            const sid = selectedPlanIdRef.current;
            const sel = PLANS.find((p) => p.id === sid);
            const selectedSubIsDisabled =
                sel?.type === "sub" &&
                sel?.tier &&
                ((tier === "BASIC" && sel.tier === "BASIC") ||
                    (tier === "PREMIUM" && (sel.tier === "BASIC" || sel.tier === "PREMIUM")));
            if (selectedSubIsDisabled) {
                const firstTicket = PLANS.find((p) => p.type === "ticket");
                if (firstTicket) setSelectedPlanId(firstTicket.id);
            }
        } catch (error) {
            console.error("사용자 등급 조회 실패:", error);
            setCurrentTier("FREE");
        }
    }, []);

    // 🟢 컴포넌트 마운트 시 사용자 등급 확인
    useEffect(() => {
        fetchUserTier();
    }, [fetchUserTier]);

    // 🟢 모달: body overflow 잠금 + 바닥에서 위로 슬라이드업 애니메이션
    useEffect(() => {
        if (!isModal) return;
        document.body.style.overflow = "hidden";
        const t = requestAnimationFrame(() => setModalSlideUp(true));
        return () => {
            document.body.style.overflow = "";
            cancelAnimationFrame(t);
        };
    }, [isModal]);

    // 🟢 [코스 컨텍스트] courseGrade에 맞는 티켓만 선택 가능, 기본 선택
    useEffect(() => {
        if (courseId != null && courseGrade) {
            if (courseGrade === "BASIC") {
                setSelectedPlanId("ticket_basic");
            } else if (courseGrade === "PREMIUM") {
                setSelectedPlanId("ticket_premium");
            }
        } else {
            // 코스 컨텍스트 없으면 구독만 표시, 티켓 선택 시 sub_basic으로
            setSelectedPlanId((prev) => (prev === "ticket_basic" || prev === "ticket_premium" ? "sub_basic" : prev));
        }
    }, [courseId, courseGrade]);

    // 🟢 결제 성공 이벤트 감지하여 사용자 등급 자동 업데이트
    useEffect(() => {
        if (typeof window === "undefined") return;

        const handlePurchaseSuccess = () => {
            console.log("[TicketPlans] 결제 성공 이벤트 감지 - 사용자 등급 업데이트 중...");
            // 약간의 지연 후 업데이트 (결제 처리 완료 대기)
            setTimeout(() => {
                fetchUserTier();
            }, 1000);
        };

        // 여러 이벤트 리스닝 (인앱 결제, 웹 결제 모두 대응)
        window.addEventListener("purchaseSuccess", handlePurchaseSuccess as EventListener);
        window.addEventListener("paymentSuccess", handlePurchaseSuccess as EventListener);
        window.addEventListener("subscriptionChanged", handlePurchaseSuccess as EventListener);

        return () => {
            window.removeEventListener("purchaseSuccess", handlePurchaseSuccess as EventListener);
            window.removeEventListener("paymentSuccess", handlePurchaseSuccess as EventListener);
            window.removeEventListener("subscriptionChanged", handlePurchaseSuccess as EventListener);
        };
    }, [fetchUserTier]);

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

        window.addEventListener("revenueCatProductsLoaded", handleRevenueCatProducts as EventListener);

        return () => {
            window.removeEventListener("revenueCatProductsLoaded", handleRevenueCatProducts as EventListener);
        };
    }, [isMobileNative]);

    // 🟢 [IN-APP PURCHASE]: WebView 브리지로부터 결제 결과 수신
    useEffect(() => {
        if (typeof window === "undefined") return;

        const handlePurchaseResult = (event: CustomEvent) => {
            const { success, error, planId, courseId: resultCourseId } = event.detail || {};

            setLoading(false);

            if (success) {
                alert("결제가 완료되었습니다!");
                onClose();
                window.dispatchEvent(new CustomEvent("purchaseSuccess"));
                // 🟢 코스 열람권 결제 시 해당 코스 페이지로 이동
                if (resultCourseId) {
                    router.replace(`/courses/${resultCourseId}`);
                }
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
    const updatedPlans = PLANS.map((plan) => {
        const revenueCatProduct = revenueCatProducts[plan.id];
        if (revenueCatProduct && isMobileNative) {
            // 가격을 숫자로 변환 (예: "₩7,900" -> 7900)
            const priceMatch = revenueCatProduct.priceString?.match(/[\d,]+/);
            const price = priceMatch ? parseInt(priceMatch[0].replace(/,/g, ""), 10) : plan.price;

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
            // 🟢 [성능 최적화]: 토스가 미리 로드돼 있으면 SDK 로드 생략, 없을 때만 인증·SDK 병렬
            const [session, tossSdk] = await Promise.all([
                import("@/lib/authClient").then(({ fetchSession }) => fetchSession()),
                !isMobileNative && !tossPaymentsRef.current
                    ? import("@tosspayments/tosspayments-sdk")
                    : Promise.resolve(null),
            ]);

            if (!session.authenticated || !session.user) {
                alert("로그인이 필요합니다.");
                setLoading(false);
                return;
            }

            // 🟢 [티켓 결제 + 코스 컨텍스트] Unlock Intent 사전 발급 (productId 기반 검증)
            let intentId: string | null = null;
            const planToProductId: Record<string, string> = {
                ticket_basic: "course_basic",
                ticket_premium: "course_premium",
            };
            if (
                selectedPlan.type === "ticket" &&
                courseId != null &&
                (selectedPlan.id === "ticket_basic" || selectedPlan.id === "ticket_premium")
            ) {
                const productId = planToProductId[selectedPlan.id];
                const { authenticatedFetch } = await import("@/lib/authClient");
                const intentRes = await authenticatedFetch<{ intentId?: string }>("/api/payments/unlock-intent", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        courseId: Number(courseId),
                        productId,
                        unlockTarget: "FULL",
                    }),
                });
                if (intentRes?.intentId) {
                    intentId = intentRes.intentId;
                } else {
                    alert("결제 준비에 실패했습니다. 다시 시도해주세요.");
                    setLoading(false);
                    return;
                }
            }

            // 🟢 [IN-APP PURCHASE]: 모바일 앱에서는 인앱결제 사용
            if (isMobileNative && typeof window !== "undefined" && (window as any).ReactNativeWebView) {
                (window as any).ReactNativeWebView.postMessage(
                    JSON.stringify({
                        type: "requestInAppPurchase",
                        planId: selectedPlan.id,
                        planType: selectedPlan.type,
                        intentId: intentId || undefined,
                        courseId: courseId ?? undefined,
                    }),
                );
                if (typeof window !== "undefined" && intentId) {
                    sessionStorage.setItem("pendingPaymentIntentId", intentId);
                    sessionStorage.setItem("pendingPaymentCourseId", String(courseId));
                }
                return;
            }

            // 🟢 [WEB PAYMENT]: 토스페이먼츠 사용 (미리 로드된 인스턴스 우선 → 결제창 속도 개선)
            if (!isMobileNative && (tossPaymentsRef.current || tossSdk)) {
                const userId = session.user.id;
                const customerKey = `user_${userId}`;
                const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY_GENERAL;

                if (!clientKey) {
                    throw new Error(
                        "토스페이먼츠 클라이언트 키가 설정되지 않았습니다. NEXT_PUBLIC_TOSS_CLIENT_KEY_GENERAL 환경 변수를 확인해주세요.",
                    );
                }
                if (!clientKey.startsWith("live_ck_") && !clientKey.startsWith("test_ck_")) {
                    throw new Error(
                        "토스페이먼츠 클라이언트 키 형식이 올바르지 않습니다. API 개별 연동 키(ck_로 시작)를 사용해주세요.",
                    );
                }

                let tossPayments = tossPaymentsRef.current;
                if (!tossPayments && tossSdk) {
                    const { loadTossPayments } = tossSdk;
                    tossPayments = await loadTossPayments(clientKey);
                }

                const orderId = `${selectedPlan.id}_${Date.now()}`;
                if (typeof window !== "undefined") {
                    sessionStorage.setItem("pendingPaymentPlan", selectedPlan.id);
                    sessionStorage.setItem("pendingPaymentOrderId", orderId);
                    if (intentId) sessionStorage.setItem("pendingPaymentIntentId", intentId);
                    if (courseId != null) sessionStorage.setItem("pendingPaymentCourseId", String(courseId));
                }

                let successUrl = `${window.location.origin}/personalized-home/pay/success?plan=${selectedPlan.id}&orderId=${orderId}`;
                if (intentId) successUrl += `&intentId=${encodeURIComponent(intentId)}`;
                if (courseId != null) successUrl += `&courseId=${courseId}`;

                const payment = tossPayments!.payment({ customerKey });
                await payment.requestPayment({
                    method: "CARD",
                    amount: { currency: "KRW", value: selectedPlan.price },
                    orderId,
                    orderName: selectedPlan.name,
                    successUrl,
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

    // 🟢 모달: Portal로 body에 렌더 (코스 카드 내부에서도 뷰포트 전체 커버)
    if (isModal) {
        if (!modalMounted || typeof window === "undefined") return null;

        const modalContent = (
            <>
                {/* 배경: 맨 위, 흐림 처리, 전체 커버 */}
                <div
                    className="fixed inset-0 z-9999 bg-black/70 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={onClose}
                    aria-hidden
                />
                {/* 하단 시트: 바닥에 붙여 위로 슬라이드 */}
                <div
                    className="fixed left-0 right-0 bottom-0 z-10000 flex justify-center p-0 sm:p-5 sm:items-center"
                    style={{ pointerEvents: "auto" }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        className="bg-white dark:bg-[#1a241b] w-full max-w-md h-[90vh] sm:h-auto sm:max-h-[80vh] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl transition-transform duration-200 ease-out"
                        style={{
                            transform: modalSlideUp ? "translateY(0)" : "translateY(100%)",
                        }}
                    >
                        {/* 상단 헤더 */}
                        <div className="px-5 pt-6 pb-3 flex justify-between items-start shrink-0">
                            <div>
                                {context === "TIPS" && courseId != null ? (
                                    <>
                                        <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                                            실행 팁 열기
                                        </h2>
                                        <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5 font-medium">
                                            커피 한 잔 값으로 시크릿 공략집을 열어요
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                                            두나 멤버십으로
                                            <br />
                                            <span className="text-emerald-500 dark:text-emerald-400">데이트 고민 끝! ✨</span>
                                        </h2>
                                        <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5 font-medium">
                                            합리적인 가격으로 즐기는 스마트한 데이트
                                        </p>
                                    </>
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-full hover:rotate-90 transition-all"
                            >
                                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            </button>
                        </div>
                        {renderContent()}
                    </div>
                </div>
            </>
        );

        return createPortal(modalContent, document.body);
    }

    // 🟢 페이지 형태 렌더링
    return (
        <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0f1710] pb-20">
            <div className="max-w-2xl mx-auto px-6 py-12">
                {/* 뒤로 가기 링크 */}
                <Link
                    href="/"
                    className="text-gray-400 dark:text-gray-500 flex items-center gap-1 mb-6 hover:text-gray-900 dark:hover:text-gray-200 transition-all font-medium"
                >
                    <ArrowLeft className="w-4 h-4" />
                    홈으로
                </Link>

                {/* 상단 헤더 */}
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                        두나 멤버십으로
                        <br />
                        <span className="text-emerald-500 dark:text-emerald-400">데이트 고민 끝! ✨</span>
                    </h1>
                    <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">
                        합리적인 가격으로 즐기는 스마트한 데이트
                    </p>
                </div>
                {renderContent()}
            </div>
        </div>
    );

    function renderContent() {
        return (
            <>
                {/* 스크롤 가능한 콘텐츠 영역 */}
                <div className={isModal ? "flex-1 overflow-y-auto px-5 space-y-6 pb-8 scrollbar-hide" : "space-y-8"}>
                    {/* 구독 플랜 */}
                    <div className="space-y-4 pt-2">
                        <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">
                            Monthly Membership
                        </h4>
                        {updatedPlans
                            .filter((p) => p.type === "sub")
                            .map((plan) => {
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
                                                            isDisabled
                                                                ? "text-gray-400 dark:text-gray-600"
                                                                : "text-gray-900 dark:text-white"
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
                                                        isDisabled
                                                            ? "text-gray-400 dark:text-gray-600"
                                                            : "text-gray-500 dark:text-gray-400"
                                                    }`}
                                                >
                                                    {isDisabled ? "이미 이용 중인 멤버십입니다" : plan.desc}
                                                </p>
                                                <div className="mt-3 flex items-baseline gap-1.5">
                                                    <span
                                                        className={`text-2xl font-black ${
                                                            isDisabled
                                                                ? "text-gray-400 dark:text-gray-600"
                                                                : "text-gray-900 dark:text-white"
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
                                                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500">
                                                            / 월
                                                        </span>
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
                                                            isDisabled
                                                                ? "text-gray-400 dark:text-gray-600"
                                                                : "text-gray-500 dark:text-gray-400"
                                                        }`}
                                                    >
                                                        <Check
                                                            className={`w-3 h-3 ${
                                                                isDisabled
                                                                    ? "text-gray-300 dark:text-gray-700"
                                                                    : "text-emerald-400 dark:text-emerald-500"
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

                    {/* 티켓 플랜 (코스 컨텍스트 있을 때만 표시) */}
                    {courseId != null && courseGrade && (
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">
                                {context === "TIPS" ? "실행 가이드" : "코스 열람권"}
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                                {updatedPlans
                                    .filter((p) => p.type === "ticket")
                                    .map((plan) => {
                                        // 🟢 코스 컨텍스트: BASIC 코스면 ticket_premium 비활성화, PREMIUM 코스면 ticket_basic 비활성화
                                        const isTicketDisabled =
                                            courseGrade === "BASIC" && plan.id === "ticket_premium"
                                                ? true
                                                : courseGrade === "PREMIUM" && plan.id === "ticket_basic"
                                                  ? true
                                                  : false;
                                        return (
                                            <div
                                                key={plan.id}
                                                onClick={() => !isTicketDisabled && setSelectedPlanId(plan.id)}
                                                className={`p-4 rounded-xl border-2 transition-all flex justify-between items-center ${
                                                    isTicketDisabled
                                                        ? "border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 opacity-50 cursor-not-allowed"
                                                        : selectedPlanId === plan.id
                                                          ? "border-emerald-500 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-400 cursor-pointer"
                                                          : "border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-[#0f1710] cursor-pointer"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className={`w-2 h-2 rounded-full ${
                                                            isTicketDisabled
                                                                ? "bg-gray-300 dark:bg-gray-600"
                                                                : selectedPlanId === plan.id
                                                                  ? "bg-emerald-500 dark:bg-emerald-400"
                                                                  : "bg-gray-300 dark:bg-gray-600"
                                                        }`}
                                                    />
                                                    <span
                                                        className={`font-bold text-sm ${isTicketDisabled ? "text-gray-400 dark:text-gray-500" : "dark:text-white"}`}
                                                    >
                                                        {context === "TIPS" && plan.id === "ticket_basic"
                                                            ? "실행 팁 + 코스 전체 열기"
                                                            : plan.name}
                                                    </span>
                                                </div>
                                                <span
                                                    className={`font-black text-sm ${isTicketDisabled ? "text-gray-400 dark:text-gray-500" : "dark:text-white"}`}
                                                >
                                                    {plan.price.toLocaleString()}원
                                                </span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {/* 하단 약관 및 사업자 정보 (스크롤 영역 안으로 이동하여 버튼 공간 확보) */}
                    <div className="pt-6 border-t border-gray-100 dark:border-gray-800 space-y-4 pb-4">
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 text-center space-y-2">
                            <p className="font-bold text-gray-500 dark:text-gray-400 underline underline-offset-4 mb-1">
                                법적 필수 안내
                            </p>
                            <div className="flex justify-center gap-3 flex-wrap text-[11px]">
                                <a
                                    href="https://dona.io.kr/privacy"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-500 dark:text-emerald-300 hover:underline hover:text-emerald-600"
                                >
                                    개인정보 처리방침
                                </a>
                                <a
                                    href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-500 dark:text-emerald-300 hover:underline hover:text-emerald-600"
                                >
                                    이용 약관 (EULA)
                                </a>
                            </div>
                            <p className="dark:text-gray-400 text-[10.5px] leading-relaxed">
                                구독은 현재 기간 종료 최소 24시간 전에 해지하지 않으면 자동으로 갱신됩니다. 구매 확인 시
                                iTunes 계정으로 결제가 청구됩니다. 구독 관리 및 자동 갱신 해지는 구매 후 App Store 계정
                                설정에서 할 수 있습니다.
                            </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl text-[9px] text-gray-400 dark:text-gray-500 leading-relaxed text-center">
                            <p className="font-bold text-gray-500 dark:text-gray-400 mb-1">두나(DoNa) 사업자 정보</p>
                            <p className="dark:text-gray-400">대표: 오승용 | 사업자등록번호: 166-10-03081</p>
                            <p className="dark:text-gray-400">주소: 충청남도 홍성군 홍북읍 신대로 33</p>
                            <p className="dark:text-gray-400">
                                통신판매업: 제 2025-충남홍성-0193 호 | 12jason@donacourse.com
                            </p>
                            <p className="mt-1 text-emerald-500 dark:text-emerald-400 font-bold font-sans">
                                고객센터: 010-2271-9824
                            </p>
                        </div>
                    </div>
                </div>

                {/* 하단 고정 결제 버튼 (모바일 safe area 대응) */}
                <div
                    className={
                        isModal
                            ? "px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white dark:bg-[#1a241b] border-t border-gray-50 dark:border-gray-800 shrink-0"
                            : "mt-8"
                    }
                >
                    {selectedPlan?.type === "ticket" && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center mb-3">
                            {context === "TIPS" && selectedPlan?.id === "ticket_basic"
                                ? "결제 후 코스 전체 + 실행 팁이 열려요"
                                : "단건 열람권은 구매 즉시 콘텐츠가 제공되어 환불이 제한됩니다."}
                        </p>
                    )}
                    <button
                        onClick={handlePayment}
                        disabled={loading}
                        className="w-full py-3.5 rounded-xl bg-gray-900 dark:bg-gray-800 text-white font-bold text-sm hover:bg-black dark:hover:bg-gray-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                    >
                        {loading ? (
                            "결제창을 불러오고 있어요..."
                        ) : (
                            <>
                                <span>
                                    {context === "TIPS" && selectedPlan?.id === "ticket_basic"
                                        ? `실행 팁 열기 · ${selectedPlan?.price?.toLocaleString() ?? 990}원`
                                        : `${selectedPlan?.name} 시작하기`}
                                </span>
                                <ChevronRight className="w-4 h-4 text-emerald-400 dark:text-emerald-500" />
                            </>
                        )}
                    </button>
                </div>
            </>
        );
    }
};

export default TicketPlans;
