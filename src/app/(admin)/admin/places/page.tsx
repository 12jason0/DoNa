"use client";

import { useEffect, useState, FormEvent, useCallback, useRef } from "react";
import { uploadViaPresign } from "@/lib/uploadViaPresign";

type Place = {
    id: number;
    name: string;
    name_en?: string | null;
    name_ja?: string | null;
    name_zh?: string | null;
    address?: string | null;
    address_en?: string | null;
    address_ja?: string | null;
    address_zh?: string | null;
    description?: string | null;
    description_en?: string | null;
    description_ja?: string | null;
    description_zh?: string | null;
    category?: string | null;
    avg_cost_range?: string | null;
    opening_hours?: string | null;
    phone?: string | null;
    website?: string | null;
    reservation_required?: boolean;
    reservationUrl?: string | null;
    parking_available?: boolean;
    latitude?: number | null;
    longitude?: number | null;
    imageUrl?: string | null;
};

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const INITIAL_PLACE: Omit<Place, "id"> = {
    name: "", name_en: "", name_ja: "", name_zh: "",
    address: "", address_en: "", address_ja: "", address_zh: "",
    description: "", description_en: "", description_ja: "", description_zh: "",
    category: "", avg_cost_range: "", opening_hours: "",
    phone: "", website: "", reservation_required: false,
    reservationUrl: "", parking_available: false,
    latitude: undefined, longitude: undefined, imageUrl: "",
};

function parseOpeningHoursTime(str: string | null | undefined): { openTime: string; closeTime: string } {
    const m = (str || "").match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (!m) return { openTime: "10:00", closeTime: "21:00" };
    return { openTime: m[1].padStart(5, "0"), closeTime: m[2].padStart(5, "0") };
}

