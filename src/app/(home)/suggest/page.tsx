"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type PlaceInput = { name: string; address?: string; note?: string };

export default function SuggestCoursePage() {
    const router = useRouter();
    
    // 🟢 성능 최적화: suggest 페이지 진입 시 메인 페이지를 미리 로드하여 빠른 전환 보장
    useEffect(() => {
        router.prefetch("/");
    }, [router]);
    
    const [title, setTitle] = useState("");
    const [location, setLocation] = useState("");
    const [budget, setBudget] = useState("");
    const [duration, setDuration] = useState("");
    const [description, setDescription] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [contactKakao, setContactKakao] = useState("");
    const [places, setPlaces] = useState<PlaceInput[]>([{ name: "" }]);
    const [submitting, setSubmitting] = useState(false);

    const addPlace = () => setPlaces((p) => [...p, { name: "" }]);
    const removePlace = (idx: number) => setPlaces((p) => p.filter((_, i) => i !== idx));

    const updatePlace = (idx: number, key: keyof PlaceInput, value: string) => {
        setPlaces((prev) => prev.map((pl, i) => (i === idx ? { ...pl, [key]: value } : pl)));
    };

    const handleSubmit = async () => {
        if (!title.trim() || places.every((p) => !p.name.trim())) {
            alert("제목과 장소 한 개 이상은 필수입니다.");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/course-suggestions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    location,
                    budget,
                    duration,
                    description,
                    imageUrl,
                    places: places.filter((p) => p.name.trim()),
                    contact: { email: contactEmail || undefined, kakaoId: contactKakao || undefined },
                }),
            });
            if (res.ok) {
                alert("제안이 접수되었습니다! 검토 후 반영하겠습니다.");
                router.prefetch("/");
                router.push("/");
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data?.error || "제출 실패");
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50">
            <div className="max-w-4xl mx-auto px-4 py-12">
                {/* Header Section */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">나만의 코스 제안하기</h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        여러분의 멋진 코스를 공유해 주세요. 운영팀이 검토 후 소개합니다.
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="p-8 space-y-8">
                        {/* Course Title */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-800">
                                코스 제목 <span className="text-red-500">*</span>
                            </label>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-0 transition-colors"
                                placeholder="예) 혜화 연극 + 낙산공원 야경"
                            />
                        </div>

                        {/* Basic Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-800">지역</label>
                                <input
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-0 transition-colors"
                                    placeholder="예) 홍대"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-800">예산 (원)</label>
                                <input
                                    value={budget}
                                    onChange={(e) => setBudget(e.target.value)}
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-0 transition-colors"
                                    placeholder="50,000"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-800">소요시간 (시간)</label>
                                <input
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-0 transition-colors"
                                    placeholder="3"
                                />
                            </div>
                        </div>

                        {/* Places Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-semibold text-gray-800">
                                    장소 목록 <span className="text-red-500">*</span>
                                </label>
                                <button
                                    onClick={addPlace}
                                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 4v16m8-8H4"
                                        />
                                    </svg>
                                    장소 추가
                                </button>
                            </div>

                            <div className="space-y-4">
                                {places.map((pl, idx) => (
                                    <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <label className="block text-xs font-medium text-gray-600">
                                                    장소 이름 <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    value={pl.name}
                                                    onChange={(e) => updatePlace(idx, "name", e.target.value)}
                                                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-0 transition-colors"
                                                    placeholder={`장소 ${idx + 1}`}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-xs font-medium text-gray-600">주소</label>
                                                <input
                                                    value={pl.address || ""}
                                                    onChange={(e) => updatePlace(idx, "address", e.target.value)}
                                                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-0 transition-colors"
                                                    placeholder="선택사항"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="block text-xs font-medium text-gray-600">
                                                        설명
                                                    </label>
                                                    {places.length > 1 && (
                                                        <button
                                                            onClick={() => removePlace(idx)}
                                                            className="text-red-500 hover:text-red-700 p-1 rounded"
                                                            title="장소 삭제"
                                                        >
                                                            <svg
                                                                className="w-4 h-4"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={2}
                                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                                />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                                <input
                                                    value={pl.note || ""}
                                                    onChange={(e) => updatePlace(idx, "note", e.target.value)}
                                                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-0 transition-colors"
                                                    placeholder="선택사항"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-800">코스 설명</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-0 transition-colors resize-none"
                                rows={4}
                                placeholder="코스의 특색, 추천 이유, 팁 등을 자유롭게 작성해 주세요."
                            />
                        </div>

                        {/* Image URL */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-800">대표 이미지 URL</label>
                            <input
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-0 transition-colors"
                                placeholder="https://example.com/image.jpg"
                            />
                        </div>

                        {/* Contact Info */}
                        <div className="space-y-4">
                            <label className="block text-sm font-semibold text-gray-800">연락처 (선택)</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-xs font-medium text-gray-600">이메일</label>
                                    <input
                                        value={contactEmail}
                                        onChange={(e) => setContactEmail(e.target.value)}
                                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-0 transition-colors"
                                        placeholder="your@email.com"
                                        type="email"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-medium text-gray-600">카카오톡 ID</label>
                                    <input
                                        value={contactKakao}
                                        onChange={(e) => setContactKakao(e.target.value)}
                                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-0 transition-colors"
                                        placeholder="kakao_id"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="bg-gray-50 px-8 py-6 border-t border-gray-200">
                        <div className="flex gap-4 justify-end">
                            <button
                                onClick={() => window.history.back()}
                                className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="px-8 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-lg hover:shadow-xl"
                            >
                                {submitting ? (
                                    <span className="flex items-center">
                                        <svg
                                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                        제출 중...
                                    </span>
                                ) : (
                                    "제안 제출"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
