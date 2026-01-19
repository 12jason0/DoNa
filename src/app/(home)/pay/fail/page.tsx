"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

// 결제 실패 처리 로직 컴포넌트
function PaymentFailContent() {
    const searchParams = useSearchParams();
    
    // URL 파라미터에서 정보 추출
    const code = searchParams.get("code");
    const message = searchParams.get("message");
    const orderId = searchParams.get("orderId");
    
    // 메시지 디코딩 (URL 인코딩된 경우)
    const decodedMessage = message ? decodeURIComponent(message) : null;
    
    // 코드에 따른 메시지 결정
    const getTitle = () => {
        if (code === "PAY_PROCESS_CANCELED") {
            return "결제 취소";
        }
        return "결제 실패";
    };
    
    const getDescription = () => {
        if (decodedMessage) {
            return decodedMessage;
        }
        if (code === "PAY_PROCESS_CANCELED") {
            return "결제가 취소되었습니다.";
        }
        return "결제가 실패했어요. 다시 시도해 주세요.";
    };
    
    return (
        <div className="w-full max-w-md p-8 rounded-2xl border shadow-sm text-center bg-white">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-500" />
            </div>
            
            <h1 className="text-2xl font-bold mb-2 text-gray-900">{getTitle()}</h1>
            <p className="text-gray-700 mb-2">{getDescription()}</p>
            
            {orderId && (
                <p className="text-xs text-gray-400 mb-6">주문번호: {orderId}</p>
            )}
            
            <div className="flex flex-col gap-3">
                <Link 
                    href="/personalized-home" 
                    className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all active:scale-95"
                >
                    홈으로 돌아가기
                </Link>
                <button
                    onClick={() => window.history.back()}
                    className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all active:scale-95"
                >
                    뒤로 가기
                </button>
            </div>
        </div>
    );
}

// 메인 페이지 컴포넌트 (Suspense 래핑)
export default function PayFailPage() {
    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <Suspense
                fallback={
                    <div className="text-center">
                        <Loader2 className="w-10 h-10 text-gray-300 animate-spin mx-auto mb-4" />
                        <p className="text-gray-400">결제 정보를 불러오는 중...</p>
                    </div>
                }
            >
                <PaymentFailContent />
            </Suspense>
        </main>
    );
}
