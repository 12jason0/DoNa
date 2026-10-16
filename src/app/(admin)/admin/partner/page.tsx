"use client";

import { useEffect, useState } from "react";
import { INQUIRY_STATUSES, INQUIRY_TYPES, type InquiryStatus, type InquiryType } from "@/lib/partnerInquiry";

type Inquiry = {
    id: number;
    brand_name: string;
    contact_name: string;
    contact: string;
    inquiry_type: InquiryType;
    message: string;
    status: InquiryStatus;
    created_at: string;
};

const STATUS_STYLE: Record<InquiryStatus, string> = {
    new: "bg-amber-100 text-amber-700",
    contacted: "bg-blue-100 text-blue-700",
    done: "bg-emerald-100 text-emerald-700",
};

export default function AdminPartnerPage() {
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/partner-inquiries", { credentials: "include" });
            const data = await res.json();
            setInquiries(Array.isArray(data?.inquiries) ? data.inquiries : []);
        } catch (e) {
            console.error("제휴 문의 로딩 실패:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // 텔레그램 알림의 ?id= 링크로 들어오면 그 문의를 펼침
        const id = Number(new URLSearchParams(window.location.search).get("id"));
        if (id) setExpandedId(id);
        load();
    }, []);

    const changeStatus = async (id: number, status: InquiryStatus) => {
        const res = await fetch("/api/admin/partner-inquiries", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status }),
        });
        if (!res.ok) return alert("상태 변경 실패");
        setInquiries((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
    };

    const newCount = inquiries.filter((q) => q.status === "new").length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">제휴 문의</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        /partner 폼으로 들어온 문의 · 최신순 · 신규 {newCount}건
                    </p>
                </div>
                <button
                    type="button"
                    onClick={load}
                    className="px-3 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50"
                >
                    새로고침
                </button>
            </div>

            {loading ? (
                <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
            ) : inquiries.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">아직 들어온 문의가 없어요.</div>
            ) : (
                <div className="space-y-3">
                    {inquiries.map((q) => {
                        const open = expandedId === q.id;
                        return (
                            <div
                                key={q.id}
                                className={`bg-white rounded-xl border ${q.status === "new" ? "border-amber-200 shadow-sm" : "border-gray-200"}`}
                            >
                                <div
                                    className="flex items-center gap-4 p-4 cursor-pointer"
                                    onClick={() => setExpandedId(open ? null : q.id)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-gray-900">{q.brand_name}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[q.status]}`}>
                                                {INQUIRY_STATUSES[q.status]}
                                            </span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                                {INQUIRY_TYPES[q.inquiry_type]}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-0.5 truncate">
                                            {q.contact_name} · {q.contact}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            #{q.id} · {new Date(q.created_at).toLocaleString("ko-KR")}
                                        </p>
                                    </div>
                                    <select
                                        value={q.status}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => changeStatus(q.id, e.target.value as InquiryStatus)}
                                        className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                                    >
                                        {(Object.keys(INQUIRY_STATUSES) as InquiryStatus[]).map((s) => (
                                            <option key={s} value={s}>
                                                {INQUIRY_STATUSES[s]}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
                                </div>
                                {open && (
                                    <div className="px-4 pb-4 pt-4 border-t border-gray-100">
                                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{q.message}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
