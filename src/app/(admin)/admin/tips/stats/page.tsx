"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PlaceRow = {
    placeId: number;
    name: string;
    runs: number;
    autoSeconds: number | null;
    sources: number | null;
    filtered: number | null;
    candidate: number | null;
    official: number | null;
    needsCheck: number | null;
    reviewMinutes: number | null;
    approvedAsIs: number;
    approvedEdited: number;
    rejected: number;
    direct: number;
    inputTokens: number;
    outputTokens: number;
    won: number;
};
type Stats = {
    usdKrw: number;
    placesProcessed: number;
    autoSeconds: { avg: number | null; min: number | null; max: number | null };
    reviewMinutes: { avg: number | null; median: number | null; count: number };
    perPlace: { sources: number | null; irrelevantRate: number | null; candidate: number | null; official: number | null; needsCheck: number | null };
    outcomes: { asIs: number; edited: number; rejected: number; rates: { asIs: number; edited: number; rejected: number } | null };
    directTips: number;
    claude: { inputTokens: number; outputTokens: number; won: number; wonPerPlace: number | null };
    places: PlaceRow[];
};

const n = (v: number | null, digits = 1) => (v == null ? "-" : Number(v.toFixed(digits)).toLocaleString("ko-KR"));
const pct = (v: number | null | undefined) => (v == null ? "-" : `${Math.round(v * 100)}%`);

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
            {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
        </div>
    );
}

const CSV_COLUMNS: [keyof PlaceRow, string][] = [
    ["placeId", "장소 ID"],
    ["name", "장소"],
    ["runs", "자동 처리 횟수"],
    ["autoSeconds", "자동 처리(초)"],
    ["sources", "관련 자료"],
    ["filtered", "관련 없음"],
    ["candidate", "후보"],
    ["official", "가게 공식"],
    ["needsCheck", "확인 필요"],
    ["reviewMinutes", "사람 검수(분)"],
    ["approvedAsIs", "그대로 승인"],
    ["approvedEdited", "수정 후 승인"],
    ["rejected", "삭제"],
    ["direct", "직접 추가"],
    ["inputTokens", "입력 토큰"],
    ["outputTokens", "출력 토큰"],
    ["won", "Claude 비용(원)"],
];

function downloadCsv(rows: PlaceRow[], days: number | null) {
    const cell = (v: unknown) => {
        const s = v == null ? "" : typeof v === "number" ? String(Math.round(v * 10) / 10) : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [CSV_COLUMNS.map(([, h]) => h).join(","), ...rows.map((r) => CSV_COLUMNS.map(([k]) => cell(r[k])).join(","))].join("\n");
    // 엑셀에서 한글이 깨지지 않게 BOM 추가
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `tip-stats-${days ? `${days}d` : "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function AdminTipStatsPage() {
    const [days, setDays] = useState<number | null>(null);
    const [data, setData] = useState<Stats | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        setData(null);
        setError("");
        fetch(`/api/admin/tips/stats${days ? `?days=${days}` : ""}`, { credentials: "include", cache: "no-store" })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then(setData)
            .catch((e) => setError(`불러오지 못했어요 (${e.message})`));
    }, [days]);

    return (
        <div className="p-6 max-w-6xl">
            <Link href="/admin/tips" className="text-sm text-gray-500 hover:underline">
                ← 팁 검수 목록
            </Link>
            <div className="flex items-center justify-between mt-2 mb-6 gap-4 flex-wrap">
                <h1 className="text-2xl font-bold">팁 파이프라인 통계</h1>
                <div className="flex gap-2">
                    {([null, 30] as const).map((d) => (
                        <button
                            key={String(d)}
                            onClick={() => setDays(d)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                                days === d ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-700"
                            }`}
                        >
                            {d ? `최근 ${d}일` : "전체"}
                        </button>
                    ))}
                    <button
                        disabled={!data}
                        onClick={() => data && downloadCsv(data.places, days)}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-200 text-gray-700 disabled:opacity-50"
                    >
                        CSV 내려받기
                    </button>
                </div>
            </div>
            {error && <p className="text-red-600">{error}</p>}
            {!data && !error && <p className="text-gray-500">불러오는 중...</p>}
            {data && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        <Card label="처리한 장소" value={n(data.placesProcessed, 0)} />
                        <Card
                            label="자동 처리 시간 (평균)"
                            value={`${n(data.autoSeconds.avg)}초`}
                            hint={`최소 ${n(data.autoSeconds.min)}초 · 최대 ${n(data.autoSeconds.max)}초 ("맞아요" ~ 후보 생성)`}
                        />
                        <Card
                            label="사람 검수 시간 (평균)"
                            value={`${n(data.reviewMinutes.avg)}분`}
                            hint={`중간값 ${n(data.reviewMinutes.median)}분 · ${data.reviewMinutes.count}건 (화면 연 시각 ~ 마지막 승인)`}
                        />
                        <Card
                            label="Claude 비용"
                            value={`${n(data.claude.won, 0)}원`}
                            hint={`장소당 ${n(data.claude.wonPerPlace, 0)}원 · 입력 ${n(data.claude.inputTokens, 0)} / 출력 ${n(data.claude.outputTokens, 0)} 토큰 · $1=${data.usdKrw}원`}
                        />
                        <Card
                            label="장소당 수집 자료"
                            value={`${n(data.perPlace.sources)}건`}
                            hint={`관련 없음 ${pct(data.perPlace.irrelevantRate)}`}
                        />
                        <Card
                            label="장소당 후보"
                            value={n(data.perPlace.candidate)}
                            hint={`가게 공식 ${n(data.perPlace.official)} · 확인 필요 ${n(data.perPlace.needsCheck)}`}
                        />
                        <Card
                            label="후보 처리 결과"
                            value={`승인 ${pct(data.outcomes.rates?.asIs)}`}
                            hint={`그대로 ${data.outcomes.asIs} · 수정 후 ${data.outcomes.edited} (${pct(data.outcomes.rates?.edited)}) · 삭제 ${data.outcomes.rejected} (${pct(
                                data.outcomes.rates?.rejected
                            )})`}
                        />
                        <Card label="직접 추가한 팁" value={n(data.directTips, 0)} />
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                        <table className="w-full text-sm whitespace-nowrap">
                            <thead className="bg-gray-50 text-gray-500">
                                <tr>
                                    {CSV_COLUMNS.slice(1).map(([k, h]) => (
                                        <th key={k} className="p-2 text-left font-medium">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.places.length === 0 && (
                                    <tr>
                                        <td className="p-4 text-gray-500" colSpan={CSV_COLUMNS.length}>
                                            기록이 없어요
                                        </td>
                                    </tr>
                                )}
                                {data.places.map((r) => (
                                    <tr key={r.placeId} className="border-t border-gray-100">
                                        {CSV_COLUMNS.slice(1).map(([k]) => (
                                            <td key={k} className="p-2">
                                                {k === "name" ? (
                                                    <Link href={`/admin/tips/${r.placeId}`} className="text-green-700 hover:underline">
                                                        {r.name}
                                                    </Link>
                                                ) : typeof r[k] === "number" ? (
                                                    n(r[k] as number, k === "autoSeconds" || k === "reviewMinutes" || k === "won" ? 1 : 0)
                                                ) : (
                                                    r[k] ?? "-"
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                        2026-10-10 통계 기능 배포 이후 처리분부터 집계돼요. Claude 비용은 팁 후보 생성과 승인 번역만 포함해요 (장소 저장 때 자동채우기는 제외).
                    </p>
                </>
            )}
        </div>
    );
}
