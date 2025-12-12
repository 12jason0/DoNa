"use client";

import React, { useState, FormEvent, useEffect } from "react";
import Link from "next/link";

export default function AdminEscapeStoriesPage() {
    const [form, setForm] = useState({ title: "", synopsis: "", region: "", level: "", imageUrl: "" });
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [stories, setStories] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setResult(null);
        try {
            const payload: any = {
                title: form.title.trim(),
                synopsis: form.synopsis.trim() || undefined,
                region: form.region.trim() || undefined,
                level: form.level ? Number(form.level) : undefined,
                imageUrl: form.imageUrl.trim() || undefined,
            };
            if (!payload.title) {
                setResult("❌ 제목은 필수입니다.");
                return;
            }
            const res = await fetch("/api/escape/stories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setResult(`✅ 스토리 생성 완료 (ID: ${data?.story?.id ?? "?"})`);
                setForm({ title: "", synopsis: "", region: "", level: "", imageUrl: "" });
                fetchStories();
            } else {
                setResult(`❌ 실패: ${data?.error || "스토리 생성 실패"}`);
            }
        } catch (err) {
            setResult("❌ 네트워크 오류가 발생했습니다.");
        } finally {
            setSubmitting(false);
        }
    };

    const fetchStories = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch("/api/escape/stories");
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "조회 실패");
            const arr = Array.isArray(data) ? data : [];
            setStories(arr);
        } catch (e) {
            setError(e instanceof Error ? e.message : "조회 실패");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStories();
    }, []);

    return (
        <main className="max-w-5xl mx-auto px-6 py-12 text-black">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold">이스케이프 스토리 생성</h1>
                <Link href="/admin" className="text-sm text-blue-600 hover:underline">
                    ← 관리자 메인
                </Link>
            </div>

            {result && (
                <p className={`mb-4 text-sm ${result.startsWith("✅") ? "text-green-600" : "text-red-600"}`}>
                    {result}
                </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-2xl shadow-lg">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">제목 *</label>
                    <input
                        type="text"
                        name="title"
                        value={form.title}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border rounded-lg"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">시놉시스</label>
                    <textarea
                        name="synopsis"
                        rows={3}
                        value={form.synopsis}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border rounded-lg"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">지역</label>
                        <input
                            type="text"
                            name="region"
                            value={form.region}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">난이도(레벨)</label>
                        <input
                            type="number"
                            name="level"
                            value={form.level}
                            onChange={handleChange}
                            min={1}
                            className="w-full px-4 py-2 border rounded-lg"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">대표 이미지 URL</label>
                    <input
                        type="text"
                        name="imageUrl"
                        value={form.imageUrl}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border rounded-lg"
                    />
                </div>
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400"
                    >
                        {submitting ? "생성 중..." : "스토리 생성"}
                    </button>
                </div>
            </form>

            {/* 스토리 목록 */}
            <section className="mt-10 bg-white p-8 rounded-2xl shadow-lg">
                <h2 className="text-xl font-semibold mb-4">전체 스토리</h2>
                {loading ? (
                    <p className="text-gray-600">불러오는 중...</p>
                ) : error ? (
                    <p className="text-red-600">{error}</p>
                ) : stories.length === 0 ? (
                    <p className="text-gray-600">등록된 스토리가 없습니다.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left border-b">
                                    <th className="py-2 pr-4">ID</th>
                                    <th className="py-2 pr-4">제목</th>
                                    <th className="py-2 pr-4">지역</th>
                                    <th className="py-2 pr-4">예상시간</th>
                                    <th className="py-2">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stories.map((s: any) => (
                                    <tr key={s.id} className="border-b last:border-0">
                                        <td className="py-2 pr-4">{s.id}</td>
                                        <td className="py-2 pr-4">{s.title}</td>
                                        <td className="py-2 pr-4">{s.region || "-"}</td>
                                        <td className="py-2 pr-4">{s.estimated_duration_min ?? "-"}</td>
                                        <td className="py-2">
                                            <Link
                                                href={`/admin/escape-stories/${s.id}`}
                                                className="text-blue-600 hover:underline"
                                            >
                                                장소 관리
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    );
}
