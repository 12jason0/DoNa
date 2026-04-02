"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type SuggestionStatus = "PENDING" | "PUBLISHED" | "REJECTED";

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
        nickname?: string | null;
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
    status: SuggestionStatus;
    courseId: string;
};

const STATUS_TEXT: Record<SuggestionStatus, string> = {
    PENDING: "검토중",
    PUBLISHED: "등록완료",
    REJECTED: "미선정",
};

const STATUS_STYLE: Record<SuggestionStatus, string> = {
    PENDING: "bg-amber-100 text-amber-700",
    PUBLISHED: "bg-emerald-100 text-emerald-700",
    REJECTED: "bg-slate-200 text-slate-600",
};

export default function AdminSuggestPage() {
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [suggestions, setSuggestions] = useState<AdminSuggestion[]>([]);
    const [drafts, setDrafts] = useState<Record<number, SuggestionDraft>>({});
    const [filterStatus, setFilterStatus] = useState<"ALL" | SuggestionStatus>("ALL");

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
                            status: item.status,
                            courseId: item.course?.id ? String(item.course.id) : "",
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
        if (filterStatus === "ALL") return suggestions;
        return suggestions.filter((s) => s.status === filterStatus);
    }, [filterStatus, suggestions]);

    const updateDraft = (id: number, patch: Partial<SuggestionDraft>) => {
        setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };

    const saveSuggestion = async (id: number, overrideStatus?: SuggestionStatus) => {
        const draft = drafts[id];
        if (!draft) return;
        try {
            setSavingId(id);
            const res = await fetch(`/api/admin/course-suggestions/${id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    placeAddress: draft.placeAddress,
                    description: draft.description,
                    concept: draft.concept,
                    imageUrl: draft.imageUrl,
                    status: overrideStatus ?? draft.status,
                    courseId: draft.courseId.trim() ? Number(draft.courseId.trim()) : null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "저장 실패");
            await fetchSuggestions();
        } catch (e: any) {
            alert(e?.message || "저장 중 오류가 발생했습니다.");
        } finally {
            setSavingId(null);
        }
    };

    const publishSuggestion = async (id: number) => {
        if (!confirm("이 제보를 코스로 등록하시겠습니까?\n(courses 테이블에 새 항목이 생성됩니다)")) return;
        await saveSuggestion(id, "PUBLISHED");
    };

    const rejectSuggestion = async (id: number) => {
        if (!confirm("이 제보를 미선정 처리하시겠습니까?")) return;
        await saveSuggestion(id, "REJECTED");
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">장소 제보 검토</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        유저 제보를 확인하고 주소/설명을 보강한 뒤 상태를 업데이트하세요.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as "ALL" | SuggestionStatus)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    >
                        <option value="ALL">전체 상태</option>
                        <option value="PENDING">검토중</option>
                        <option value="PUBLISHED">등록완료</option>
                        <option value="REJECTED">미선정</option>
                    </select>
                    <button
                        type="button"
                        onClick={fetchSuggestions}
                        className="px-3 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50"
                    >
                        새로고침
                    </button>
                    <Link
                        href="/admin/courses"
                        className="px-3 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                        코스 관리로 이동
                    </Link>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-sm text-gray-500">로딩 중...</div>
                ) : filteredSuggestions.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500">표시할 제보가 없습니다.</div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredSuggestions.map((s) => {
                            const d = drafts[s.id];
                            return (
                                <div key={s.id} className="p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-gray-900">{s.placeName}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                제보자: {s.user?.nickname || "-"} ({s.user?.email || "-"}) ·{" "}
                                                {new Date(s.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                        <span
                                            className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_STYLE[s.status]}`}
                                        >
                                            {STATUS_TEXT[s.status]}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <input
                                            value={d?.placeAddress ?? ""}
                                            onChange={(e) => updateDraft(s.id, { placeAddress: e.target.value })}
                                            placeholder="주소"
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                        <input
                                            value={d?.concept ?? ""}
                                            onChange={(e) => updateDraft(s.id, { concept: e.target.value })}
                                            placeholder="컨셉"
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                        <input
                                            value={d?.imageUrl ?? ""}
                                            onChange={(e) => updateDraft(s.id, { imageUrl: e.target.value })}
                                            placeholder="이미지 URL"
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm md:col-span-2"
                                        />
                                        <textarea
                                            value={d?.description ?? ""}
                                            onChange={(e) => updateDraft(s.id, { description: e.target.value })}
                                            placeholder="관리자 메모/설명"
                                            rows={3}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm md:col-span-2 resize-y"
                                        />
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={d?.status ?? "PENDING"}
                                                onChange={(e) =>
                                                    updateDraft(s.id, { status: e.target.value as SuggestionStatus })
                                                }
                                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            >
                                                <option value="PENDING">검토중</option>
                                                <option value="PUBLISHED">등록완료</option>
                                                <option value="REJECTED">미선정</option>
                                            </select>
                                            <input
                                                value={d?.courseId ?? ""}
                                                onChange={(e) => updateDraft(s.id, { courseId: e.target.value })}
                                                placeholder="연결 코스 ID (선택)"
                                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-48"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 md:justify-end flex-wrap">
                                            {s.course?.id ? (
                                                <Link
                                                    href="/admin/courses"
                                                    className="text-xs px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                                                >
                                                    연결 코스: {s.course.title}
                                                </Link>
                                            ) : (
                                                <span className="text-xs text-gray-400">연결 코스 없음</span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => saveSuggestion(s.id)}
                                                disabled={savingId === s.id}
                                                className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
                                            >
                                                {savingId === s.id ? "저장 중..." : "저장"}
                                            </button>
                                            {s.status !== "PUBLISHED" && (
                                                <button
                                                    type="button"
                                                    onClick={() => publishSuggestion(s.id)}
                                                    disabled={savingId === s.id}
                                                    className="px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                                                >
                                                    올리기
                                                </button>
                                            )}
                                            {s.status === "PENDING" && (
                                                <button
                                                    type="button"
                                                    onClick={() => rejectSuggestion(s.id)}
                                                    disabled={savingId === s.id}
                                                    className="px-3 py-2 text-sm rounded-lg bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-60"
                                                >
                                                    거절
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
