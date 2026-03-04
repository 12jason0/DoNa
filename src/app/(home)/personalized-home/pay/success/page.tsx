"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

// 결제 처리 로직 컴포넌트
function PaymentSuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
    const [errorMessage, setErrorMessage] = useState("");
    const [successRedirectPath, setSuccessRedirectPath] = useState("/personalized-home");

    // 중복 승인 요청 방지를 위한 useRef
    const hasCalledAPI = useRef(false);

    useEffect(() => {
        const confirmPayment = async () => {
            // ============================================
            // 1단계: URL에서 토스페이먼츠가 전달해준 정보 추출
            // ============================================
            // 토스페이먼츠가 결제 완료 후 이 페이지로 리다이렉트할 때,
            // 다음 쿼리 파라미터들을 URL에 포함시켜서 보내줍니다:
            // - paymentKey: 결제 고유 키 (토스가 생성)
            // - orderId: 주문 ID (우리가 생성해서 보낸 것)
            // - amount: 결제 금액
            // - plan: 우리가 successUrl에 포함시킨 상품 ID (sub_premium, ticket_light 등)
            const paymentKey = searchParams.get("paymentKey");
            const orderId = searchParams.get("orderId") || (typeof window !== "undefined" ? sessionStorage.getItem('pendingPaymentOrderId') : null);
            const amount = searchParams.get("amount");
            // 🟢 [Fix]: plan이 URL에 없으면 sessionStorage에서 가져오기 (리다이렉트 시 파라미터 손실 대응)
            const plan = searchParams.get("plan") || (typeof window !== "undefined" ? sessionStorage.getItem('pendingPaymentPlan') : null);
            // 🟢 [Unlock Intent]: 코스 열람권 결제 시 intentId, courseId
            const intentId = searchParams.get("intentId") || (typeof window !== "undefined" ? sessionStorage.getItem('pendingPaymentIntentId') : null);
            const courseIdParam = searchParams.get("courseId") || (typeof window !== "undefined" ? sessionStorage.getItem('pendingPaymentCourseId') : null);

            // ============================================
            // 2단계: 사용자 인증 정보 확인 (서버 세션 사용)
            // ============================================
            // 🟢 [Fix]: localStorage 대신 서버 세션에서 사용자 정보 가져오기
            let userId: number | null = null;
            try {
                const { fetchSession } = await import("@/lib/authClient");
                const session = await fetchSession();
                if (session.authenticated && session.user?.id) {
                    userId = session.user.id;
                }
            } catch (error) {
                console.error("[Payment Success] 세션 확인 실패:", error);
            }

            // sessionStorage에서 사용한 정보 정리
            if (typeof window !== "undefined") {
                sessionStorage.removeItem('pendingPaymentPlan');
                sessionStorage.removeItem('pendingPaymentOrderId');
                sessionStorage.removeItem('pendingPaymentIntentId');
                sessionStorage.removeItem('pendingPaymentCourseId');
            }

            // ============================================
            // 3단계: 필수 정보 검증
            // ============================================
            if (!paymentKey || !orderId || !amount || !plan || !userId) {
                console.error("[Payment Success] 필수 정보 누락:", {
                    paymentKey: !!paymentKey,
                    orderId: !!orderId,
                    amount: !!amount,
                    plan: !!plan,
                    userId: !!userId,
                });
                setStatus("error");
                setErrorMessage("필수 결제 정보나 사용자 인증 정보가 누락되었습니다.");
                return;
            }

            // ============================================
            // 4단계: 중복 요청 방지 (React StrictMode 대응)
            // ============================================
            if (hasCalledAPI.current) return;
            hasCalledAPI.current = true;

            try {
                // ============================================
                // 5단계: 서버에 결제 승인 요청 전송
                // ============================================
                // 백엔드 API(/api/payments/confirm)로 모든 정보를 전달합니다.
                // 백엔드는 이 정보를 바탕으로:
                // 1) 토스페이먼츠 서버에 최종 승인 요청
                // 2) 승인 성공 시 DB에 결제 기록 저장
                // 3) 사용자에게 열람권/구독 혜택 지급
                const confirmBody: Record<string, unknown> = {
                    paymentKey,
                    orderId,
                    amount: Number(amount),
                    plan,
                };
                if (intentId) confirmBody.intentId = intentId;

                const res = await fetch("/api/payments/confirm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(confirmBody),
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    // 🟢 결제 완료 이벤트 발생 (마이페이지 구매 내역 갱신용)
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("paymentSuccess"));
                        // 🟢 구독권 구매 시 구독 변경 이벤트도 발생
                        if (data.updatedUser?.subscriptionTier) {
                            window.dispatchEvent(new CustomEvent("subscriptionChanged"));
                        }
                        // 🟢 purchaseSuccess 이벤트 발생 (TicketPlans 컴포넌트에서 사용자 등급 자동 업데이트용)
                        window.dispatchEvent(new CustomEvent("purchaseSuccess"));
                    }

                    setStatus("success");
                    // 🟢 코스 열람권 결제 시 해당 코스 페이지로 즉시 리다이렉트 (FREE 유저 즉시 진입)
                    const redirectCourseId = data.courseId ?? (courseIdParam ? Number(courseIdParam) : null);
                    const redirectPath = redirectCourseId ? `/courses/${redirectCourseId}` : "/personalized-home";
                    setSuccessRedirectPath(redirectPath);
                    const delay = redirectCourseId ? 800 : 3000;
                    setTimeout(() => router.replace(redirectPath), delay);
                } else {
                    setStatus("error");
                    // 더 자세한 에러 메시지 표시
                    const errorMsg = data.message || data.error || "서버에서 결제 승인을 거절했습니다.";
                    console.error("[결제 확인 실패] 상세 정보:", {
                        status: res.status,
                        error: data.error,
                        message: data.message,
                        details: data.details,
                        받은데이터: { paymentKey, orderId, amount, plan, userId },
                    });
                    setErrorMessage(errorMsg);
                }
            } catch (error) {
                console.error("Payment Confirmation Error:", error);
                setStatus("error");
                setErrorMessage("네트워크 연결에 문제가 발생했습니다.");
            }
        };

        confirmPayment();
    }, [searchParams, router]);

    return (
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center border border-gray-100">
            {/* 상태 1: 처리 중 */}
            {status === "processing" && (
                <>
                    <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mx-auto mb-6" />
                    <h2 className="text-2xl font-bold mb-2 text-gray-900">결제 확인 중...</h2>
                    <p className="text-gray-500 leading-relaxed">
                        잠시만 기다려주세요.
                        <br />
                        서버에서 결제를 안전하게 확인하고 있습니다.
                    </p>
                </>
            )}

            {/* 상태 2: 성공 */}
            {status === "success" && (
                <>
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-emerald-600">결제 성공! 🎉</h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">
                        상품 결제가 정상적으로 완료되었습니다.
                        <br />
                        <span className="font-semibold text-emerald-500 text-sm">
                            {successRedirectPath.startsWith("/courses/")
                                ? "곧 코스 페이지로 이동합니다."
                                : "3초 후 메인으로 자동 이동합니다."}
                        </span>
                    </p>
                    <button
                        onClick={() => router.replace(successRedirectPath)}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-200 active:scale-95"
                    >
                        지금 바로 이용하기
                    </button>
                </>
            )}

            {/* 상태 3: 실패 */}
            {status === "error" && (
                <>
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <XCircle className="w-10 h-10 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-red-500">결제 처리 실패</h2>
                    <p className="text-gray-600 mb-2">{errorMessage}</p>
                    <p className="text-xs text-gray-400 mb-8">오류가 반복되면 고객센터로 문의해주세요.</p>
                    <button
                        onClick={() => window.history.back()}
                        className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold transition-all active:scale-95"
                    >
                        뒤로 가기
                    </button>
                </>
            )}
        </div>
    );
}

// 메인 페이지 컴포넌트 (Suspense 래핑)
export default function PaymentSuccessPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
            <Suspense
                fallback={
                    <div className="text-center">
                        <Loader2 className="w-10 h-10 text-gray-300 animate-spin mx-auto mb-4" />
                        <p className="text-gray-400">결제 정보를 불러오는 중...</p>
                    </div>
                }
            >
                <PaymentSuccessContent />
            </Suspense>
        </div>
    );
}
