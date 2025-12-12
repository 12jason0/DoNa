"use client";

import React from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function ClosedPage() {
    const params = useSearchParams();
    const router = useRouter();
    const reason = params.get("reason");

    const label = reason === "forest" ? "숲" : reason === "garden" ? "정원" : "해당 공간";

    return (
        <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "linear-gradient(135deg, #f7faf7 0%, #f9fbf7 40%, #fdf9f6 100%)" }}>
            <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 text-center">
                <div className="text-2xl font-bold text-neutral-900 mb-2">{label} 입장이 현재 제한되어 있어요</div>
                <p className="text-neutral-600 mb-6">잠시 후 다시 시도해 주세요.</p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-medium"
                    >
                        이전으로
                    </button>
                    <button
                        onClick={() => router.push("/")}
                        className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-medium"
                    >
                        홈으로 이동
                    </button>
                </div>
            </div>
        </div>
    );
}


