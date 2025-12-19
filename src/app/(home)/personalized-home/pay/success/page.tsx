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
            const orderId = searchParams.get("orderId");
            const amount = searchParams.get("amount");
            const plan = searchParams.get("plan"); // ✅ 중요: 어떤 상품을 샀는지 알 수 있는 키값

            // ============================================
            // 2단계: 사용자 인증 정보 확인
            // ============================================
            const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
            const user = userStr ? JSON.parse(userStr) : null;

            // ============================================
            // 3단계: 필수 정보 검증
            // ============================================
            if (!paymentKey || !orderId || !amount || !plan || !user) {
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
                // 3) 사용자에게 쿠폰/구독 혜택 지급
                const res = await fetch("/api/payments/confirm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        paymentKey, // 토스가 준 결제 키
                        orderId, // 우리가 생성한 주문 ID
                        amount: Number(amount), // 결제 금액
                        plan, // ✅ 어떤 상품인지 (sub_premium, ticket_light 등)
                        userId: user.id, // 누가 샀는지
                    }),
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    setStatus("success");
                    // 성공 시 3초 후 이동
                    setTimeout(() => router.replace("/personalized-home"), 3000);
                } else {
                    setStatus("error");
                    // 더 자세한 에러 메시지 표시
                    const errorMsg = data.message || data.error || "서버에서 결제 승인을 거절했습니다.";
                    console.error("[결제 확인 실패] 상세 정보:", {
                        status: res.status,
                        error: data.error,
                        message: data.message,
                        details: data.details,
                        받은데이터: { paymentKey, orderId, amount, plan, userId: user.id },
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
                        <span className="font-semibold text-emerald-500 text-sm">3초 후 메인으로 자동 이동합니다.</span>
                    </p>
                    <button
                        onClick={() => router.replace("/personalized-home")}
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
                        onClick={() => router.back()}
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
