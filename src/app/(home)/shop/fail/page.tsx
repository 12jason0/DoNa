"use client";

import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";

export default function ShopFailPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-white dark:bg-[#0f1710] flex items-center justify-center">
            <div className="text-center max-w-md mx-auto px-4">
                <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">결제 실패</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">결제가 취소되었습니다. 다시 시도해 주세요.</p>
                <button
                    onClick={() => router.push("/shop")}
                    className="px-6 py-3 bg-gray-900 dark:bg-gray-800 text-white font-bold rounded-xl hover:bg-black dark:hover:bg-gray-700 transition-colors"
                >
                    쇼핑 계속하기
                </button>
            </div>
        </div>
    );
}