export default function AdminPlacesPage() {
    const [places, setPlaces] = useState<Place[]>([]);
    const [drafts, setDrafts] = useState<Place[]>([]);
    const [formData, setFormData] = useState<Omit<Place, "id">>(INITIAL_PLACE);
    const [openTime, setOpenTime] = useState("10:00");
    const [closeTime, setCloseTime] = useState("21:00");
    const [openDays, setOpenDays] = useState<number[]>([1, 2, 3, 4, 5, 6]); // 월~토 기본
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isAutofilling, setIsAutofilling] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const itemsPerPage = 10;
    const [searchQuery, setSearchQuery] = useState("");

    const fetchDrafts = useCallback(async () => {
        try {
            const res = await fetch("/api/places?all=1&limit=100&offset=0&status=draft", { credentials: "include" });
            const data = await res.json();
            setDrafts(data?.places || []);
        } catch {}
    }, []);

    useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

    const publishDraft = async (id: number) => {
        await fetch(`/api/places/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ status: "published" }),
        });
        fetchDrafts();
        fetchPlaces(currentPage, false);
    };

    const fetchPlaces = useCallback(async (page: number = 1, append: boolean = false) => {
        setLoading(true);
        try {
            const offset = (page - 1) * itemsPerPage;
            const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : "";
            const res = await fetch(`/api/places?all=1&limit=${itemsPerPage}&offset=${offset}${searchParam}`);
            const data = await res.json();
            if (append) {
                setPlaces((prev) => [...prev, ...(data?.places || [])]);
            } else {
                setPlaces(data?.places || []);
            }
            setTotalCount(data?.total || 0);
            setHasMore(data?.hasMore || false);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, itemsPerPage]);

    useEffect(() => {
        setCurrentPage(1);
        fetchPlaces(1, false);
    }, [searchQuery, fetchPlaces]);

    useEffect(() => {
        fetchPlaces(currentPage, false);
    }, [currentPage, fetchPlaces]);

    const goToPage = (page: number) => {
        if (page >= 1 && page <= Math.ceil(totalCount / itemsPerPage)) {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

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

    const toggleDay = (day: number) => {
        setOpenDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
        );
    };

    const startEdit = async (place: Place) => {
        setEditingId(place.id);
        setFormData({
            name: place.name || "",
            name_en: place.name_en || "",
            name_ja: place.name_ja || "",
            name_zh: place.name_zh || "",
            address: place.address || "",
            address_en: place.address_en || "",
            address_ja: place.address_ja || "",
            address_zh: place.address_zh || "",
            description: place.description || "",
            description_en: place.description_en || "",
            description_ja: place.description_ja || "",
            description_zh: place.description_zh || "",
            category: place.category || "",
            avg_cost_range: place.avg_cost_range || "",
            opening_hours: place.opening_hours || "",
            phone: place.phone || "",
            website: place.website || "",
            reservation_required: place.reservation_required || false,
            reservationUrl: place.reservationUrl || "",
            parking_available: place.parking_available || false,
            latitude: place.latitude ?? undefined,
            longitude: place.longitude ?? undefined,
            imageUrl: place.imageUrl || "",
        });

        const { openTime: ot, closeTime: ct } = parseOpeningHoursTime(place.opening_hours);
        setOpenTime(ot);
        setCloseTime(ct);

        try {
            const res = await fetch(`/api/places/${place.id}`, { credentials: "include" });
            const data = await res.json();
            const closedDowList: number[] = (data?.place?.closed_days || [])
                .map((d: { day_of_week: number | null }) => d.day_of_week)
                .filter((d: number | null) => d !== null);
            setOpenDays(ALL_DAYS.filter((d) => !closedDowList.includes(d)));
        } catch {
            setOpenDays([1, 2, 3, 4, 5, 6]);
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleAutofill = async () => {
        if (!formData.name.trim()) {
            alert("장소 이름을 먼저 입력해주세요.");
            return;
        }
        setIsAutofilling(true);
        try {
            const res = await fetch("/api/admin/places/autofill", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ name: formData.name.trim() }),
            });
            const data = await res.json();
            if (res.status === 409) {
                alert(`이미 등록된 장소입니다. (ID: ${data.existingId})`);
                return;
            }
            if (!res.ok) throw new Error(data.error || "자동완성 실패");

            const d = data.data;
            setFormData((prev) => ({
                ...prev,
                name: d.name || prev.name,
                name_en: d.name_en || prev.name_en,
                name_ja: d.name_ja || prev.name_ja,
                name_zh: d.name_zh || prev.name_zh,
                address: d.address || prev.address,
                address_en: d.address_en || prev.address_en,
                address_ja: d.address_ja || prev.address_ja,
                address_zh: d.address_zh || prev.address_zh,
                phone: d.phone || prev.phone,
                website: d.website || prev.website,
                reservation_required: d.reservation_required !== undefined ? d.reservation_required : prev.reservation_required,
                reservationUrl: d.reservationUrl || prev.reservationUrl,
                latitude: d.latitude ?? prev.latitude,
                longitude: d.longitude ?? prev.longitude,
                category: d.category || prev.category,
                description: d.description || prev.description,
                description_en: d.description_en || prev.description_en,
                description_ja: d.description_ja || prev.description_ja,
                description_zh: d.description_zh || prev.description_zh,
                avg_cost_range: d.avg_cost_range || prev.avg_cost_range,
            }));

            if (d.opening_hours) {
                const { openTime: ot, closeTime: ct } = parseOpeningHoursTime(d.opening_hours);
                setOpenTime(ot);
                setCloseTime(ct);
            }
            if (d.closed_days) {
                const closedDowList: number[] = d.closed_days
                    .map((c: { day_of_week: number | null }) => c.day_of_week)
                    .filter((v: number | null) => v !== null);
                setOpenDays(ALL_DAYS.filter((day) => !closedDowList.includes(day)));
            }
        } catch (e: any) {
            alert(`자동완성 실패: ${e.message}`);
        } finally {
            setIsAutofilling(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch("/api/upload/place-image", {
                method: "POST",
                credentials: "include",
                body: form,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "업로드 실패");
            setFormData((prev) => ({ ...prev, imageUrl: data.url }));
        } catch (err: any) {
            alert("이미지 업로드 실패: " + err.message);
        } finally {
            setIsUploading(false);
            if (imageInputRef.current) imageInputRef.current.value = "";
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormData(INITIAL_PLACE);
        setOpenTime("10:00");
        setCloseTime("21:00");
        setOpenDays([1, 2, 3, 4, 5, 6]);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("정말 이 장소를 삭제하시겠습니까?")) return;
        try {
            const res = await fetch(`/api/places/${id}`, { method: "DELETE", credentials: "include" });
            if (res.ok) {
                alert("삭제되었습니다.");
                fetchPlaces(currentPage, false);
                if (editingId === id) cancelEdit();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const url = editingId ? `/api/places/${editingId}` : "/api/places";
            const method = editingId ? "PATCH" : "POST";

            const opening_hours = openTime && closeTime ? `${openTime}-${closeTime}` : "";
            const closed_days = ALL_DAYS
                .filter((d) => !openDays.includes(d))
                .map((d) => ({ day_of_week: d, specific_date: null, note: null }));

            const payload = { ...formData, opening_hours, closed_days };
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                alert(editingId ? "장소가 수정되었습니다." : "장소 생성 완료");
                setFormData(INITIAL_PLACE);
                setOpenTime("10:00");
                setCloseTime("21:00");
                setOpenDays([1, 2, 3, 4, 5, 6]);
                setEditingId(null);
                fetchPlaces(currentPage, false);
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

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-gray-700">
                        {editingId ? `🔄 장소 수정 (ID: ${editingId})` : "📍 새 장소 등록"}
                    </h2>
                    {editingId && (
                        <button onClick={cancelEdit} className="text-sm underline text-gray-500">취소</button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-sm font-medium text-gray-600">장소 이름 *</label>
                            <div className="flex gap-2">
                                <input
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="flex-1 border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={handleAutofill}
                                    disabled={isAutofilling}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded disabled:bg-gray-400 whitespace-nowrap"
                                >
                                    {isAutofilling ? "AI 분석 중..." : "AI 자동완성"}
                                </button>
                            </div>
                            <p className="text-xs text-gray-400">장소명 입력 후 버튼을 누르면 주소·설명 등을 자동으로 채워드립니다.</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">카테고리</label>
                            <select
                                name="category"
                                value={formData.category || ""}
                                onChange={handleInputChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none bg-white"
                            >
                                <option value="">선택하세요</option>
                                <option value="음식점">음식점</option>
                                <option value="카페">카페</option>
                                <option value="주점">주점</option>
                                <option value="쇼핑">쇼핑</option>
                                <option value="실내명소">실내명소</option>
                                <option value="야외명소">야외명소</option>
                                <option value="이색데이트">이색데이트</option>
                                <option value="액티비티">액티비티</option>
                                <option value="사진관">사진관</option>
                                <option value="향수">향수</option>
                                <option value="야경">야경</option>
                                <option value="식물원">식물원</option>
                                <option value="시장">시장</option>
                                <option value="소품샵">소품샵</option>
                            </select>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-sm font-medium text-gray-600">주소 (한국어)</label>
                            <input
                                name="address"
                                placeholder="도로명 주소"
                                value={formData.address || ""}
                                onChange={handleInputChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-sm font-medium text-gray-600">주소 (English)</label>
                            <input name="address_en" value={formData.address_en || ""} onChange={handleInputChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-sm font-medium text-gray-600">주소 (日本語)</label>
                            <input name="address_ja" value={formData.address_ja || ""} onChange={handleInputChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-sm font-medium text-gray-600">주소 (中文)</label>
                            <input name="address_zh" value={formData.address_zh || ""} onChange={handleInputChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>

                        <div className="space-y-1 md:col-span-2 border-t border-gray-100 pt-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">장소명 다국어</p>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-sm font-medium text-gray-600">장소명 (English)</label>
                            <input name="name_en" value={formData.name_en || ""} onChange={handleInputChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-sm font-medium text-gray-600">장소명 (日本語)</label>
                            <input name="name_ja" value={formData.name_ja || ""} onChange={handleInputChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-sm font-medium text-gray-600">장소명 (中文)</label>
                            <input name="name_zh" value={formData.name_zh || ""} onChange={handleInputChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">전화번호</label>
                            <input name="phone" placeholder="02-0000-0000" value={formData.phone || ""} onChange={handleInputChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">웹사이트</label>
                            <input name="website" placeholder="https://..." value={formData.website || ""} onChange={handleInputChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-sm font-medium text-gray-600">예약 URL</label>
                            <input name="reservationUrl" placeholder="https://..." value={formData.reservationUrl || ""} onChange={handleInputChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>

                        {/* 영업시간 + 요일 */}
                        <div className="space-y-3 md:col-span-2">
                            <label className="text-sm font-medium text-gray-600">영업 시간</label>
                            <div className="flex items-center gap-3 flex-wrap">
                                <input
                                    type="time"
                                    value={openTime}
                                    onChange={(e) => setOpenTime(e.target.value)}
                                    className="border p-1.5 rounded text-sm"
                                />
                                <span className="text-gray-400">~</span>
                                <input
                                    type="time"
                                    value={closeTime}
                                    onChange={(e) => setCloseTime(e.target.value)}
                                    className="border p-1.5 rounded text-sm"
                                />
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {DAY_NAMES.map((name, d) => (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => toggleDay(d)}
                                        className={`w-10 h-10 rounded-full text-sm font-medium border transition-colors ${
                                            openDays.includes(d)
                                                ? "bg-green-600 text-white border-green-600"
                                                : "bg-white text-gray-400 border-gray-300"
                                        }`}
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-400">색칠된 요일 = 영업일 / 회색 요일 = 자동으로 휴무일 저장</p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">가격대</label>
                            <input
                                name="avg_cost_range"
                                placeholder="예: 10,000 - 20,000"
                                value={formData.avg_cost_range || ""}
                                onChange={handleInputChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">위도 (Latitude)</label>
                            <input type="number" step="any" name="latitude" value={formData.latitude ?? ""} onChange={handleNumberChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">경도 (Longitude)</label>
                            <input type="number" step="any" name="longitude" value={formData.longitude ?? ""} onChange={handleNumberChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>

                        <div className="flex gap-6 items-center pt-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="parking_available" checked={formData.parking_available || false} onChange={handleCheckboxChange} className="w-5 h-5 text-green-600 rounded" />
                                <span className="text-sm text-gray-700">주차 가능</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="reservation_required" checked={formData.reservation_required || false} onChange={handleCheckboxChange} className="w-5 h-5 text-green-600 rounded" />
                                <span className="text-sm text-gray-700">예약 필수</span>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">이미지</label>
                        <div className="flex gap-2">
                            <input
                                name="imageUrl"
                                value={formData.imageUrl || ""}
                                onChange={handleInputChange}
                                placeholder="S3 URL 자동 입력 또는 직접 입력"
                                className="flex-1 border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => imageInputRef.current?.click()}
                                disabled={isUploading}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded disabled:bg-gray-400 whitespace-nowrap"
                            >
                                {isUploading ? "업로드 중..." : "사진 업로드"}
                            </button>
                            <input ref={imageInputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleImageUpload} />
                        </div>
                        {formData.imageUrl && (
                            <img src={formData.imageUrl} alt="미리보기" className="mt-2 h-32 w-auto rounded object-cover border" />
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">설명 (한국어)</label>
                        <textarea name="description" value={formData.description || ""} onChange={handleInputChange} rows={3} className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">설명 (English)</label>
                        <textarea name="description_en" value={formData.description_en || ""} onChange={handleInputChange} rows={3} className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">설명 (日本語)</label>
                        <textarea name="description_ja" value={formData.description_ja || ""} onChange={handleInputChange} rows={3} className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">설명 (中文)</label>
                        <textarea name="description_zh" value={formData.description_zh || ""} onChange={handleInputChange} rows={3} className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>

                    <button
                        disabled={isSubmitting}
                        className={`w-full py-3 rounded-lg font-bold text-white transition-all ${
                            isSubmitting ? "bg-gray-400" : editingId ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"
                        }`}
                    >
                        {isSubmitting ? "처리 중..." : editingId ? "장소 수정 완료" : "장소 저장하기"}
                    </button>
                </form>
            </div>

            {/* Draft 섹션 */}
            {drafts.length > 0 && (
                <div className="bg-amber-50 p-6 rounded-xl shadow-sm border border-amber-200">
                    <h2 className="text-lg font-bold text-amber-700 mb-4">
                        📱 발행 대기 ({drafts.length}개) — 텔레그램에서 저장됨
                    </h2>
                    <div className="space-y-3">
                        {drafts.map((p) => (
                            <div key={p.id} className="flex items-center gap-4 bg-white p-4 rounded-lg border border-amber-200">
                                {p.imageUrl && (
                                    <img src={p.imageUrl} alt={p.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-800">{p.name}</p>
                                    <p className="text-sm text-gray-500 truncate">{p.address}</p>
                                    <p className="text-xs text-gray-400">{p.category}</p>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                    <button onClick={() => startEdit(p)} className="px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-700 text-sm">수정</button>
                                    <button onClick={() => publishDraft(p.id)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium">발행</button>
                                    <button onClick={() => handleDelete(p.id)} className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded hover:bg-red-100 text-sm">삭제</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 장소 목록 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-700">
                        장소 목록 (전체 {totalCount}개, 현재 {places.length}개 표시)
                    </h2>
                </div>

                <div className="mb-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="장소 이름으로 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none pl-10"
                        />
                        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {loading && places.length === 0 ? (
                    <p className="text-center py-8 text-gray-500">로딩 중...</p>
                ) : places.length === 0 ? (
                    <p className="text-center py-8 text-gray-500">등록된 장소가 없습니다.</p>
                ) : (
                    <>
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
                                                <button onClick={() => startEdit(p)} className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-700 text-xs">수정</button>
                                                <button onClick={() => handleDelete(p.id)} className="px-3 py-1 bg-red-50 border border-red-200 text-red-600 rounded hover:bg-red-100 text-xs">삭제</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="text-sm text-gray-600">
                                페이지 {currentPage} / {Math.ceil(totalCount / itemsPerPage) || 1}
                            </div>
                            <div className="flex gap-2 items-center">
                                <button onClick={() => goToPage(1)} disabled={currentPage === 1 || loading} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">처음</button>
                                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1 || loading} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">이전</button>
                                {Array.from({ length: Math.min(5, Math.ceil(totalCount / itemsPerPage)) }, (_, i) => {
                                    const totalPages = Math.ceil(totalCount / itemsPerPage);
                                    let pageNum: number;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (currentPage <= 3) pageNum = i + 1;
                                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                    else pageNum = currentPage - 2 + i;
                                    if (pageNum > totalPages) return null;
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => goToPage(pageNum)}
                                            disabled={loading}
                                            className={`px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 ${currentPage === pageNum ? "bg-green-600 text-white border-green-600" : ""}`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                                <button onClick={() => goToPage(currentPage + 1)} disabled={!hasMore || loading} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">다음</button>
                                <button onClick={() => goToPage(Math.ceil(totalCount / itemsPerPage))} disabled={!hasMore || loading} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">마지막</button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
