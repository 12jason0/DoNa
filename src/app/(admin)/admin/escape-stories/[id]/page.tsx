"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type PlaceOption = {
    id: number;
    name: string;
    address?: string | null;
    description?: string | null;
    category?: string | null;
    imageUrl?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    signature?: string | null;
};

export default function ManageStoryPlacesPage() {
    const params = useParams<{ id: string }>();
    const storyId = Number(params?.id);
    const [items, setItems] = useState<PlaceOption[]>([]);
    const [chapters, setChapters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<PlaceOption> & { name?: string }>({ name: "" });
    const [storyDetail, setStoryDetail] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);

    const fetchItems = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/escape/place-options?storyId=${storyId}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "조회 실패");
            setItems(data.items || []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "조회 실패");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (Number.isFinite(storyId)) {
            fetchItems();
            // 미션/스토리까지 포함된 챕터 데이터도 로드
            (async () => {
                try {
                    const r = await fetch(`/api/escape/chapters?storyId=${storyId}`);
                    const d = await r.json();
                    if (r.ok && Array.isArray(d)) setChapters(d);
                } catch {}
                try {
                    const r2 = await fetch(`/api/escape/stories?storyId=${storyId}`);
                    const s = await r2.json();
                    if (r2.ok && s) setStoryDetail(s);
                } catch {}
            })();
        }
    }, [storyId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload: any = { ...form, storyId };
            if (!payload.name) throw new Error("이름은 필수입니다.");
            const res = await fetch("/api/escape/place-options", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "생성 실패");
            setForm({ name: "" });
            fetchItems();
        } catch (e) {
            alert(e instanceof Error ? e.message : "생성 실패");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("삭제하시겠습니까?")) return;
        try {
            const res = await fetch(`/api/escape/place-options?id=${id}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "삭제 실패");
            setItems((prev) => prev.filter((x) => x.id !== id));
        } catch (e) {
            alert(e instanceof Error ? e.message : "삭제 실패");
        }
    };

    return (
        <main className="max-w-5xl mx-auto px-6 py-12 text-black">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold">스토리 장소 관리 (ID: {storyId})</h1>
                <Link href="/admin/escape-stories" className="text-sm text-blue-600 hover:underline">
                    ← 스토리 목록/생성
                </Link>
            </div>

            {storyDetail && (
                <section className="bg-white p-6 rounded-2xl shadow mb-8">
                    <h2 className="text-xl font-semibold mb-3">스토리 정보</h2>
                    <StoryInfoEditor
                        story={storyDetail}
                        onSaved={async () => {
                            const r = await fetch(`/api/escape/stories?storyId=${storyId}`);
                            const s = await r.json();
                            if (r.ok) setStoryDetail(s);
                        }}
                    />
                </section>
            )}

            <section className="bg-white p-6 rounded-2xl shadow mb-10">
                <h2 className="text-xl font-semibold mb-4">장소 추가</h2>
                <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                        <input
                            name="name"
                            value={form.name || ""}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                        <input
                            name="category"
                            value={form.category || ""}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">이미지 URL</label>
                        <input
                            name="imageUrl"
                            value={form.imageUrl || ""}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">위도</label>
                        <input
                            name="latitude"
                            value={(form.latitude as any) || ""}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">경도</label>
                        <input
                            name="longitude"
                            value={(form.longitude as any) || ""}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
                        <input
                            name="address"
                            value={form.address || ""}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                        <textarea
                            name="description"
                            value={form.description || ""}
                            onChange={handleChange}
                            rows={3}
                            className="w-full px-3 py-2 border rounded"
                        />
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                        <button
                            disabled={submitting}
                            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
                        >
                            {submitting ? "추가 중..." : "장소 추가"}
                        </button>
                    </div>
                </form>
            </section>

            {/* 스토리 내용(인트로/대사 요약) */}
            {chapters.length > 0 && (
                <section className="bg-white p-6 rounded-2xl shadow mb-8">
                    <h2 className="text-xl font-semibold mb-3">스토리 내용</h2>
                    {(() => {
                        const first = chapters[0];
                        const st = first?.story_text;
                        if (Array.isArray(st)) {
                            return (
                                <ul className="list-disc pl-5 text-sm text-gray-800">
                                    {st.map((d: any, i: number) => (
                                        <li key={i} className="mb-1">
                                            {d?.speaker ? <b>{d.speaker}: </b> : null}
                                            {d?.text || ""}
                                        </li>
                                    ))}
                                </ul>
                            );
                        }
                        return (
                            <p className="text-sm text-gray-800 whitespace-pre-line">{String(st || "(내용 없음)")}</p>
                        );
                    })()}
                </section>
            )}

            <section className="bg-white p-6 rounded-2xl shadow">
                <h2 className="text-xl font-semibold mb-4">장소 목록</h2>
                {loading ? (
                    <p className="text-gray-500">불러오는 중...</p>
                ) : error ? (
                    <p className="text-red-600">{error}</p>
                ) : items.length === 0 ? (
                    <p className="text-gray-600">아직 등록된 장소가 없습니다.</p>
                ) : (
                    (() => {
                        const groups: Record<string, PlaceOption[]> = {} as any;
                        items.forEach((it) => {
                            const k = (it.category || "etc").toLowerCase();
                            if (!groups[k]) groups[k] = [];
                            groups[k].push(it);
                        });
                        return (
                            <div className="space-y-6">
                                {Object.keys(groups)
                                    .sort()
                                    .map((cat) => (
                                        <div key={cat}>
                                            <h3 className="font-semibold mb-2 text-gray-800">카테고리: {cat}</h3>
                                            <ul className="divide-y">
                                                {groups[cat].map((it) => (
                                                    <li key={it.id} className="py-3">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div>
                                                                <div className="font-medium">{it.name}</div>
                                                                {it.address && (
                                                                    <div className="text-xs text-gray-500">
                                                                        {it.address}
                                                                    </div>
                                                                )}
                                                                {(() => {
                                                                    const ch = chapters.find(
                                                                        (c) =>
                                                                            Array.isArray(c?.placeOptions) &&
                                                                            c.placeOptions.some(
                                                                                (p: any) => p.id === it.id
                                                                            )
                                                                    );
                                                                    const po = ch?.placeOptions?.find(
                                                                        (p: any) => p.id === it.id
                                                                    );
                                                                    if (!po) return null;
                                                                    const missions = Array.isArray(po.missions)
                                                                        ? po.missions
                                                                        : [];
                                                                    const stories = Array.isArray(po.stories)
                                                                        ? po.stories
                                                                        : [];
                                                                    return (
                                                                        <div className="mt-1 text-xs text-gray-700">
                                                                            미션 {missions.length}개
                                                                            {missions[0]?.missionPayload?.question
                                                                                ? ` · 첫문항: ${missions[0].missionPayload.question}`
                                                                                : ""}
                                                                            {stories.length > 0 && (
                                                                                <div className="mt-0.5 text-gray-600">
                                                                                    스토리 {stories.length}개
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleDelete(it.id)}
                                                                    className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
                                                                >
                                                                    삭제
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* 미션 관리 (간단 편집) */}
                                                        <PlaceMissionEditor
                                                            placeId={it.id}
                                                            onChanged={() => {
                                                                fetchItems();
                                                            }}
                                                        />
                                                        <PlaceOptionEditor item={it} onSaved={fetchItems} />
                                                        <DialogueEditor storyId={storyId} placeId={it.id} />
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                            </div>
                        );
                    })()
                )}
            </section>
        </main>
    );
}

function PlaceMissionEditor({ placeId, onChanged }: { placeId: number; onChanged: () => void }) {
    const [list, setList] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        missionNumber: "1",
        missionType: "quiz",
        question: "",
        hint: "",
        description: "",
    });
    const load = async () => {
        const r = await fetch(`/api/escape/place-missions?placeId=${placeId}`);
        const d = await r.json();
        if (r.ok) setList(d.missions || []);
    };
    useEffect(() => {
        if (open) load();
    }, [open]);
    const change = (e: any) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    const add = async () => {
        const payload: any = {
            placeId,
            missionNumber: Number(form.missionNumber) || 1,
            missionType: form.missionType,
            missionPayload: { question: form.question, hint: form.hint },
            description: form.description || undefined,
            question: form.question || undefined,
            hint: form.hint || undefined,
        };
        const r = await fetch(`/api/escape/place-missions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (r.ok) {
            setForm({ missionNumber: "1", missionType: "quiz", question: "", hint: "", description: "" });
            await load();
            onChanged();
        }
    };
    const del = async (id: number) => {
        if (!confirm("삭제?")) return;
        const r = await fetch(`/api/escape/place-missions?id=${id}`, { method: "DELETE" });
        if (r.ok) {
            await load();
            onChanged();
        }
    };
    return (
        <div className="mt-3">
            <button onClick={() => setOpen((v) => !v)} className="text-xs text-blue-600 hover:underline">
                {open ? "미션 접기" : "미션 관리"}
            </button>
            {open && (
                <div className="mt-2 border rounded p-3 bg-gray-50">
                    <div className="flex flex-wrap gap-2 items-end mb-3">
                        <input
                            name="missionNumber"
                            value={form.missionNumber}
                            onChange={change}
                            className="w-20 px-2 py-1 border rounded text-sm"
                            placeholder="#"
                        />
                        <select
                            name="missionType"
                            value={form.missionType}
                            onChange={change}
                            className="w-32 px-2 py-1 border rounded text-sm"
                        >
                            <option value="quiz">quiz</option>
                            <option value="photo">photo</option>
                            <option value="gps">gps</option>
                            <option value="puzzle">puzzle</option>
                            <option value="text">text</option>
                            <option value="choice">choice</option>
                        </select>
                        <input
                            name="question"
                            value={form.question}
                            onChange={change}
                            className="flex-1 min-w-[160px] px-2 py-1 border rounded text-sm"
                            placeholder="문항/퀘스천"
                        />
                        <input
                            name="hint"
                            value={form.hint}
                            onChange={change}
                            className="flex-1 min-w-[120px] px-2 py-1 border rounded text-sm"
                            placeholder="힌트"
                        />
                        <button onClick={add} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">
                            추가
                        </button>
                    </div>
                    <ul className="text-xs divide-y bg-white rounded">
                        {list.map((m) => (
                            <li key={m.id} className="px-2 py-2 flex items-center justify-between">
                                <div>
                                    <b>#{m.missionNumber}</b> {m.missionType} —{" "}
                                    {m.description || m.missionPayload?.question || "(내용 없음)"}
                                </div>
                                <button onClick={() => del(m.id)} className="px-2 py-1 border rounded">
                                    삭제
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function DialogueEditor({ storyId, placeId }: { storyId: number; placeId?: number }) {
    const [open, setOpen] = useState(false);
    const [list, setList] = useState<any[]>([]);
    const [f, setF] = useState<any>({ type: "intro", order: "1", speaker: "", role: "npc", message: "" });
    const load = async () => {
        const qs = new URLSearchParams({ storyId: String(storyId) });
        if (placeId) qs.set("placeId", String(placeId));
        const r = await fetch(`/api/escape/dialogues?${qs.toString()}`);
        const d = await r.json();
        if (r.ok) setList(d.items || []);
    };
    useEffect(() => {
        if (open) load();
    }, [open]);
    const change = (e: any) => setF((p: any) => ({ ...p, [e.target.name]: e.target.value }));
    const add = async () => {
        const payload: any = {
            storyId,
            placeId: placeId ?? undefined,
            type: f.type,
            order: Number(f.order) || 1,
            speaker: f.speaker || undefined,
            role: f.role || "npc",
            message: f.message,
        };
        const r = await fetch(`/api/escape/dialogues`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (r.ok) {
            setF({ type: "intro", order: "1", speaker: "", role: "npc", message: "" });
            await load();
        }
    };
    const del = async (id: number) => {
        if (!confirm("삭제?")) return;
        const r = await fetch(`/api/escape/dialogues?id=${id}`, { method: "DELETE" });
        if (r.ok) await load();
    };
    const update = async (row: any) => {
        const payload: any = {
            id: row.id,
            type: row.type,
            order: row.order,
            speaker: row.speaker,
            role: row.role,
            message: row.message,
        };
        const r = await fetch(`/api/escape/dialogues`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (r.ok) await load();
    };
    return (
        <div className="mt-2">
            <button onClick={() => setOpen((v) => !v)} className="text-xs text-blue-600 hover:underline">
                {open ? "대사 접기" : placeId ? "장소 대사 관리" : "스토리 대사 관리"}
            </button>
            {open && (
                <div className="mt-2 border rounded p-3 bg-gray-50 text-sm">
                    <div className="flex flex-wrap gap-2 items-end mb-3">
                        <select name="type" value={f.type} onChange={change} className="w-28 px-2 py-1 border rounded">
                            <option value="intro">intro</option>
                            <option value="main">main</option>
                        </select>
                        <input
                            name="order"
                            value={f.order}
                            onChange={change}
                            className="w-20 px-2 py-1 border rounded"
                            placeholder="#"
                        />
                        <input
                            name="speaker"
                            value={f.speaker}
                            onChange={change}
                            className="w-28 px-2 py-1 border rounded"
                            placeholder="speaker"
                        />
                        <select name="role" value={f.role} onChange={change} className="w-28 px-2 py-1 border rounded">
                            <option value="npc">npc</option>
                            <option value="user">user</option>
                            <option value="system">system</option>
                        </select>
                        <input
                            name="message"
                            value={f.message}
                            onChange={change}
                            className="flex-1 min-w-[160px] px-2 py-1 border rounded"
                            placeholder="message"
                        />
                        <button onClick={add} className="px-3 py-1.5 bg-green-600 text-white rounded">
                            추가
                        </button>
                    </div>
                    <ul className="divide-y bg-white rounded">
                        {list.map((row: any) => (
                            <li key={row.id} className="px-2 py-2 grid grid-cols-12 gap-2 items-center">
                                <select
                                    value={row.type}
                                    onChange={(e) => (row.type = e.target.value)}
                                    className="col-span-2 px-2 py-1 border rounded"
                                >
                                    <option value="intro">intro</option>
                                    <option value="main">main</option>
                                </select>
                                <input
                                    value={row.order}
                                    onChange={(e) => (row.order = Number(e.target.value))}
                                    className="col-span-1 px-2 py-1 border rounded"
                                />
                                <input
                                    value={row.speaker || ""}
                                    onChange={(e) => (row.speaker = e.target.value)}
                                    className="col-span-2 px-2 py-1 border rounded"
                                />
                                <select
                                    value={row.role || "npc"}
                                    onChange={(e) => (row.role = e.target.value)}
                                    className="col-span-2 px-2 py-1 border rounded"
                                >
                                    <option value="npc">npc</option>
                                    <option value="user">user</option>
                                    <option value="system">system</option>
                                </select>
                                <input
                                    value={row.message}
                                    onChange={(e) => (row.message = e.target.value)}
                                    className="col-span-3 px-2 py-1 border rounded"
                                />
                                <div className="col-span-2 flex gap-2 justify-end">
                                    <button onClick={() => update(row)} className="px-2 py-1 border rounded">
                                        저장
                                    </button>
                                    <button onClick={() => del(row.id)} className="px-2 py-1 border rounded">
                                        삭제
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function StoryInfoEditor({ story, onSaved }: { story: any; onSaved: () => void }) {
    const [f, setF] = useState<any>({
        title: story.title || "",
        synopsis: story.synopsis || "",
        region: story.region || "",
        level: story.level || 1,
        imageUrl: story.imageUrl || "",
        estimated_duration_min: story.estimated_duration_min || "",
        price: story.price || "",
    });
    const change = (e: any) => setF((p: any) => ({ ...p, [e.target.name]: e.target.value }));
    const save = async () => {
        const payload = { id: story.id, ...f } as any;
        const r = await fetch(`/api/escape/stories`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (r.ok) onSaved();
    };
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
                <label className="block text-gray-700 mb-1">제목</label>
                <input name="title" value={f.title} onChange={change} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
                <label className="block text-gray-700 mb-1">지역</label>
                <input name="region" value={f.region} onChange={change} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
                <label className="block text-gray-700 mb-1">레벨</label>
                <input name="level" value={f.level} onChange={change} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
                <label className="block text-gray-700 mb-1">예상시간(분)</label>
                <input
                    name="estimated_duration_min"
                    value={f.estimated_duration_min}
                    onChange={change}
                    className="w-full px-3 py-2 border rounded"
                />
            </div>
            <div className="md:col-span-2">
                <label className="block text-gray-700 mb-1">대표 이미지 URL</label>
                <input
                    name="imageUrl"
                    value={f.imageUrl}
                    onChange={change}
                    className="w-full px-3 py-2 border rounded"
                />
            </div>
            <div className="md:col-span-2">
                <label className="block text-gray-700 mb-1">시놉시스</label>
                <textarea
                    name="synopsis"
                    rows={3}
                    value={f.synopsis}
                    onChange={change}
                    className="w-full px-3 py-2 border rounded"
                />
            </div>
            <div className="md:col-span-2 flex justify-end">
                <button onClick={save} className="px-4 py-2 bg-gray-900 text-white rounded">
                    저장
                </button>
            </div>
        </div>
    );
}

function PlaceOptionEditor({ item, onSaved }: { item: PlaceOption; onSaved: () => void }) {
    const [open, setOpen] = useState(false);
    const [f, setF] = useState<any>({ ...item });
    const change = (e: any) => setF((p: any) => ({ ...p, [e.target.name]: e.target.value }));
    const save = async () => {
        const payload: any = { id: item.id, ...f };
        const r = await fetch(`/api/escape/place-options`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (r.ok) {
            setOpen(false);
            onSaved();
        }
    };
    return (
        <div className="mt-2">
            <button onClick={() => setOpen((v) => !v)} className="text-xs text-blue-600 hover:underline">
                {open ? "장소 편집 닫기" : "장소 편집"}
            </button>
            {open && (
                <div className="mt-2 border rounded p-3 bg-gray-50 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <input
                        name="name"
                        value={f.name || ""}
                        onChange={change}
                        className="px-2 py-1 border rounded"
                        placeholder="이름"
                    />
                    <input
                        name="category"
                        value={f.category || ""}
                        onChange={change}
                        className="px-2 py-1 border rounded"
                        placeholder="카테고리"
                    />
                    <input
                        name="imageUrl"
                        value={f.imageUrl || ""}
                        onChange={change}
                        className="px-2 py-1 border rounded md:col-span-2"
                        placeholder="이미지 URL"
                    />
                    <input
                        name="latitude"
                        value={String(f.latitude ?? "")}
                        onChange={change}
                        className="px-2 py-1 border rounded"
                        placeholder="위도"
                    />
                    <input
                        name="longitude"
                        value={String(f.longitude ?? "")}
                        onChange={change}
                        className="px-2 py-1 border rounded"
                        placeholder="경도"
                    />
                    <input
                        name="address"
                        value={f.address || ""}
                        onChange={change}
                        className="px-2 py-1 border rounded md:col-span-2"
                        placeholder="주소"
                    />
                    <textarea
                        name="description"
                        value={f.description || ""}
                        onChange={change}
                        rows={2}
                        className="px-2 py-1 border rounded md:col-span-2"
                        placeholder="설명"
                    />
                    <div className="md:col-span-2 flex justify-end gap-2">
                        <button onClick={save} className="px-3 py-1.5 bg-gray-900 text-white rounded">
                            저장
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
