"use client";

import { useEffect, useState, FormEvent } from "react";
// 장소용 태그도 types/tag.ts에 있다면 import 하세요. 여기선 일단 텍스트 입력으로 둡니다.

// --- 타입 정의 (DB 스키마 기준) ---
type Place = {
    id: number;
    name: string;
    address?: string | null;
    description?: string | null;
    category?: string | null;
    avg_cost_range?: string | null;
    opening_hours?: string | null;
    phone?: string | null;
    website?: string | null;
    parking_available?: boolean;
    reservation_required?: boolean;
    latitude?: number | null;
    longitude?: number | null;
    imageUrl?: string | null;
    tags?: any; // jsonb, string[] 또는 object
};

const INITIAL_PLACE: Omit<Place, "id"> = {
    name: "",
    address: "",
    description: "",
    category: "",
    avg_cost_range: "",
    opening_hours: "",
    phone: "",
    website: "",
    parking_available: false,
    reservation_required: false,
    latitude: undefined,
    longitude: undefined,
    imageUrl: "",
    tags: [],
};

export default function AdminPlacesPage() {
    const [places, setPlaces] = useState<Place[]>([]);
    const [formData, setFormData] = useState<Omit<Place, "id">>(INITIAL_PLACE);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);

    // --- 데이터 조회 ---
    const fetchPlaces = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/places?all=1&limit=200");
            const data = await res.json();
            setPlaces(data?.places || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlaces();
    }, []);

    // --- 핸들러 ---
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value ? parseFloat(value) : undefined }));
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setFormData((prev) => ({ ...prev, [name]: checked }));
    };

    const startEdit = (place: Place) => {
        setEditingId(place.id);
        setFormData({
            name: place.name || "",
            address: place.address || "",
            description: place.description || "",
            category: place.category || "",
            avg_cost_range: place.avg_cost_range || "",
            opening_hours: place.opening_hours || "",
            phone: place.phone || "",
            website: place.website || "",
            parking_available: place.parking_available || false,
            reservation_required: place.reservation_required || false,
            latitude: place.latitude ?? undefined,
            longitude: place.longitude ?? undefined,
            imageUrl: place.imageUrl || "",
            tags: place.tags || [],
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormData(INITIAL_PLACE);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("정말 이 장소를 삭제하시겠습니까?")) return;
        const token = localStorage.getItem("authToken");
        try {
            const res = await fetch(`/api/places/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                alert("삭제되었습니다.");
                fetchPlaces();
                if (editingId === id) cancelEdit();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const token = localStorage.getItem("authToken");
        try {
            const url = editingId ? `/api/places/${editingId}` : "/api/places";
            const method = editingId ? "PATCH" : "POST";

            const res = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                alert(editingId ? "장소가 수정되었습니다." : "장소 생성 완료");
                setFormData(INITIAL_PLACE);
                setEditingId(null);
                fetchPlaces();
            } else {
                const err = await res.json();
                alert(`실패: ${err.error || "알 수 없는 오류"}`);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-12">
            <h1 className="text-2xl font-bold text-gray-800">장소 데이터 관리</h1>

            {/* --- 입력 폼 --- */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-gray-700">
                        {editingId ? `🔄 장소 수정 (ID: ${editingId})` : "📍 새 장소 등록"}
                    </h2>
                    {editingId && (
                        <button onClick={cancelEdit} className="text-sm underline text-gray-500">
                            취소
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">장소 이름 *</label>
                            <input
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">카테고리</label>
                            <input
                                name="category"
                                placeholder="예: 카페, 식당"
                                value={formData.category || ""}
                                onChange={handleInputChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-sm font-medium text-gray-600">주소</label>
                            <input
                                name="address"
                                placeholder="도로명 주소"
                                value={formData.address || ""}
                                onChange={handleInputChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">전화번호</label>
                            <input
                                name="phone"
                                placeholder="02-0000-0000"
                                value={formData.phone || ""}
                                onChange={handleInputChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">웹사이트/인스타</label>
                            <input
                                name="website"
                                placeholder="https://..."
                                value={formData.website || ""}
                                onChange={handleInputChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">영업 시간</label>
                            <input
                                name="opening_hours"
                                placeholder="매일 10:00 - 22:00"
                                value={formData.opening_hours || ""}
                                onChange={handleInputChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">가격대</label>
                            <input
                                name="avg_cost_range"
                                placeholder="예: 1만원대"
                                value={formData.avg_cost_range || ""}
                                onChange={handleInputChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">위도 (Latitude)</label>
                            <input
                                type="number"
                                step="any"
                                name="latitude"
                                value={formData.latitude ?? ""}
                                onChange={handleNumberChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">경도 (Longitude)</label>
                            <input
                                type="number"
                                step="any"
                                name="longitude"
                                value={formData.longitude ?? ""}
                                onChange={handleNumberChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                            />
                        </div>

                        <div className="flex gap-6 items-center pt-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="parking_available"
                                    checked={formData.parking_available || false}
                                    onChange={handleCheckboxChange}
                                    className="w-5 h-5 text-green-600 rounded"
                                />
                                <span className="text-sm text-gray-700">주차 가능</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="reservation_required"
                                    checked={formData.reservation_required || false}
                                    onChange={handleCheckboxChange}
                                    className="w-5 h-5 text-green-600 rounded"
                                />
                                <span className="text-sm text-gray-700">예약 필수</span>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">이미지 URL</label>
                        <input
                            name="imageUrl"
                            value={formData.imageUrl || ""}
                            onChange={handleInputChange}
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">설명</label>
                        <textarea
                            name="description"
                            value={formData.description || ""}
                            onChange={handleInputChange}
                            rows={3}
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                        />
                    </div>

                    <button
                        disabled={isSubmitting}
                        className={`w-full py-3 rounded-lg font-bold text-white transition-all ${
                            isSubmitting
                                ? "bg-gray-400"
                                : editingId
                                ? "bg-blue-600 hover:bg-blue-700"
                                : "bg-green-600 hover:bg-green-700"
                        }`}
                    >
                        {isSubmitting ? "처리 중..." : editingId ? "장소 수정 완료" : "장소 저장하기"}
                    </button>
                </form>
            </div>

            {/* --- 리스트 --- */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold mb-4 text-gray-700">장소 목록 ({places.length})</h2>
                {loading ? (
                    <p>로딩 중...</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                <tr>
                                    <th className="p-3 border-b">ID</th>
                                    <th className="p-3 border-b">이름</th>
                                    <th className="p-3 border-b">카테고리</th>
                                    <th className="p-3 border-b">주소</th>
                                    <th className="p-3 border-b text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {places.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50 group">
                                        <td className="p-3 border-b text-gray-500">{p.id}</td>
                                        <td className="p-3 border-b font-medium text-gray-800">{p.name}</td>
                                        <td className="p-3 border-b text-gray-600">{p.category}</td>
                                        <td className="p-3 border-b text-gray-500 truncate max-w-xs">{p.address}</td>
                                        <td className="p-3 border-b text-right space-x-2">
                                            <button
                                                onClick={() => startEdit(p)}
                                                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-700 text-xs"
                                            >
                                                수정
                                            </button>
                                            <button
                                                onClick={() => handleDelete(p.id)}
                                                className="px-3 py-1 bg-red-50 border border-red-200 text-red-600 rounded hover:bg-red-100 text-xs"
                                            >
                                                삭제
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
