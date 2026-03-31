"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";

// 정기 결제 성공 처리 컴포넌트
function BillingSuccessContent() {
    const { t } = useLocale();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        const processBillingSuccess = async () => {
            // URL에서 파라미터 추출
            const customerKey = searchParams.get("customerKey");
            const authKey = searchParams.get("authKey");

            if (!customerKey || !authKey) {
                setStatus("error");
                setErrorMessage("필수 결제 정보가 누락되었습니다.");
                return;
            }

            try {
                // API 엔드포인트로 요청 전송
                const res = await fetch(
                    `/api/pay/success-billing?customerKey=${encodeURIComponent(
                        customerKey
                    )}&authKey=${encodeURIComponent(authKey)}`,
                    {
                        method: "GET",
                    }
                );

                const data = await res.json().catch(() => ({}));

                if (res.ok && data.success) {
                    // 🟢 구독권 결제 완료 이벤트 발생 (마이페이지 구독 정보 실시간 갱신용)
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("paymentSuccess"));
                        // 🟢 구독 변경 이벤트도 발생 (전역 구독 정보 갱신)
                        window.dispatchEvent(new CustomEvent("subscriptionChanged"));
                    }
                    
                    setStatus("success");
                    // 성공 시 3초 후 메인으로 이동
                    setTimeout(() => router.replace("/personalized-home"), 3000);
                } else {
                    setStatus("error");
                    setErrorMessage(data.message || data.error || t("payment.billingKeyFailed"));
                }
            } catch (error) {
                console.error("빌링키 발급 처리 오류:", error);
                setStatus("error");
                setErrorMessage(t("payment.networkError"));
            }
        };

        processBillingSuccess();
    }, [searchParams, router, t]);

    return (
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center border border-gray-100">
            {/* 상태 1: 처리 중 */}
            {status === "processing" && (
                <>
                    <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mx-auto mb-6" />
                    <h2 className="text-2xl font-bold mb-2 text-gray-900">{t("payment.billingCheckingTitle")}</h2>
                    <p className="text-gray-500 leading-relaxed">
                        {t("payment.billingWaitHint")}
                        <br />
                        {t("payment.billingCheckingCard")}
                    </p>
                </>
            )}

            {/* 상태 2: 성공 */}
            {status === "success" && (
                <>
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-emerald-600">{t("payment.membershipSuccessTitle")}</h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">
                        {t("payment.membershipSuccessDesc")}
                        <br />
                        <span className="font-semibold text-emerald-500 text-sm">{t("payment.redirectMainIn3s")}</span>
                    </p>
                    <button
                        onClick={() => router.replace("/personalized-home")}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-200 active:scale-95"
                    >
                        {t("payment.useNow")}
                    </button>
                </>
            )}

            {/* 상태 3: 실패 */}
            {status === "error" && (
                <>
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <XCircle className="w-10 h-10 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-red-500">{t("payment.cardRegisterFailedTitle")}</h2>
                    <p className="text-gray-600 mb-2">{errorMessage}</p>
                    <p className="text-xs text-gray-400 mb-8">{t("payment.contactSupport")}</p>
                    <button
                        onClick={() => window.history.back()}
                        className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold transition-all active:scale-95"
                    >
                        {t("payment.goBack")}
                    </button>
                </>
            )}
        </div>
    );
}

function BillingSuccessLoading() {
    const { t } = useLocale();
    return (
        <div className="text-center">
            <Loader2 className="w-10 h-10 text-gray-300 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">{t("payment.loading")}</p>
        </div>
    );
}

// 메인 페이지 컴포넌트 (Suspense 래핑)
export default function BillingSuccessPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
            <Suspense fallback={<BillingSuccessLoading />}>
                <BillingSuccessContent />
            </Suspense>
        </div>
    );
}
