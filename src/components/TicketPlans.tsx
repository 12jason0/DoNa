"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Check, Sparkles, ChevronRight, ArrowLeft } from "lucide-react";
import { isMobileApp } from "@/lib/platform";
import { useAppLayout, ANDROID_MODAL_BOTTOM } from "@/context/AppLayoutContext";
import { useLocale } from "@/context/LocaleContext";
import type { TranslationKeys } from "@/types/i18n";
import Link from "next/link";

const PLANS = [
    {
        id: "sub_basic",
        type: "sub",
        price: 4900,
        originalPrice: 9900,
        badge: "EARLY BIRD",
        featuresCount: 3,
        featureIndices: [0, 1, 2],
        tier: "BASIC",
    },
    {
        id: "sub_premium",
        type: "sub",
        price: 9900,
        badge: "VIP",
        featuresCount: 4,
        featureIndices: [0, 1, 2, 3],
        tier: "PREMIUM",
    },
    {
        id: "ticket_basic",
        type: "ticket",
        price: 990,
        tier: "BASIC",
    },
    {
        id: "ticket_premium",
        type: "ticket",
        price: 1900,
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
    /** COURSE: 코스 열람으로 열림 | UPGRADE: 등급 업그레이드(구독권만, 티켓 숨김) */
    context?: "COURSE" | "UPGRADE";
}

const TicketPlans = ({ onClose, isModal = true, courseId, courseGrade, context = "COURSE" }: TicketPlansProps) => {
    const router = useRouter();
    const { t } = useLocale();
    const { containInPhone, modalContainerRef, isAndroidApp, iosIgnoreSafeAreaBottom } = useAppLayout();
    // 🟢 [IN-APP PURCHASE]: 모바일 앱(WebView)에서만 인앱결제 사용
    const isMobileNative = isMobileApp();

    // 🟢 [수정]: 웹에서도 모달 표시 (결제 방식만 분기 처리)

    const [selectedPlanId, setSelectedPlanId] = useState<string>("sub_basic");
    const [loading, setLoading] = useState(false);
    const [currentTier, setCurrentTier] = useState<"FREE" | "BASIC" | "PREMIUM">("FREE");
    // 🟢 클릭 시 바로 표시: 모달은 항상 클라이언트 클릭 후에만 렌더되므로 window 체크로 즉시 표시
    const [modalMounted, setModalMounted] = useState(() => typeof window !== "undefined");
    const [modalSlideUp, setModalSlideUp] = useState(false);
    // 🟢 모바일 300ms 고스트 클릭 방지: 배경 클릭 활성화 지연 (모달 열린 직후 탭의 지연 클릭이 배경에 전달되는 현상 방지)
    const [backdropReady, setBackdropReady] = useState(false);
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

            // 🟢 선택한 멤버십이 이미 보유 등급이어서 구매 불가일 때 전환
            // UPGRADE 컨텍스트: 구독권만 → 다음 구독 플랜으로. 그 외: 첫 번째 티켓으로
            const sid = selectedPlanIdRef.current;
            const sel = PLANS.find((p) => p.id === sid);
            const selectedSubIsDisabled =
                sel?.type === "sub" &&
                sel?.tier &&
                ((tier === "BASIC" && sel.tier === "BASIC") ||
                    (tier === "PREMIUM" && (sel.tier === "BASIC" || sel.tier === "PREMIUM")));
            if (selectedSubIsDisabled) {
                if (context === "UPGRADE") {
                    setSelectedPlanId(tier === "BASIC" ? "sub_premium" : "sub_basic");
                } else {
                    const firstTicket = PLANS.find((p) => p.type === "ticket");
                    if (firstTicket) setSelectedPlanId(firstTicket.id);
                }
            }
        } catch (error) {
            console.error("Failed to fetch user tier:", error);
            setCurrentTier("FREE");
        }
    }, [context]);

    // 🟢 컴포넌트 마운트 시 사용자 등급 확인
    useEffect(() => {
        fetchUserTier();
    }, [fetchUserTier]);

    // 🟢 모달: body overflow 잠금 + 바닥에서 위로 슬라이드업 애니메이션
    useEffect(() => {
        if (!isModal) return;
        document.body.style.overflow = "hidden";
        setBackdropReady(false);
        const t = requestAnimationFrame(() => setModalSlideUp(true));
        const timer = setTimeout(() => setBackdropReady(true), 400);
        return () => {
            document.body.style.overflow = "";
            cancelAnimationFrame(t);
            clearTimeout(timer);
        };
    }, [isModal]);

    // 🟢 [UPGRADE 컨텍스트] 등급 업그레이드: 구독권만 표시, FREE→sub_basic, BASIC→sub_premium
    useEffect(() => {
        if (context === "UPGRADE") {
            setSelectedPlanId(currentTier === "BASIC" ? "sub_premium" : "sub_basic");
            return;
        }
        // 🟢 [코스 컨텍스트] courseGrade + currentTier에 맞는 기본 선택
        // BASIC 유저는 ticket_basic( FREE 전용) 불가 → sub_premium 또는 ticket_premium만
        if (courseId != null && courseGrade) {
            if (currentTier === "BASIC") {
                if (courseGrade === "BASIC") {
                    setSelectedPlanId("sub_premium");
                } else {
                    setSelectedPlanId("ticket_premium");
                }
            } else {
                if (courseGrade === "BASIC") {
                    setSelectedPlanId("ticket_basic");
                } else {
                    setSelectedPlanId("ticket_premium");
                }
            }
        } else {
            setSelectedPlanId((prev) => (prev === "ticket_basic" || prev === "ticket_premium" ? "sub_basic" : prev));
        }
    }, [context, courseId, courseGrade, currentTier]);

    // 🟢 BASIC 등급 유저가 등급 업그레이드로 진입 시: sub_basic(비활성) 대신 sub_premium만 선택 가능하도록 기본값 설정
    useEffect(() => {
        if (currentTier === "BASIC" && selectedPlanId === "sub_basic") {
            setSelectedPlanId("sub_premium");
        }
    }, [currentTier]);

    // 🟢 결제 성공 이벤트 감지하여 사용자 등급 자동 업데이트
    useEffect(() => {
        if (typeof window === "undefined") return;

        const handlePurchaseSuccess = () => {
            console.log("[TicketPlans] Payment success detected - updating user tier...");
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

            console.log("[TicketPlans] RevenueCat product info received:", productMap);
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
                alert(t("ticketPlans.alerts.paymentComplete"));
                onClose();
                window.dispatchEvent(new CustomEvent("purchaseSuccess"));
                // 🟢 코스 열람권 결제 시 해당 코스 페이지로 이동
                if (resultCourseId) {
                    router.replace(`/courses/${resultCourseId}`);
                }
            } else {
                const errorMessage = error || t("ticketPlans.alerts.paymentError");
                alert(errorMessage);
            }
        };

        window.addEventListener("purchaseResult", handlePurchaseResult as EventListener);

        return () => {
            window.removeEventListener("purchaseResult", handlePurchaseResult as EventListener);
        };
    }, [onClose, t]);

    // 🟢 RevenueCat 상품 정보로 PLANS 업데이트
    const updatedPlans = PLANS.map((plan) => {
        const revenueCatProduct = revenueCatProducts[plan.id];
        const translatedName = t(`ticketPlans.plans.${plan.id}.name` as TranslationKeys);
        const translatedDesc = t(`ticketPlans.plans.${plan.id}.desc` as TranslationKeys);
        const basePlan = { ...plan, name: translatedName, desc: translatedDesc };
        if (revenueCatProduct && isMobileNative) {
            const priceMatch = revenueCatProduct.priceString?.match(/[\d,]+/);
            const price = priceMatch ? parseInt(priceMatch[0].replace(/,/g, ""), 10) : plan.price;
            return {
                ...basePlan,
                name: revenueCatProduct.title || translatedName,
                price: price || plan.price,
            };
        }
        return basePlan;
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
                alert(t("ticketPlans.alerts.alreadySubscribed"));
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
                alert(t("ticketPlans.alerts.loginRequired"));
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
                    alert(t("ticketPlans.alerts.paymentFailed"));
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
            alert(t("ticketPlans.alerts.appUpdateRequired"));
            setLoading(false);
        } catch (error: any) {
            console.error("[In-app purchase error]:", error);
            const errorMessage = error?.message || t("ticketPlans.alerts.paymentError");
            alert(errorMessage);
            setLoading(false);
        }
    };

    // 🟢 모달: Portal로 body 또는 폰 컨테이너에 렌더 (웹 폰 목업에서는 폰 안으로)
    if (isModal) {
        if (!modalMounted || typeof window === "undefined") return null;

        const posClass = containInPhone ? "absolute" : "fixed";
        const modalContent = (
            <>
                {/* 배경: 맨 위, 흐림 처리, 전체 커버 - 400ms 후에만 클릭 활성화 (모바일 고스트 클릭 방지) */}
                <div
                    className={`${posClass} inset-0 z-9999 bg-black/70 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300`}
                    onClick={onClose}
                    style={{ pointerEvents: backdropReady ? "auto" : "none" }}
                    aria-hidden
                />
                {/* 하단 시트: 바닥에 붙여 위로 슬라이드, 폰 내부에서는 양쪽 끝에 붙임. Android 앱은 footer와 같은 위치에서 시작 */}
                <div
                    className={`${posClass} left-0 right-0 bottom-0 z-10000 flex ${containInPhone ? "p-0" : "justify-center px-0 sm:px-5"}`}
                    style={{
                        pointerEvents: "auto",
                        ...(isAndroidApp ? { bottom: ANDROID_MODAL_BOTTOM } : {}),
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        className={`bg-white dark:bg-[#1a241b] w-full flex flex-col overflow-hidden shadow-2xl transition-transform duration-200 ease-out max-w-md h-[70vh] max-h-[70vh] rounded-t-3xl`}
                        style={{
                            transform: modalSlideUp ? "translateY(0)" : "translateY(100%)",
                        }}
                    >
                        {/* 상단 헤더 */}
                        <div className="px-5 pt-6 pb-3 flex justify-between items-start shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                                    {t("ticketPlans.mainTitle")}
                                    <br />
                                    <span className="text-emerald-500 dark:text-emerald-400">
                                        {t("ticketPlans.mainHighlight")}
                                    </span>
                                </h2>
                                <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5 font-medium">
                                    {t("ticketPlans.mainSubtitle")}
                                </p>
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

        const portalTarget = containInPhone && modalContainerRef?.current ? modalContainerRef.current : document.body;
        return createPortal(modalContent, portalTarget);
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
                    {t("ticketPlans.backToHome")}
                </Link>

                {/* 상단 헤더 */}
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                        {t("ticketPlans.mainTitle")}
                        <br />
                        <span className="text-emerald-500 dark:text-emerald-400">{t("ticketPlans.mainHighlight")}</span>
                    </h1>
                    <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">
                        {t("ticketPlans.mainSubtitle")}
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
                            {t("ticketPlans.monthlyMembership")}
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
                                                {t("ticketPlans.currentPlan")}
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
                                                    {isDisabled ? t("ticketPlans.alreadySubscribed") : plan.desc}
                                                </p>
                                                <div className="mt-3 flex items-baseline gap-1.5 flex-wrap">
                                                    <span
                                                        className={`text-2xl font-black whitespace-nowrap ${
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
                                                            {t("ticketPlans.perMonth")}
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
                                                {plan.featuresCount != null &&
                                                    ((plan as { featureIndices?: number[] }).featureIndices ??
                                                        Array.from({ length: plan.featuresCount }, (_, i) => i)).map((i) => (
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
                                                            {t(
                                                                `ticketPlans.plans.${plan.id}.feature${i}` as TranslationKeys,
                                                            )}
                                                        </li>
                                                    ))}
                                            </ul>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>

                    {/* 티켓 플랜 (코스 컨텍스트 있을 때만) */}
                    {courseId != null && courseGrade && context !== "UPGRADE" && (
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">
                                {t("ticketPlans.courseTicket")}
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                                {updatedPlans
                                    .filter((p) => p.type === "ticket")
                                    .map((plan) => {
                                        // 🟢 코스 컨텍스트: BASIC 코스→ticket_premium 비활성, PREMIUM 코스→ticket_basic 비활성
                                        // 🟢 BASIC 유저는 ticket_basic 비활성 (FREE 전용, 이미 BASIC 보유)
                                        const isTicketDisabled =
                                            courseGrade === "BASIC" && plan.id === "ticket_premium"
                                                ? true
                                                : courseGrade === "PREMIUM" && plan.id === "ticket_basic"
                                                  ? true
                                                  : currentTier === "BASIC" && plan.id === "ticket_basic"
                                                    ? true
                                                    : false;
                                        return (
                                            <div
                                                key={plan.id}
                                                onClick={() => !isTicketDisabled && setSelectedPlanId(plan.id)}
                                                className={`relative p-4 rounded-xl border-2 transition-all flex justify-between items-center ${
                                                    isTicketDisabled
                                                        ? "border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 opacity-50 cursor-not-allowed"
                                                        : selectedPlanId === plan.id
                                                          ? "border-emerald-500 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-400 cursor-pointer"
                                                          : "border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-[#0f1710] cursor-pointer"
                                                }`}
                                            >
                                                {isTicketDisabled &&
                                                    currentTier === "BASIC" &&
                                                    plan.id === "ticket_basic" && (
                                                        <span className="absolute -top-2.5 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-emerald-500">
                                                            {t("ticketPlans.alreadyAvailable")}
                                                        </span>
                                                    )}
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
                                                        {plan.name}
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
                                {t("ticketPlans.legalNotice")}
                            </p>
                            <div className="flex justify-center gap-3 flex-wrap text-[11px]">
                                <a
                                    href="https://dona.io.kr/privacy"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-500 dark:text-emerald-300 hover:underline hover:text-emerald-600"
                                >
                                    {t("ticketPlans.privacyPolicy")}
                                </a>
                                <a
                                    href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-500 dark:text-emerald-300 hover:underline hover:text-emerald-600"
                                >
                                    {t("ticketPlans.eula")}
                                </a>
                            </div>
                            <p className="dark:text-gray-400 text-[10.5px] leading-relaxed">
                                {t("ticketPlans.subscriptionRenewal")}
                            </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl text-[9px] text-gray-400 dark:text-gray-500 leading-relaxed text-center">
                            <p className="font-bold text-gray-500 dark:text-gray-400 mb-1">
                                {t("ticketPlans.businessInfo")}
                            </p>
                            <p className="dark:text-gray-400">{t("ticketPlans.businessDetails")}</p>
                            <p className="dark:text-gray-400">{t("ticketPlans.businessAddress")}</p>
                            <p className="dark:text-gray-400">{t("ticketPlans.businessContact")}</p>
                            <p className="mt-1 text-emerald-500 dark:text-emerald-400 font-bold font-sans">
                                {t("ticketPlans.customerCenter")}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 하단 고정 결제 버튼 (모바일 safe area 대응) */}
                <div
                    className={
                        isModal
                            ? `px-5 py-4 shrink-0 bg-white dark:bg-[#1a241b] border-t border-gray-50 dark:border-gray-800 ${iosIgnoreSafeAreaBottom ? "pb-4" : "pb-[max(1rem,env(safe-area-inset-bottom))]"}`
                            : "mt-8"
                    }
                >
                    {selectedPlan?.type === "ticket" && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center mb-3">
                            {t("ticketPlans.ticketTip2")}
                        </p>
                    )}
                    <button
                        onClick={handlePayment}
                        disabled={loading}
                        className="w-full py-3.5 rounded-xl bg-gray-900 dark:bg-gray-800 text-white font-bold text-sm hover:bg-black dark:hover:bg-gray-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                    >
                        {loading ? (
                            t("ticketPlans.loadingPayment")
                        ) : (
                            <>
                                <span>
                                    {t("ticketPlans.startPlan", { name: selectedPlan?.name ?? "" })}
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
