"use client";

import { useState, useEffect } from "react";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { X, ShoppingBag, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { fetchSession } from "@/lib/authClient";

// 🟢 [두나샵]: 실물 상품 목록 (토스페이먼츠 결제)
const SHOP_PRODUCTS = [
    {
        id: "kit_basic",
        name: "두나 실물 키트 베이직",
        price: 19900,
        description: "데이트 코스 실물 키트",
        image: "/images/shop/kit-basic.jpg", // TODO: 실제 이미지 경로로 변경
    },
    // TODO: 추가 상품들
];

export default function ShopPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<typeof SHOP_PRODUCTS[0] | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            const session = await fetchSession();
            setIsAuthenticated(!!session.authenticated);
        };
        checkAuth();
    }, []);

    const handlePurchase = async (product: typeof SHOP_PRODUCTS[0]) => {
        if (!isAuthenticated) {
            alert("로그인이 필요합니다.");
            router.push("/login?next=/shop");
            return;
        }

        setLoading(true);

        try {
            const session = await fetchSession();
            if (!session.authenticated || !session.user) {
                alert("로그인이 필요합니다.");
                setLoading(false);
                return;
            }

            const userId = session.user.id;
            const customerKey = `user_${userId}`;

            // 🟢 토스페이먼츠 결제 (웹 전용)
            const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY_GENERAL || "live_ck_ma60RZblrq7ARpNEZDe3wzYWBn1";
            const tossPayments = await loadTossPayments(clientKey);

            const orderId = `shop_${product.id}_${Date.now()}`;
            const payment = tossPayments.payment({ customerKey });

            await payment.requestPayment({
                method: "CARD",
                amount: {
                    currency: "KRW",
                    value: product.price,
                },
                orderId: orderId,
                orderName: product.name,
                successUrl: `${window.location.origin}/shop/success?orderId=${orderId}&productId=${product.id}`,
                failUrl: `${window.location.origin}/shop/fail`,
            });
        } catch (error: any) {
            console.error("[두나샵 결제 오류]:", error);
            const errorMessage = error?.message || "결제 처리 중 오류가 발생했습니다.";
            alert(errorMessage);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-[#0f1710]">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* 헤더 */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <ShoppingBag className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">두나샵</h1>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">데이트를 더 특별하게 만드는 실물 상품</p>
                </div>

                {/* 상품 목록 */}
                {SHOP_PRODUCTS.length === 0 ? (
                    <div className="text-center py-20">
                        <Package className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-700 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">준비 중인 상품입니다.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {SHOP_PRODUCTS.map((product) => (
                            <div
                                key={product.id}
                                className="border-2 border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-[#1a241b] hover:border-emerald-500 dark:hover:border-emerald-600 transition-all"
                            >
                                {/* 상품 이미지 */}
                                <div className="relative w-full aspect-square bg-gray-100 dark:bg-gray-800">
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Package className="w-20 h-20 text-gray-300 dark:text-gray-700" />
                                    </div>
                                </div>

                                {/* 상품 정보 */}
                                <div className="p-6">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                        {product.name}
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                                        {product.description}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-black text-gray-900 dark:text-white">
                                            {product.price.toLocaleString()}원
                                        </span>
                                        <button
                                            onClick={() => handlePurchase(product)}
                                            disabled={loading}
                                            className="px-6 py-3 bg-gray-900 dark:bg-gray-800 text-white font-bold rounded-xl hover:bg-black dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                                        >
                                            {loading ? "처리 중..." : "구매하기"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
