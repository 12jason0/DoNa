"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

export default function PaymentSuccessPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        const confirmPayment = async () => {
            // URL 쿼리 파라미터에서 정보 가져오기
            const paymentKey = searchParams.get("paymentKey");
            const orderId = searchParams.get("orderId");
            const amount = searchParams.get("amount");
            const plan = searchParams.get("plan"); // TicketPlans에서 넘겨준 plan ID

            // 유저 정보 가져오기
            const userStr = localStorage.getItem("user");
            const user = userStr ? JSON.parse(userStr) : null;

            if (!paymentKey || !orderId || !amount || !plan || !user) {
                setStatus("error");
                setErrorMessage("결제 정보가 부족합니다.");
                return;
            }

            try {
                // 🔥 서버에 결제 승인 요청 (우리가 만든 API 호출)
                const res = await fetch("/api/payments/confirm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        paymentKey,
                        orderId,
                        amount: Number(amount),
                        plan,
                        userId: user.id, // 유저 ID 필수!
                    }),
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    setStatus("success");
                    // 3초 뒤 메인으로 이동 (또는 원하는 곳으로)
                    setTimeout(() => router.replace("/personalized-home"), 3000);
                } else {
                    setStatus("error");
                    setErrorMessage(data.error || "결제 승인 중 오류가 발생했습니다.");
                }
            } catch (error) {
                console.error(error);
                setStatus("error");
                setErrorMessage("네트워크 오류가 발생했습니다.");
            }
        };

        // 페이지 로드 시 실행
        confirmPayment();
    }, [searchParams, router]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
            <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center border border-gray-100">
                {/* 1. 처리 중일 때 */}
                {status === "processing" && (
                    <>
                        <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mx-auto mb-6" />
                        <h2 className="text-2xl font-bold mb-2 text-gray-900">결제 확인 중...</h2>
                        <p className="text-gray-500">
                            잠시만 기다려주세요.
                            <br />
                            서버와 통신하고 있습니다.
                        </p>
                    </>
                )}

                {/* 2. 성공했을 때 */}
                {status === "success" && (
                    <>
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-10 h-10 text-emerald-600" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2 text-emerald-600">결제 성공! 🎉</h2>
                        <p className="text-gray-600 mb-8">
                            멤버십 혜택이 즉시 적용되었습니다.
                            <br />
                            <span className="text-sm text-gray-400">잠시 후 홈으로 이동합니다.</span>
                        </p>
                        <button
                            onClick={() => router.replace("/personalized-home")}
                            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition-colors shadow-lg shadow-emerald-200"
                        >
                            지금 바로 혜택 쓰기
                        </button>
                    </>
                )}

                {/* 3. 실패했을 때 */}
                {status === "error" && (
                    <>
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <XCircle className="w-10 h-10 text-red-500" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2 text-red-500">결제 실패 😢</h2>
                        <p className="text-gray-600 mb-2">{errorMessage}</p>
                        <p className="text-xs text-gray-400 mb-8">문제가 지속되면 고객센터로 문의해주세요.</p>
                        <button
                            onClick={() => router.back()}
                            className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold transition-colors"
                        >
                            다시 시도하기
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
