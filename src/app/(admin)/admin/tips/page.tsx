"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TIP_STATUS_LABEL } from "@/types/tip";

type PriceRow = {
    id: number;
    name: string;
    address: string | null;
    instagram_handle: string | null;
    tips: { id: number; content: string; approved: boolean; unverified: { value: string; source_id: number }[] }[];
};
type Row = {
    id: number;
    name: string;
    address: string | null;
    latitude: number | null;
    tip_status: string;
    updated_at: string;
    candidate: number;
    official: number;
    needsCheck: number;
};

export default function AdminTipsPage() {
    const [status, setStatus] = useState("review");
    const [rows, setRows] = useState<Row[] | null>(null);
    const [priceRows, setPriceRows] = useState<PriceRow[] | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        setRows(null);
        setPriceRows(null);
        setError("");
        fetch(`/api/admin/tips${status ? `?status=${status}` : ""}`, { credentials: "include", cache: "no-store" })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((d) => (status === "price" ? setPriceRows(d) : setRows(d)))
            .catch((e) => setError(`불러오지 못했어요 (${e.message})`));
    }, [status]);

    return (
        <div className="p-6 max-w-5xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">팁 검수</h1>
                <Link href="/admin/tips/stats" className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-200 text-gray-700">
                    📊 통계
                </Link>
            </div>
            <div className="flex gap-2 mb-4 flex-wrap">
                {[["", "전체"], ...Object.entries(TIP_STATUS_LABEL), ["price", "💰 가격 확인 필요"]].map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => setStatus(key)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                            status === key ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-700"
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {error && <p className="text-red-600">{error}</p>}
            {!rows && !priceRows && !error && <p className="text-gray-500">불러오는 중...</p>}
            {priceRows && (
                <div className="space-y-3">
                    <p className="text-sm text-gray-500">근거 글에서 가격을 못 찾은 활동 팁이에요. 사장님께 DM으로 물어보고, 팁 문장에 가격을 넣으면 목록에서 빠져요.</p>
                    {priceRows.length === 0 && <p className="text-gray-500">가격 확인이 필요한 팁이 없어요</p>}
                    {priceRows.map((p) => (
                        <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                            <Link href={`/admin/tips/${p.id}`} className="font-semibold text-green-700 hover:underline">
                                {p.name}
                            </Link>
                            <span className="ml-2 text-xs text-gray-500">{p.instagram_handle ? `@${p.instagram_handle}` : "인스타 계정 없음"}</span>
                            <ul className="mt-2 text-sm space-y-1">
                                {p.tips.map((t) => (
                                    <li key={t.id}>
                                        · {t.content}
                                        {t.approved && <span className="ml-1 text-xs text-green-700">(승인됨)</span>}
                                        {t.unverified.length > 0 && (
                                            <span className="ml-1 text-xs text-gray-400">근거에서 못 찾은 가격: {t.unverified.map((u) => `${u.value} #${u.source_id}`).join(", ")}</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
            {rows && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <tbody>
                            {rows.length === 0 && (
                                <tr>
                                    <td className="p-4 text-gray-500">장소가 없어요</td>
                                </tr>
                            )}
                            {rows.map((r) => (
                                <tr key={r.id} className="border-t border-gray-100 first:border-t-0 hover:bg-gray-50">
                                    <td className="p-3">
                                        <Link href={`/admin/tips/${r.id}`} className="font-semibold text-green-700 hover:underline">
                                            {r.name}
                                        </Link>
                                        {!r.address && r.latitude == null && (
                                            <span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">위치 없음</span>
                                        )}
                                        <div className="text-xs text-gray-500">{r.address}</div>
                                    </td>
                                    <td className="p-3">{TIP_STATUS_LABEL[r.tip_status] ?? r.tip_status}</td>
                                    <td className="p-3 text-right">
                                        후보 {r.candidate} · 가게 공식 {r.official} · 확인 필요 {r.needsCheck}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
