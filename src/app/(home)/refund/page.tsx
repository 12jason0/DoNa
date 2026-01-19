"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// PaymentHistory 인터페이스 정의 (기존과 동일)
interface PaymentHistory {
    id: string;
    orderId: string;
    orderName: string;
    amount: number;
    status: string;
    approvedAt: string;
    paymentKey: string | null;
    method?: string | null; // 🟢 결제 방법 (토스페이먼츠: null/undefined, 인앱결제: "IN_APP")
}

export default function RefundPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refunding, setRefunding] = useState(false);
    const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
    const [success, setSuccess] = useState("");

    // 팝업(모달) 상태 관리
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<PaymentHistory | null>(null);
    
    // 🟢 환불 실패 모달 상태
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        fetchPaymentHistory();
    }, []);

    const fetchPaymentHistory = async () => {
        try {
            // 🟢 쿠키 기반 인증: authenticatedFetch 사용
            const { authenticatedFetch } = await import("@/lib/authClient");
            const data = await authenticatedFetch<{ payments?: PaymentHistory[] }>("/api/payments/history");
            if (data) {
                setPaymentHistory((data as any).payments || []);
            } else {
                router.push("/login");
            }
        } catch (err) {
            // 내역 불러오기 실패는 조용히 처리 (로딩만 종료)
            console.error("내역 불러오기 실패:", err);
        } finally {
            setLoading(false);
        }
    };

    // 환불 실행 함수
    const executeRefund = async () => {
        if (!selectedPayment) return;
        setRefunding(true);
        setIsModalOpen(false); // 모달 닫기

        try {
            // 🟢 쿠키 기반 인증: authenticatedFetch 사용
            const { authenticatedFetch } = await import("@/lib/authClient");
            const data = await authenticatedFetch("/api/ai-recommendation/refund", {
                method: "POST",
                body: JSON.stringify({
                    orderId: selectedPayment.orderId,
                    cancelReason: "사용자 변심(이탈 방지 모달 거침)",
                }),
            });

            if (data) {
                // 🟢 인앱결제 환불 안내
                if ((data as any).isInApp) {
                    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
                    const platform = isIOS ? "App Store" : "Google Play";
                    const platformUrl = isIOS 
                        ? "https://reportaproblem.apple.com/" 
                        : "https://play.google.com/store/account/orderhistory";
                    
                    setSuccess(
                        `${selectedPayment.orderName} 환불 처리가 완료되었습니다.\n\n` +
                        `실제 환불은 ${platform}에서 직접 신청해주세요.`
                    );
                    
                    // 플랫폼 환불 페이지로 이동하는 링크 제공
                    if (window.confirm(`${platform} 환불 페이지로 이동하시겠습니까?`)) {
                        window.open(platformUrl, "_blank");
                    }
                } else {
                setSuccess(`${selectedPayment.orderName} 환불이 완료되었습니다.`);
                }
                await fetchPaymentHistory();
            } else {
                // 🟢 환불 실패 시 모달로 에러 메시지 표시
                const errorMsg = (data as any)?.error || "환불 처리 중 오류가 발생했습니다.";
                setErrorMessage(errorMsg);
                setIsErrorModalOpen(true);
            }
        } catch (err: any) {
            // 🟢 에러 발생 시 모달로 표시
            const errorMsg = err?.message || (err as any)?.error || "서버와의 통신에 실패했습니다.";
            setErrorMessage(errorMsg);
            setIsErrorModalOpen(true);
        } finally {
            setRefunding(false);
        }
    };

    // 환불 가능 내역 찾기 (쿠폰 + 멤버십 통합, 인앱결제 포함)
    const refundablePayments = paymentHistory.filter(
        (p) =>
            p.status === "PAID" &&
            // 🟢 토스페이먼츠: paymentKey 필요, 인앱결제: method가 "IN_APP" (paymentKey 없을 수 있음)
            ((p.paymentKey && (!p.method || p.method !== "IN_APP")) || p.method === "IN_APP") &&
            (p.orderName.includes("쿠폰") || p.orderName.includes("멤버십") || p.orderName.includes("프리미엄") || p.orderName.includes("구독"))
    );

    if (loading) return <div className="min-h-screen flex items-center justify-center">⏳ 로딩 중...</div>;

    return (
        <div className="min-h-screen bg-[#F9FAFB] typography-smooth pb-20">
            {/* ✅ 수정된 이탈 방지 모달 (팝업) */}
            {isModalOpen && selectedPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-4xl p-8 max-w-[360px] w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="text-center">
                            <div className="text-6xl mb-5">🥺</div>
                            {/* 더 강력한 훅(Hook) 메시지 */}
                            <h3 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">
                                잠시만요!
                                <br />
                                혜택이 사라져요
                            </h3>
                            <p className="text-gray-600 text-[15px] leading-relaxed mb-8">
                                지금 환불하시면 <span className="text-green-600 font-bold">두나(DoNa)</span>가 준비한
                                {selectedPayment.orderName.includes("쿠폰")
                                    ? " 맞춤형 데이트 코스 추천"
                                    : " 프리미엄 멤버십의 특별한 혜택"}
                                을 더 이상 받으실 수 없어요. 정말 괜찮으신가요?
                            </p>

                            <div className="flex flex-col gap-3">
                                {/* 시그니처 그린 컬러 적용 및 문구 변경 */}
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold text-lg hover:bg-green-600 shadow-lg shadow-green-200/50 transition-all active:scale-[0.98]"
                                >
                                    네, 혜택 유지할게요! 💚
                                </button>
                                {/* 부정적 선택지 강조 */}
                                <button
                                    onClick={executeRefund}
                                    className="w-full py-3 text-gray-400 text-sm font-medium hover:text-gray-600 transition-colors underline-offset-4 hover:underline"
                                >
                                    혜택 포기하고 환불하기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 🟢 환불 실패 모달 */}
            {isErrorModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-4xl p-8 max-w-[360px] w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="text-center">
                            <div className="text-6xl mb-5">⚠️</div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">
                                환불이 불가능합니다
                            </h3>
                            <p className="text-gray-600 text-[15px] leading-relaxed mb-8 whitespace-pre-line">
                                {errorMessage}
                            </p>

                            <button
                                onClick={() => {
                                    setIsErrorModalOpen(false);
                                    setErrorMessage("");
                                }}
                                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-lg hover:bg-black transition-all active:scale-[0.98]"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className="max-w-xl mx-auto px-6 py-12">
                <Link
                    href="/mypage"
                    className="text-gray-400 flex items-center gap-1 mb-6 hover:text-gray-900 transition-all font-medium"
                >
                    ← 마이페이지
                </Link>

                <h1 className="text-3xl font-black text-gray-900 mb-2 italic">Refund Status</h1>
                <p className="text-gray-500 mb-10 text-sm">결제하신 내역을 확인하고 환불을 진행하세요.</p>

                {/* 메시지 영역 */}
                {success && (
                    <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl mb-6 text-sm font-medium border border-emerald-100 animate-in fade-in slide-in-from-top-2">
                        {success}
                    </div>
                )}

                {/* 환불 정책 안내 */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-6 text-sm">
                    <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span>📋</span> 환불 정책
                    </h3>
                    <ul className="space-y-2 text-gray-700 leading-relaxed">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span><strong className="text-gray-900">구독권:</strong> 구매 후 7일 이내에만 환불 가능합니다.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span><strong className="text-gray-900">구독 혜택 사용 시:</strong> BASIC/PREMIUM 구독 후 하나의 코스라도 사용하시면 환불이 불가능합니다.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span><strong className="text-gray-900">쿠폰:</strong> 이미 사용한 쿠폰이 있으면 환불이 불가능합니다.</span>
                        </li>
                    </ul>
                </div>

                {/* 환불 가능 카드 */}
                <h2 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-widest">Available to Refund</h2>
                {refundablePayments.length > 0 ? (
                    refundablePayments.map((p) => (
                        <div
                            key={p.id}
                            className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-4 hover:shadow-md transition-all"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    {/* 뱃지 컬러도 그린 계열로 변경 */}
                                    <span className="inline-block px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold mb-2 uppercase">
                                        {p.orderName.includes("쿠폰") ? "Coupon" : "Membership"}
                                    </span>
                                    <h3 className="text-xl font-bold text-gray-900 leading-tight">{p.orderName}</h3>
                                    <p className="text-gray-400 text-xs mt-1 font-medium">
                                        {new Date(p.approvedAt).toLocaleDateString()} 결제
                                    </p>
                                </div>
                                <p className="text-xl font-black text-gray-900">{p.amount.toLocaleString()}원</p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedPayment(p);
                                    setIsModalOpen(true);
                                }}
                                disabled={refunding}
                                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all disabled:bg-gray-200 active:scale-[0.98]"
                            >
                                {refunding ? "처리 중..." : "환불 신청하기"}
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="bg-gray-50 rounded-3xl p-10 text-center text-gray-400 text-sm italic border border-gray-100">
                        환불 가능한 최근 내역이 없습니다.
                    </div>
                )}

                {/* 전체 내역 (간소화) */}
                <div className="mt-12 opacity-50 hover:opacity-100 transition-opacity">
                    <h2 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-widest">Past History</h2>
                    <div className="space-y-2">
                        {paymentHistory.slice(0, 3).map((h) => (
                            <div
                                key={h.id}
                                className="flex justify-between text-xs py-3 border-b border-gray-100 font-medium"
                            >
                                <span className="text-gray-600">{h.orderName}</span>
                                <span className={h.status === "PAID" ? "text-green-500" : "text-gray-400"}>
                                    {h.status === "PAID" ? "결제완료" : "환불완료"}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 사업자 정보 */}
                <div className="mt-16 pt-10 border-t border-gray-100 text-[10px] text-gray-400 leading-loose font-medium">
                    <p>상호: (주)두나 (DoNa) | 대표: 오승용 | 사업자번호: 166-10-03081</p>
                    <p>통신판매: 제 2025-충남홍성-0193 호 | 주소: 충청남도 홍성군 홍북읍 신대로 33</p>
                    <p>문의: 12jason@donacourse.com</p>
                </div>
            </main>
        </div>
    );
}
