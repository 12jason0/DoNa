"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

// 정기 결제 성공 처리 컴포넌트
function BillingSuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        const processBillingSuccess = async () => {
            // URL에서 파라미터 추출
            // 토스페이먼츠가 리다이렉트할 때 authKey를 쿼리 파라미터로 보내줍니다
            const customerKey = searchParams.get("customerKey") || 
                               (typeof window !== "undefined" ? sessionStorage.getItem('pendingPaymentCustomerKey') : null);
            const authKey = searchParams.get("authKey");
            const planId = searchParams.get("planId") || 
                          (typeof window !== "undefined" ? sessionStorage.getItem('pendingPaymentPlan') : null);

            // sessionStorage에서 정보 가져온 경우 정리
            if (typeof window !== "undefined") {
                if (sessionStorage.getItem('pendingPaymentPlan')) {
                    sessionStorage.removeItem('pendingPaymentPlan');
                }
                if (sessionStorage.getItem('pendingPaymentCustomerKey')) {
                    sessionStorage.removeItem('pendingPaymentCustomerKey');
                }
            }

            if (!customerKey || !authKey || !planId) {
                setStatus("error");
                setErrorMessage("필수 결제 정보가 누락되었습니다.");
                return;
            }

            try {
                // API 엔드포인트로 요청 전송 (planId 포함)
                const res = await fetch(
                    `/api/pay/success-billing?customerKey=${encodeURIComponent(
                        customerKey
                    )}&authKey=${encodeURIComponent(authKey)}&planId=${encodeURIComponent(planId)}`,
                    {
                        method: "GET",
                    }
                );

                const data = await res.json().catch(() => ({}));

                if (res.ok && data.success) {
                    setStatus("success");
                    // 성공 시 3초 후 메인으로 이동
                    setTimeout(() => router.replace("/personalized-home"), 3000);
                } else {
                    setStatus("error");
                    setErrorMessage(data.message || data.error || "빌링키 발급에 실패했습니다.");
                }
            } catch (error) {
                console.error("빌링키 발급 처리 오류:", error);
                setStatus("error");
                setErrorMessage("네트워크 연결에 문제가 발생했습니다.");
            }
        };

        processBillingSuccess();
    }, [searchParams, router]);

    return (
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center border border-gray-100">
            {/* 상태 1: 처리 중 */}
            {status === "processing" && (
                <>
                    <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mx-auto mb-6" />
                    <h2 className="text-2xl font-bold mb-2 text-gray-900">카드 등록 확인 중...</h2>
                    <p className="text-gray-500 leading-relaxed">
                        잠시만 기다려주세요.
                        <br />
                        서버에서 카드 정보를 안전하게 확인하고 있습니다.
                    </p>
                </>
            )}

            {/* 상태 2: 성공 */}
            {status === "success" && (
                <>
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-emerald-600">결제 완료! 🎉</h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">
                        멤버십 구독이 성공적으로 완료되었습니다.
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
                    <h2 className="text-2xl font-bold mb-2 text-red-500">카드 등록 실패</h2>
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
export default function BillingSuccessPage() {
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
                <BillingSuccessContent />
            </Suspense>
        </div>
    );
}
