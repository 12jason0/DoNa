"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface WithdrawalLog {
    id: number;
    userId: number;
    reason: string | null;
    createdAt: string;
}

interface ReasonCount {
    reason: string;
    count: number;
}

interface Data {
    total: number;
    logs: WithdrawalLog[];
    reasonCounts: ReasonCount[];
}

export default function WithdrawalLogsPage() {
    const [data, setData] = useState<Data | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch("/api/admin/withdrawal-logs", { credentials: "include" })
            .then((r) => r.json())
            .then(setData)
            .catch(() => setError("데이터를 불러오지 못했습니다."))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                    <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← 어드민 홈</Link>
                    <h1 className="text-2xl font-bold text-gray-900">회원 탈퇴 사유</h1>
                </div>

                {loading && <p className="text-gray-500">불러오는 중...</p>}
                {error && <p className="text-red-500">{error}</p>}

                {data && (
                    <>
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
                            <p className="text-sm text-gray-500 mb-1">전체 탈퇴</p>
                            <p className="text-3xl font-bold text-gray-900">{data.total}명</p>
                        </div>

                        {/* 사유별 집계 */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
                            <h2 className="text-base font-semibold text-gray-800 mb-4">사유별 집계</h2>
                            <div className="space-y-3">
                                {data.reasonCounts.map(({ reason, count }) => {
                                    const pct = data.total > 0 ? Math.round((count / data.total) * 100) : 0;
                                    return (
                                        <div key={reason}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-gray-700 truncate max-w-xs">{reason}</span>
                                                <span className="text-gray-500 ml-2 shrink-0">{count}명 ({pct}%)</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2">
                                                <div
                                                    className="bg-emerald-500 h-2 rounded-full transition-all"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 상세 로그 */}
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="p-5 border-b border-gray-100">
                                <h2 className="text-base font-semibold text-gray-800">상세 로그 (최근 500건)</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500 text-xs">
                                        <tr>
                                            <th className="text-left px-4 py-3">날짜</th>
                                            <th className="text-left px-4 py-3">유저 ID</th>
                                            <th className="text-left px-4 py-3">탈퇴 사유</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {data.logs.map((log) => (
                                            <tr key={log.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                                    {new Date(log.createdAt).toLocaleDateString("ko-KR", {
                                                        year: "numeric", month: "2-digit", day: "2-digit",
                                                    })}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">{log.userId}</td>
                                                <td className="px-4 py-3 text-gray-700">
                                                    {log.reason ?? <span className="text-gray-400">미입력</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
