"use client";

import { useEffect, useState } from "react";

type Metrics = {
    days: number;
    signups: number;
    activeUsers: number;
    aiRecommendations: number;
    courseStarts: number;
    completions: number;
    memories: number;
    shares: number;
    signupsByChannel: { channel: string; count: number }[];
    signupsByAnswer: { channel: string; count: number }[];
};

function CountTable({ rows }: { rows: { channel: string; count: number }[] }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
                <tbody>
                    {rows.length === 0 && (
                        <tr>
                            <td className="p-4 text-gray-500">가입자가 없어요</td>
                        </tr>
                    )}
                    {rows.map((r) => (
                        <tr key={r.channel} className="border-t border-gray-100 first:border-t-0">
                            <td className="p-3">{r.channel}</td>
                            <td className="p-3 text-right font-semibold">{r.count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const CARDS: { key: keyof Metrics; label: string; hint?: string }[] = [
    { key: "signups", label: "가입자" },
    { key: "activeUsers", label: "활동 사용자", hint: "코스 보기·저장·시작, 로그인, AI 추천 중 하나라도" },
    { key: "aiRecommendations", label: "AI 추천" },
    { key: "courseStarts", label: "코스 확정", hint: "코스 시작(진행 중 코스로 설정)" },
    { key: "completions", label: "완료" },
    { key: "memories", label: "추억" },
    { key: "shares", label: "공유" },
];

export default function AdminMetricsPage() {
    const [days, setDays] = useState<7 | 30>(7);
    const [data, setData] = useState<Metrics | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        setData(null);
        setError("");
        fetch(`/api/admin/stats/metrics?days=${days}`, { credentials: "include", cache: "no-store" })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then(setData)
            .catch((e) => setError(`불러오지 못했어요 (${e.message})`));
    }, [days]);

    return (
        <div className="p-6 max-w-5xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">핵심 숫자</h1>
                <div className="flex gap-2">
                    {([7, 30] as const).map((d) => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                                days === d ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-700"
                            }`}
                        >
                            최근 {d}일
                        </button>
                    ))}
                </div>
            </div>

            {error && <p className="text-red-600">{error}</p>}
            {!data && !error && <p className="text-gray-500">불러오는 중…</p>}

            {data && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {CARDS.map((c) => (
                            <div key={c.key} className="bg-white rounded-xl border border-gray-200 p-4" title={c.hint}>
                                <p className="text-sm text-gray-500">{c.label}</p>
                                <p className="text-3xl font-bold mt-1">{(data[c.key] as number).toLocaleString()}</p>
                            </div>
                        ))}
                    </div>

                    <h2 className="text-lg font-bold mb-3">유입 경로별 가입자</h2>
                    <CountTable rows={data.signupsByChannel} />
                    <p className="text-xs text-gray-400 mt-2">
                        처음 방문 기준. 앱에서 가입했거나 기록 기능 배포 전 가입자는 &apos;기록 없음&apos;으로 나와요. 테스트 계정 제외.
                    </p>

                    <h2 className="text-lg font-bold mb-3 mt-8">&quot;두나 어디서 알게 됐어요?&quot; 답</h2>
                    <CountTable rows={data.signupsByAnswer ?? []} />
                    <p className="text-xs text-gray-400 mt-2">
                        가입 직후 한 번 묻는 질문. 질문 배포 전 가입자·아직 앱을 다시 안 연 사람은 &apos;답 없음&apos;.
                    </p>
                </>
            )}
        </div>
    );
}
