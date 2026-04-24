"use client";

import React, { useEffect, useState } from "react";

type Region = { id: number; name: string; name_en?: string | null; name_ja?: string | null; name_zh?: string | null; display_order: number };

export default function AdminRegionsPage() {
    const [regions, setRegions] = useState<Region[]>([]);
    const [newName, setNewName] = useState("");
    const [loading, setLoading] = useState(false);

    const fetchRegions = async () => {
        const res = await fetch("/api/admin/regions", { credentials: "include" });
        if (res.ok) setRegions(await res.json());
    };

    useEffect(() => { fetchRegions(); }, []);


    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setLoading(true);
        try {
            const res = await fetch("/api/admin/regions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ name: newName.trim() }),
            });
            if (res.ok) {
                setNewName("");
                await fetchRegions();
            } else {
                const err = await res.json();
                alert(err.error || "추가 실패");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!confirm(`"${name}" 지역을 삭제하시겠습니까?`)) return;
        const res = await fetch(`/api/admin/regions/${id}`, {
            method: "DELETE",
            credentials: "include",
        });
        if (res.ok) {
            await fetchRegions();
        } else {
            alert("삭제 실패");
        }
    };

    const handleMoveUp = async (index: number) => {
        if (index === 0) return;
        const a = regions[index];
        const b = regions[index - 1];
        await Promise.all([
            fetch(`/api/admin/regions/${a.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ display_order: b.display_order }),
            }),
            fetch(`/api/admin/regions/${b.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ display_order: a.display_order }),
            }),
        ]);
        await fetchRegions();
    };

    const handleMoveDown = async (index: number) => {
        if (index === regions.length - 1) return;
        const a = regions[index];
        const b = regions[index + 1];
        await Promise.all([
            fetch(`/api/admin/regions/${a.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ display_order: b.display_order }),
            }),
            fetch(`/api/admin/regions/${b.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ display_order: a.display_order }),
            }),
        ]);
        await fetchRegions();
    };

    return (
        <div className="max-w-lg mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">지역 관리</h1>

            <form onSubmit={handleAdd} className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="새 지역 이름 (예: 부산, 판교)"
                    className="flex-1 border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                />
                <button
                    type="submit"
                    disabled={loading || !newName.trim()}
                    className="px-4 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50"
                >
                    추가
                </button>
            </form>

            <div className="space-y-2">
                {regions.map((r, i) => (
                    <div key={r.id} className="flex items-center justify-between bg-white border rounded px-4 py-3">
                        <div>
                            <span className="font-medium text-gray-800">{r.name}</span>
                            {(r.name_en || r.name_ja || r.name_zh) && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {[r.name_en, r.name_ja, r.name_zh].filter(Boolean).join(" · ")}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => handleMoveUp(i)}
                                disabled={i === 0}
                                className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-30"
                            >
                                ▲
                            </button>
                            <button
                                onClick={() => handleMoveDown(i)}
                                disabled={i === regions.length - 1}
                                className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-30"
                            >
                                ▼
                            </button>
                            <button
                                onClick={() => handleDelete(r.id, r.name)}
                                className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 ml-1"
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
