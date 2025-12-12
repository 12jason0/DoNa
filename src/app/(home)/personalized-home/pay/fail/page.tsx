"use client";

import Link from "next/link";

export default function PayFailPage() {
    return (
        <main className="min-h-screen flex items-center justify-center bg-white text-black">
            <div className="p-8 rounded-2xl border shadow-sm text-center">
                <h1 className="text-2xl font-bold mb-2">결제 실패</h1>
                <p className="text-gray-700 mb-4">결제가 실패했어요. 다시 시도해 주세요.</p>
                <Link href="/personalized-home" className="px-4 py-2 bg-black text-white rounded-lg">
                    돌아가기
                </Link>
            </div>
        </main>
    );
}
