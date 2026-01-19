"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface RefundRequest {
    id: number;
    paymentId: string;
    userId: number;
    orderId: string;
    orderName: string;
    amount: number;
    cancelReason: string | null;
    status: "PENDING" | "APPROVED" | "REJECTED";
    adminNote: string | null;
    requestedAt: string;
    processedAt: string | null;
    processedBy: number | null;
    user: {
        id: number;
        email: string | null;
        username: string;
    };
    payment: {
        id: string;
        paymentKey: string | null;
        method: string | null;
        approvedAt: string | null;
    };
}

export default function AdminRefundsPage() {
    const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
    const [selectedRequest, setSelectedRequest] = useState<RefundRequest | null>(null);
    const [adminNote, setAdminNote] = useState("");
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchRefundRequests();
    }, [filter]);

    const fetchRefundRequests = async () => {
        try {
            setLoading(true);
            const statusParam = filter !== "ALL" ? `?status=${filter}` : "";
            const res = await fetch(`/api/admin/refund-requests${statusParam}`, {
                credentials: "include",
            });

            if (!res.ok) {
                throw new Error("환불 요청 목록을 불러올 수 없습니다.");
            }

            const data = await res.json();
            setRefundRequests(data.refundRequests || []);
        } catch (err) {
            console.error("환불 요청 목록 로딩 오류:", err);
            alert("환불 요청 목록을 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleProcessRefund = async (request: RefundRequest, action: "APPROVE" | "REJECT") => {
        if (!confirm(`환불 요청을 ${action === "APPROVE" ? "승인" : "거부"}하시겠습니까?`)) {
            return;
        }

        setProcessing(true);
        try {
            const res = await fetch(`/api/admin/refund-requests/${request.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    action,
                    adminNote: adminNote || (action === "APPROVE" ? "관리자 승인" : "관리자 거부"),
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "환불 처리 중 오류가 발생했습니다.");
            }

            alert(`환불 요청이 ${action === "APPROVE" ? "승인" : "거부"}되었습니다.`);
            setSelectedRequest(null);
            setAdminNote("");
            await fetchRefundRequests();
        } catch (err: any) {
            alert(err.message || "환불 처리 중 오류가 발생했습니다.");
        } finally {
            setProcessing(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            PENDING: "bg-yellow-100 text-yellow-800",
            APPROVED: "bg-green-100 text-green-800",
            REJECTED: "bg-red-100 text-red-800",
        };
        const labels = {
            PENDING: "대기중",
            APPROVED: "승인됨",
            REJECTED: "거부됨",
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${styles[status as keyof typeof styles]}`}>
                {labels[status as keyof typeof labels]}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900">환불 관리</h1>
                <div className="flex gap-2">
                    {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg font-medium transition ${
                                filter === f
                                    ? "bg-green-600 text-white"
                                    : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                            }`}
                        >
                            {f === "ALL" ? "전체" : f === "PENDING" ? "대기중" : f === "APPROVED" ? "승인됨" : "거부됨"}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">로딩 중...</div>
            ) : refundRequests.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center text-gray-500 border border-gray-200">
                    환불 요청이 없습니다.
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        요청일
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        사용자
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        상품명
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        금액
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        사유
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        상태
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        작업
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {refundRequests.map((request) => (
                                    <tr key={request.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {new Date(request.requestedAt).toLocaleString("ko-KR")}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <div>
                                                <div className="font-medium">{request.user.username}</div>
                                                <div className="text-gray-500 text-xs">{request.user.email}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {request.orderName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {request.amount.toLocaleString()}원
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {request.cancelReason || "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(request.status)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {request.status === "PENDING" && (
                                                <button
                                                    onClick={() => setSelectedRequest(request)}
                                                    className="text-green-600 hover:text-green-800 font-medium"
                                                >
                                                    처리
                                                </button>
                                            )}
                                            {request.status !== "PENDING" && request.adminNote && (
                                                <div className="text-xs text-gray-500">{request.adminNote}</div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 처리 모달 */}
            {selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl">
                        <h3 className="text-2xl font-bold text-gray-900 mb-4">환불 처리</h3>
                        <div className="space-y-4 mb-6">
                            <div>
                                <div className="text-sm text-gray-500">사용자</div>
                                <div className="font-medium">{selectedRequest.user.username} ({selectedRequest.user.email})</div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-500">상품명</div>
                                <div className="font-medium">{selectedRequest.orderName}</div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-500">금액</div>
                                <div className="font-medium">{selectedRequest.amount.toLocaleString()}원</div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-500">환불 사유</div>
                                <div className="text-gray-700">{selectedRequest.cancelReason || "-"}</div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">관리자 메모</label>
                                <textarea
                                    value={adminNote}
                                    onChange={(e) => setAdminNote(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    rows={3}
                                    placeholder="승인/거부 사유를 입력하세요"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleProcessRefund(selectedRequest, "APPROVE")}
                                disabled={processing}
                                className="flex-1 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-300 transition"
                            >
                                {processing ? "처리 중..." : "승인"}
                            </button>
                            <button
                                onClick={() => handleProcessRefund(selectedRequest, "REJECT")}
                                disabled={processing}
                                className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:bg-gray-300 transition"
                            >
                                {processing ? "처리 중..." : "거부"}
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedRequest(null);
                                    setAdminNote("");
                                }}
                                disabled={processing}
                                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:bg-gray-100 transition"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
