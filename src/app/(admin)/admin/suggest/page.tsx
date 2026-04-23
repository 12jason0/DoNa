"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type SuggestionStatus = "PENDING" | "ACCEPTED" | "PUBLISHED" | "REJECTED";

type AdminSuggestion = {
    id: number;
    placeName: string;
    placeAddress?: string | null;
    description?: string | null;
    concept?: string | null;
    imageUrl?: string | null;
    status: SuggestionStatus;
    createdAt: string;
    user?: {
        id: number;
        username?: string | null;
        email?: string | null;
    } | null;
    course?: {
        id: number;
        title: string;
    } | null;
};

type SuggestionDraft = {
    placeAddress: string;
    description: string;
    concept: string;
    imageUrl: string;
};

const STATUS_TEXT: Record<SuggestionStatus, string> = {
    PENDING: "검토중",
    ACCEPTED: "진행중",
    PUBLISHED: "완료",
    REJECTED: "거절",
};

const STATUS_STYLE: Record<SuggestionStatus, string> = {
    PENDING: "bg-amber-100 text-amber-700",
    ACCEPTED: "bg-blue-100 text-blue-700",
    PUBLISHED: "bg-emerald-100 text-emerald-700",
    REJECTED: "bg-slate-200 text-slate-500",
};

export default function AdminSuggestPage() {
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [suggestions, setSuggestions] = useState<AdminSuggestion[]>([]);
    const [drafts, setDrafts] = useState<Record<number, SuggestionDraft>>({});
    const [filterStatus, setFilterStatus] = useState<"ALL" | SuggestionStatus>("ALL");
    const pendingCount = suggestions.filter((s) => s.status === "PENDING").length;
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const fetchSuggestions = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/admin/course-suggestions", { credentials: "include" });
            if (!res.ok) throw new Error("제보 목록 조회 실패");
            const data = await res.json();
            const list = Array.isArray(data?.suggestions) ? (data.suggestions as AdminSuggestion[]) : [];
            setSuggestions(list);
            setDrafts(
                Object.fromEntries(
                    list.map((item) => [
                        item.id,
                        {
                            placeAddress: item.placeAddress ?? "",
                            description: item.description ?? "",
                            concept: item.concept ?? "",
                            imageUrl: item.imageUrl ?? "",
                        },
                    ]),
                ),
            );
        } catch (e) {
            console.error("제보 목록 로딩 실패:", e);
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuggestions();
    }, []);

    const filteredSuggestions = useMemo(() => {
        const list = filterStatus === "ALL" ? suggestions : suggestions.filter((s) => s.status === filterStatus);
        return [...list].sort((a, b) => {
            const order: Record<SuggestionStatus, number> = { PENDING: 0, ACCEPTED: 1, PUBLISHED: 2, REJECTED: 3 };
            return order[a.status] - order[b.status];
        });
    }, [filterStatus, suggestions]);

    const updateDraft = (id: number, patch: Partial<SuggestionDraft>) => {
        setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };

    const saveAndUpdateStatus = async (id: number, status: SuggestionStatus) => {
        const draft = drafts[id];
        if (!draft) return;
        try {
            setSavingId(id);
            const res = await fetch(`/api/admin/course-suggestions/${id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    placeAddress: draft.placeAddress || null,
                    description: draft.description || null,
                    concept: draft.concept || null,
                    imageUrl: draft.imageUrl || null,
                    status,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "저장 실패");
            await fetchSuggestions();
            if (status === "PUBLISHED") setExpandedId(null);
        } catch (e: any) {
            alert(e?.message || "저장 중 오류가 발생했습니다.");
        } finally {
            setSavingId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">장소 제보 검토</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        승인하면 장소 페이지에 draft로 추가되고 제보자에게 알림이 전송됩니다.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={fetchSuggestions}
                        className="px-3 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50"
                    >
                        새로고침
                    </button>
                    <Link
                        href="/admin/places"
                        className="px-3 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700"
                    >
                        장소 관리
                    </Link>
                </div>
            </div>

            {/* 필터 탭 */}
            <div className="flex gap-2">
                {(["ALL", "PENDING", "ACCEPTED", "PUBLISHED", "REJECTED"] as const).map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => setFilterStatus(s)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            filterStatus === s
                                ? "bg-gray-900 text-white"
                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                        {s === "ALL" ? `전체 (${suggestions.length})` : `${STATUS_TEXT[s]} (${suggestions.filter(x => x.status === s).length})`}
                        {s === "PENDING" && pendingCount > 0 && (
                            <span className="ml-1.5 bg-amber-400 text-white text-xs rounded-full px-1.5 py-0.5">
                                {pendingCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* 목록 */}
            {loading ? (
                <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
            ) : filteredSuggestions.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">표시할 제보가 없습니다.</div>
            ) : (
                <div className="space-y-3">
                    {filteredSuggestions.map((s) => {
                        const d = drafts[s.id];
                        const isExpanded = expandedId === s.id;
                        const isSaving = savingId === s.id;

                        return (
                            <div
                                key={s.id}
                                className={`bg-white rounded-xl border transition-shadow ${
                                    s.status === "PENDING" ? "border-amber-200 shadow-sm" : "border-gray-200"
                                }`}
                            >
                                {/* 카드 상단 - 항상 보이는 요약 */}
                                <div
                                    className="flex items-center gap-4 p-4 cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                                >
                                    {/* 이미지 */}
                                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                                        {s.imageUrl ? (
                                            <img
                                                src={s.imageUrl}
                                                alt={s.placeName}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">
                                                📍
                                            </div>
                                        )}
                                    </div>

                                    {/* 정보 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-gray-900">{s.placeName}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[s.status]}`}>
                                                {STATUS_TEXT[s.status]}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-0.5 truncate">
                                            {s.placeAddress || "주소 미입력"}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {s.user?.username || s.user?.email || "-"} ·{" "}
                                            {new Date(s.createdAt).toLocaleDateString()}
                                            {s.concept && ` · ${s.concept}`}
                                            {s.status === "PUBLISHED" && s.course && (
                                                <span className="ml-1 text-emerald-600 font-medium">
                                                    · {s.course.id}번 코스 ({s.course.title})
                                                </span>
                                            )}
                                            {s.status === "PUBLISHED" && !s.course && (
                                                <span className="ml-1 text-gray-400">· 코스 미연결</span>
                                            )}
                                        </p>
                                    </div>

                                    {/* PENDING이면 빠른 액션 버튼 */}
                                    {s.status === "PENDING" && (
                                        <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                disabled={isSaving}
                                                onClick={() => saveAndUpdateStatus(s.id, "ACCEPTED")}
                                                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
                                            >
                                                {isSaving ? "처리중..." : "승인"}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isSaving}
                                                onClick={() => saveAndUpdateStatus(s.id, "REJECTED")}
                                                className="px-4 py-2 rounded-lg bg-red-50 text-red-500 text-sm font-semibold hover:bg-red-100 disabled:opacity-60"
                                            >
                                                거절
                                            </button>
                                        </div>
                                    )}

                                    <span className="text-gray-400 text-sm ml-1">{isExpanded ? "▲" : "▼"}</span>
                                </div>

                                {/* 확장 영역 - 수정 폼 */}
                                {isExpanded && d && (
                                    <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <input
                                                value={d.placeAddress}
                                                onChange={(e) => updateDraft(s.id, { placeAddress: e.target.value })}
                                                placeholder="주소"
                                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            />
                                            <input
                                                value={d.concept}
                                                onChange={(e) => updateDraft(s.id, { concept: e.target.value })}
                                                placeholder="컨셉"
                                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            />
                                            <input
                                                value={d.imageUrl}
                                                onChange={(e) => updateDraft(s.id, { imageUrl: e.target.value })}
                                                placeholder="이미지 URL"
                                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm md:col-span-2"
                                            />
                                            <textarea
                                                value={d.description}
                                                onChange={(e) => updateDraft(s.id, { description: e.target.value })}
                                                placeholder="메모/설명"
                                                rows={3}
                                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm md:col-span-2 resize-y"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between mt-3">
                                            {s.course ? (
                                                <Link
                                                    href="/admin/courses"
                                                    className="text-xs text-blue-600 hover:underline"
                                                >
                                                    연결 코스: {s.course.title}
                                                </Link>
                                            ) : (
                                                <span className="text-xs text-gray-400">연결 코스 없음</span>
                                            )}
                                            <div className="flex gap-2">
                                                {s.status === "PENDING" ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            disabled={isSaving}
                                                            onClick={() => saveAndUpdateStatus(s.id, "REJECTED")}
                                                            className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-sm font-medium hover:bg-red-100 disabled:opacity-60"
                                                        >
                                                            거절
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={isSaving}
                                                            onClick={() => saveAndUpdateStatus(s.id, "ACCEPTED")}
                                                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                                                        >
                                                            {isSaving ? "처리중..." : "수정 후 승인"}
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={isSaving}
                                                        onClick={() => saveAndUpdateStatus(s.id, s.status)}
                                                        className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                                                    >
                                                        {isSaving ? "저장 중..." : "수정 저장"}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
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
