"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PaymentHistory {
    id: string;
    orderName: string;
    amount: number;
    status: string;
    approvedAt: string;
    paymentKey: string | null;
}

export default function RefundPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refunding, setRefunding] = useState(false);
    const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        let mounted = true;
        if (mounted) {
            fetchPaymentHistory();
        }
        return () => {
            mounted = false;
        };
    }, []);

    const fetchPaymentHistory = async () => {
        try {
            const token = localStorage.getItem("authToken");
            if (!token) {
                router.push("/login");
                return;
            }

            const response = await fetch("/api/payments/history", {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setPaymentHistory(data.payments || []);
            } else {
                setError("결제 내역을 불러올 수 없습니다.");
            }
        } catch (err) {
            setError("결제 내역을 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleRefund = async () => {
        setRefunding(true);
        setError("");
        setSuccess("");

        try {
            const token = localStorage.getItem("authToken");
            if (!token) {
                setError("로그인이 필요합니다.");
                return;
            }

            const response = await fetch("/api/ai-recommendation/refund", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setSuccess(
                    `환불이 완료되었습니다. 환불된 쿠폰: ${data.refundedCoupons}개, 남은 쿠폰: ${data.ticketsRemaining}개`
                );
                // 결제 내역 새로고침
                await fetchPaymentHistory();
            } else {
                setError(data.error || data.message || "환불 처리 중 오류가 발생했습니다.");
            }
        } catch (err: any) {
            setError(err.message || "환불 처리 중 오류가 발생했습니다.");
        } finally {
            setRefunding(false);
        }
    };

    // 환불 가능한 결제 내역 찾기 (쿠폰 결제 중 PAID 상태)
    const refundablePayment = paymentHistory.find(
        (p) => p.status === "PAID" && p.paymentKey && p.orderName.includes("쿠폰")
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4">⏳</div>
                    <p className="text-gray-600">로딩 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 typography-smooth">
            <main className="max-w-4xl mx-auto px-4 py-8 ">
                <div className="mb-6">
                    <Link
                        href="/mypage"
                        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="w-5 h-5"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                        마이페이지로 돌아가기
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">쿠폰 환불</h1>
                    <p className="text-gray-600">구매하신 쿠폰을 환불할 수 있습니다.</p>
                </div>

                {/* 환불 안내 */}
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded-lg">
                    <p className="text-sm text-blue-800">
                        <strong>⚠️ 환불 안내:</strong> 구매하신 쿠폰을 사용한 경우 환불이 불가능합니다. 환불하려면
                        구매한 쿠폰 개수만큼 보유하고 있어야 합니다.
                    </p>
                </div>

                {/* 에러 메시지 */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* 성공 메시지 */}
                {success && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg mb-6">
                        {success}
                    </div>
                )}

                {/* 환불 가능한 결제 내역 */}
                {refundablePayment ? (
                    <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8 mb-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">환불 가능한 결제 내역</h2>
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="font-semibold text-gray-900">{refundablePayment.orderName}</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        결제일: {new Date(refundablePayment.approvedAt).toLocaleDateString("ko-KR")}
                                    </p>
                                </div>
                                <p className="text-lg font-bold text-gray-900">
                                    {refundablePayment.amount.toLocaleString()}원
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleRefund}
                            disabled={refunding}
                            className="w-full py-4 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {refunding ? "환불 처리 중..." : "환불하기"}
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8 mb-6">
                        <div className="text-center py-8">
                            <div className="text-4xl mb-4">💳</div>
                            <p className="text-gray-600 font-medium mb-2">환불 가능한 쿠폰 결제 내역이 없습니다.</p>
                            <p className="text-sm text-gray-500">쿠폰을 구매하시면 여기에서 환불할 수 있습니다.</p>
                        </div>
                    </div>
                )}

                {/* 결제 내역 목록 */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">전체 결제 내역</h2>
                    {paymentHistory.length > 0 ? (
                        <div className="space-y-3">
                            {paymentHistory.map((payment) => (
                                <div
                                    key={payment.id}
                                    className="bg-gray-50 rounded-lg p-4 border border-gray-100 hover:border-gray-200 transition-colors"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-900">{payment.orderName}</p>
                                            <p className="text-sm text-gray-500 mt-1">
                                                {new Date(payment.approvedAt).toLocaleDateString("ko-KR", {
                                                    year: "numeric",
                                                    month: "long",
                                                    day: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-gray-900">
                                                {payment.amount.toLocaleString()}원
                                            </p>
                                            <span
                                                className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${
                                                    payment.status === "PAID"
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : payment.status === "CANCELLED"
                                                        ? "bg-gray-100 text-gray-600"
                                                        : "bg-yellow-100 text-yellow-700"
                                                }`}
                                            >
                                                {payment.status === "PAID"
                                                    ? "결제 완료"
                                                    : payment.status === "CANCELLED"
                                                    ? "환불 완료"
                                                    : payment.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">결제 내역이 없습니다.</div>
                    )}
                </div>

                {/* 환불 정책 링크 */}
                <div className="mt-6 text-center">
                    <Link href="/terms" className="text-sm text-gray-500 hover:text-gray-700 underline">
                        이용약관 및 환불 정책 보기
                    </Link>
                </div>

                {/* 사업자 정보 */}
                <div className="mt-8 bg-white rounded-xl border border-gray-100 p-6 md:p-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">사업자 정보</h2>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <p className="text-sm text-gray-700">
                            <strong className="text-gray-900">상호:</strong> (주)두나 (DoNa)
                        </p>
                        <p className="text-sm text-gray-700">
                            <strong className="text-gray-900">대표자명:</strong> 오승용
                        </p>
                        <p className="text-sm text-gray-700">
                            <strong className="text-gray-900">사업자등록번호:</strong> 166-10-03081
                        </p>
                        <p className="text-sm text-gray-700">
                            <strong className="text-gray-900">통신판매업 신고번호:</strong> 제 2025-충남홍성-0193 호
                        </p>
                        <p className="text-sm text-gray-700">
                            <strong className="text-gray-900">주소:</strong> 충청남도 홍성군 홍북읍 신대로 33
                        </p>
                        <p className="text-sm text-gray-700">
                            <strong className="text-gray-900">고객센터:</strong> 12jason@donacouse.com
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
