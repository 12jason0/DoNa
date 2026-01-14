"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Loader2 } from "lucide-react";

function ShopSuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<"processing" | "success">("processing");

    useEffect(() => {
        const processPayment = async () => {
            const paymentKey = searchParams.get("paymentKey");
            const orderId = searchParams.get("orderId");
            const amount = searchParams.get("amount");
            const productId = searchParams.get("productId");

            if (!paymentKey || !orderId || !amount) {
                router.push("/shop");
                return;
            }

            // TODO: 결제 확인 API 호출
            // const response = await fetch("/api/payments/confirm", {
            //     method: "POST",
            //     headers: { "Content-Type": "application/json" },
            //     body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
            // });

            setStatus("success");
        };

        processPayment();
    }, [searchParams, router]);

    if (status === "processing") {
        return (
            <div className="min-h-screen bg-white dark:bg-[#0f1710] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 mx-auto mb-4 text-emerald-600 dark:text-emerald-400 animate-spin" />
                    <h2 className="text-2xl font-bold mb-2 text-gray-900">결제 확인 중...</h2>
                    <p className="text-gray-500 dark:text-gray-400">잠시만 기다려 주세요.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-[#0f1710] flex items-center justify-center">
            <div className="text-center max-w-md mx-auto px-4">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-2xl font-bold mb-2 text-emerald-600">구매 완료! 🎉</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">상품 구매가 정상적으로 완료되었습니다.</p>
                <button
                    onClick={() => router.push("/shop")}
                    className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors"
                >
                    쇼핑 계속하기
                </button>
            </div>
        </div>
    );
}

export default function ShopSuccessPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ShopSuccessContent />
        </Suspense>
    );
}
