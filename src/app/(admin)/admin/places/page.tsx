"use client";

import { useEffect, useState, FormEvent, useCallback } from "react";
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
    parking_available?: boolean;
    latitude?: number | null;
    longitude?: number | null;
    imageUrl?: string | null;
    tags?: any; // jsonb, string[] 또는 object
};

/** 휴무일 한 줄 (폼/API용) - day_of_week: 0=일 ~ 6=토, 요일 휴무만 사용 */
type ClosedDayRow = {
    day_of_week: number | null;
    note: string;
};

/** 영업시간 그룹 - 요일 + 여러 영업 구간 + 선택적 브레이크. 휴무인 요일은 휴무일에서 관리 */
type TimeRange = { open: string; close: string };
type OpeningHourGroup = {
    days: number[];
    ranges: TimeRange[];
    break?: { start: string; end: string };
};

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;

function padTime(t: string): string {
    return t.length === 5 ? t : t.replace(/^(\d):/, "0$1:");
}

/** 세그먼트 문자열 파싱: "월-목: 11:00-14:00, 17:00-21:00 (브레이크 14:00-17:00)" */
function parseSegmentToGroup(seg: string): OpeningHourGroup | null {
    const breakRegex = /\s*\(브레이크\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\)\s*$/;
    const breakMatch = seg.match(breakRegex);
    let rest = seg.trim();
    let breakRange: { start: string; end: string } | undefined;
    if (breakMatch) {
        breakRange = {
            start: `${breakMatch[1].padStart(2, "0")}:${breakMatch[2]}`,
            end: `${breakMatch[3].padStart(2, "0")}:${breakMatch[4]}`,
        };
        rest = seg.replace(breakRegex, "").trim();
    }

    const dayRangeMatch = rest.match(/^([월화수목금토일])-([월화수목금토일]):\s*(.+)$/);
    const singleDayMatch = rest.match(/^([월화수목금토일]):\s*(.+)$/);
    let days: number[] = [];
    let timePart = "";

    if (dayRangeMatch) {
        const startIdx = DAY_NAMES.indexOf(dayRangeMatch[1] as (typeof DAY_NAMES)[number]);
        const endIdx = DAY_NAMES.indexOf(dayRangeMatch[2] as (typeof DAY_NAMES)[number]);
        if (startIdx <= endIdx) for (let i = startIdx; i <= endIdx; i++) days.push(i);
        else {
            for (let i = startIdx; i <= 6; i++) days.push(i);
            for (let i = 0; i <= endIdx; i++) days.push(i);
        }
        timePart = dayRangeMatch[3].trim();
    } else if (singleDayMatch) {
        const idx = DAY_NAMES.indexOf(singleDayMatch[1] as (typeof DAY_NAMES)[number]);
        days = [idx];
        timePart = singleDayMatch[2].trim();
    } else return null;

    const ranges: TimeRange[] = [];
    const rangeRegex = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;
    let m: RegExpExecArray | null;
    while ((m = rangeRegex.exec(timePart)) !== null) {
        ranges.push({
            open: `${m[1].padStart(2, "0")}:${m[2]}`,
            close: `${m[3].padStart(2, "0")}:${m[4]}`,
        });
    }
    if (ranges.length === 0) return null;
    return { days, ranges, break: breakRange };
}

/** 기존 opening_hours 문자열을 그룹 배열로 파싱 */
function parseOpeningHoursToGroups(str: string | null | undefined): OpeningHourGroup[] {
    const s = (str || "").trim();
    if (!s) return [];

    // 새 형식: 세그먼트가 ";" 로 구분
    if (s.includes(";")) {
        const segments = s.split(";").map((x) => x.trim()).filter(Boolean);
        const groups: OpeningHourGroup[] = [];
        for (const seg of segments) {
            const g = parseSegmentToGroup(seg);
            if (g) groups.push(g);
        }
        return groups;
    }

    // 단순 형식: "09:00-22:00" 또는 "매일 09:00-22:00"
    const simpleFormat = /^(?:매일\s*)?(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;
    const simpleMatch = s.match(simpleFormat);
    if (simpleMatch && !/[일월화수목금토]/.test(s)) {
        const open = `${simpleMatch[1].padStart(2, "0")}:${simpleMatch[2]}`;
        const close = `${simpleMatch[3].padStart(2, "0")}:${simpleMatch[4]}`;
        return [{ days: [0, 1, 2, 3, 4, 5, 6], ranges: [{ open, close }] }];
    }

    // 요일별 단일 구간 (기존)
    const groups: OpeningHourGroup[] = [];
    const dayRangeRegex = /([월화수목금토일])-([월화수목금토일]):\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;
    let m: RegExpExecArray | null;
    while ((m = dayRangeRegex.exec(s)) !== null) {
        const startIdx = DAY_NAMES.indexOf(m[1] as (typeof DAY_NAMES)[number]);
        const endIdx = DAY_NAMES.indexOf(m[2] as (typeof DAY_NAMES)[number]);
        if (startIdx === -1 || endIdx === -1) continue;
        const days: number[] = [];
        if (startIdx <= endIdx) for (let i = startIdx; i <= endIdx; i++) days.push(i);
        else {
            for (let i = startIdx; i <= 6; i++) days.push(i);
            for (let i = 0; i <= endIdx; i++) days.push(i);
        }
        const open = `${m[3].padStart(2, "0")}:${m[4]}`;
        const close = `${m[5].padStart(2, "0")}:${m[6]}`;
        groups.push({ days, ranges: [{ open, close }] });
    }

    const singleDayRegex = /([월화수목금토일]):\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;
    while ((m = singleDayRegex.exec(s)) !== null) {
        const idx = DAY_NAMES.indexOf(m[1] as (typeof DAY_NAMES)[number]);
        if (idx === -1 || groups.some((g) => g.days.includes(idx))) continue;
        const open = `${m[2].padStart(2, "0")}:${m[3]}`;
        const close = `${m[4].padStart(2, "0")}:${m[5]}`;
        groups.push({ days: [idx], ranges: [{ open, close }] });
    }

    if (groups.length === 0) {
        const everydayMatch = s.match(/매일\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
        if (everydayMatch) {
            const open = `${everydayMatch[1].padStart(2, "0")}:${everydayMatch[2]}`;
            const close = `${everydayMatch[3].padStart(2, "0")}:${everydayMatch[4]}`;
            return [{ days: [0, 1, 2, 3, 4, 5, 6], ranges: [{ open, close }] }];
        }
    }
    return groups;
}

/** 그룹 배열을 opening_hours 문자열로 변환 (placeStatus 파싱 형식) */
function buildOpeningHoursFromGroups(groups: OpeningHourGroup[]): string {
    if (groups.length === 0) return "";

    const segmentParts: string[] = [];
    for (const g of groups) {
        const sorted = [...g.days].sort((a, b) => a - b);
        const dayLabel =
            sorted.length === 1
                ? `${DAY_NAMES[sorted[0]]}`
                : `${DAY_NAMES[sorted[0]]}-${DAY_NAMES[sorted[sorted.length - 1]]}`;
        const rangeStr = g.ranges
            .map((r) => `${padTime(r.open)}-${padTime(r.close)}`)
            .join(", ");
        const breakStr = g.break
            ? ` (브레이크 ${padTime(g.break.start)}-${padTime(g.break.end)})`
            : "";
        segmentParts.push(`${dayLabel}: ${rangeStr}${breakStr}`);
    }
    return segmentParts.join("; ");
}

const INITIAL_PLACE: Omit<Place, "id"> = {
    name: "",
    address: "",
    description: "",
    category: "",
    avg_cost_range: "",
    opening_hours: "",
    phone: "",
    parking_available: false,
    latitude: undefined,
    longitude: undefined,
    imageUrl: "",
    tags: [],
};

const DEFAULT_OPENING_GROUP: OpeningHourGroup = {
    days: [],
    ranges: [{ open: "10:00", close: "21:00" }],
};

export default function AdminPlacesPage() {
    const [places, setPlaces] = useState<Place[]>([]);
    const [formData, setFormData] = useState<Omit<Place, "id">>(INITIAL_PLACE);
    const [openingHourGroups, setOpeningHourGroups] = useState<OpeningHourGroup[]>([]);
    const [closedDays, setClosedDays] = useState<ClosedDayRow[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);

    // 페이징 상태
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const itemsPerPage = 10;
    
    // 검색 상태
    const [searchQuery, setSearchQuery] = useState("");

    // --- 데이터 조회 ---
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
        setCurrentPage(1); // 검색 시 첫 페이지로 리셋
        fetchPlaces(1, false);
    }, [searchQuery, fetchPlaces]);

    useEffect(() => {
        fetchPlaces(currentPage, false);
    }, [currentPage, fetchPlaces]);

    // 다음 페이지 로드
    const loadNextPage = () => {
        if (!loading && hasMore) {
            setCurrentPage((prev) => prev + 1);
        }
    };

    // 페이지 직접 이동
    const goToPage = (page: number) => {
        if (page >= 1 && page <= Math.ceil(totalCount / itemsPerPage)) {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

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

    const startEdit = async (place: Place) => {
        setEditingId(place.id);
        setFormData({
            name: place.name || "",
            address: place.address || "",
            description: place.description || "",
            category: place.category || "",
            avg_cost_range: place.avg_cost_range || "",
            opening_hours: place.opening_hours || "",
            phone: place.phone || "",
            parking_available: place.parking_available || false,
            latitude: place.latitude ?? undefined,
            longitude: place.longitude ?? undefined,
            imageUrl: place.imageUrl || "",
            tags: place.tags || [],
        });
        const parsed = parseOpeningHoursToGroups(place.opening_hours || "");
        setOpeningHourGroups(parsed.length > 0 ? parsed : [{ ...DEFAULT_OPENING_GROUP }]);
        const token = localStorage.getItem("authToken");
        const headers: HeadersInit = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        try {
            const res = await fetch(`/api/places/${place.id}`, { headers, credentials: "include" });
            const data = await res.json();
            if (data?.place?.closed_days?.length) {
                setClosedDays(
                    data.place.closed_days.map((d: { day_of_week: number | null; note: string | null }) => ({
                        day_of_week: d.day_of_week ?? null,
                        note: d.note ?? "",
                    }))
                );
            } else {
                setClosedDays([]);
            }
        } catch {
            setClosedDays([]);
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormData(INITIAL_PLACE);
        setOpeningHourGroups([]);
        setClosedDays([]);
    };

    const addOpeningHourGroup = () => {
        setOpeningHourGroups((prev) => [...prev, { days: [], ranges: [{ open: "10:00", close: "21:00" }] }]);
    };
    const removeOpeningHourGroup = (index: number) => {
        setOpeningHourGroups((prev) => prev.filter((_, i) => i !== index));
    };
    const toggleGroupDay = (index: number, day: number) => {
        setOpeningHourGroups((prev) => {
            const next = [...prev];
            const days = next[index].days.includes(day)
                ? next[index].days.filter((d) => d !== day)
                : [...next[index].days, day].sort((a, b) => a - b);
            next[index] = { ...next[index], days };
            return next;
        });
    };
    const addTimeRangeToGroup = (groupIndex: number) => {
        setOpeningHourGroups((prev) => {
            const next = [...prev];
            next[groupIndex] = {
                ...next[groupIndex],
                ranges: [...next[groupIndex].ranges, { open: "10:00", close: "21:00" }],
            };
            return next;
        });
    };
    const removeTimeRangeFromGroup = (groupIndex: number, rangeIndex: number) => {
        setOpeningHourGroups((prev) => {
            const next = [...prev];
            const ranges = next[groupIndex].ranges.filter((_, i) => i !== rangeIndex);
            if (ranges.length === 0) return prev;
            next[groupIndex] = { ...next[groupIndex], ranges };
            return next;
        });
    };
    const updateTimeRange = (groupIndex: number, rangeIndex: number, field: "open" | "close", value: string) => {
        setOpeningHourGroups((prev) => {
            const next = [...prev];
            const ranges = [...next[groupIndex].ranges];
            ranges[rangeIndex] = { ...ranges[rangeIndex], [field]: value };
            next[groupIndex] = { ...next[groupIndex], ranges };
            return next;
        });
    };
    const setGroupBreak = (groupIndex: number, breakRange: { start: string; end: string } | null) => {
        setOpeningHourGroups((prev) => {
            const next = [...prev];
            next[groupIndex] = { ...next[groupIndex], break: breakRange ?? undefined };
            return next;
        });
    };

    const addClosedDayRow = () => {
        setClosedDays((prev) => [...prev, { day_of_week: null, note: "" }]);
    };
    const removeClosedDayRow = (index: number) => {
        setClosedDays((prev) => prev.filter((_, i) => i !== index));
    };
    const updateClosedDayRow = (index: number, field: keyof ClosedDayRow, value: number | string | null) => {
        setClosedDays((prev) => {
            const next = [...prev];
            if (field === "day_of_week") next[index] = { ...next[index], day_of_week: value as number | null };
            else if (field === "note") next[index] = { ...next[index], note: String(value ?? "") };
            return next;
        });
    };

    const handleDelete = async (id: number) => {
        if (!confirm("정말 이 장소를 삭제하시겠습니까?")) return;
        const token = localStorage.getItem("authToken");
        try {
            const headers: HeadersInit = {};
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const res = await fetch(`/api/places/${id}`, {
                method: "DELETE",
                headers,
                credentials: "include", // 쿠키도 함께 전송 (admin 인증용)
            });
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
        const token = localStorage.getItem("authToken");
        try {
            const url = editingId ? `/api/places/${editingId}` : "/api/places";
            const method = editingId ? "PATCH" : "POST";

            const headers: HeadersInit = { "Content-Type": "application/json" };
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const payload = {
                ...formData,
                opening_hours: buildOpeningHoursFromGroups(openingHourGroups),
                closed_days: closedDays
                    .filter((row) => row.day_of_week !== null || (row.note && row.note.trim()))
                    .map((row) => ({
                        day_of_week: row.day_of_week,
                        specific_date: null,
                        note: row.note && row.note.trim() ? row.note.trim() : null,
                    })),
            };
            const res = await fetch(url, {
                method: method,
                headers,
                credentials: "include", // 쿠키도 함께 전송 (admin 인증용)
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                alert(editingId ? "장소가 수정되었습니다." : "장소 생성 완료");
                setFormData(INITIAL_PLACE);
                setOpeningHourGroups([]);
                setClosedDays([]);
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

                        {/* 영업 시간 (요일별 그룹) */}
                        <div className="space-y-3 md:col-span-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-600">영업 시간</label>
                                <button
                                    type="button"
                                    onClick={addOpeningHourGroup}
                                    className="text-sm text-green-600 hover:text-green-700 font-medium"
                                >
                                    + 그룹 추가
                                </button>
                            </div>
                            <p className="text-xs text-gray-500">
                                영업하는 요일끼리 묶고, 시간대를 여러 개 넣을 수 있습니다. 브레이크가 있으면 &quot;브레이크&quot;를 추가하세요. 휴무인 요일은 아래 &quot;쉬는 날&quot;에서 추가하세요.
                            </p>
                            {openingHourGroups.length === 0 ? (
                                <p className="text-sm text-gray-500 py-2">그룹을 추가한 뒤 요일과 시간을 입력하세요.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {openingHourGroups.map((group, index) => (
                                        <li
                                            key={index}
                                            className="flex flex-col gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                                        >
                                            <div className="flex flex-wrap items-center gap-3">
                                                <span className="text-xs font-medium text-gray-500">요일</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {DAY_NAMES.map((name, d) => (
                                                        <label key={d} className="flex items-center gap-1 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={group.days.includes(d)}
                                                                onChange={() => toggleGroupDay(index, d)}
                                                                className="rounded border-gray-300 text-green-600"
                                                            />
                                                            <span className="text-sm">{name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeOpeningHourGroup(index)}
                                                    className="text-red-600 hover:text-red-700 text-sm shrink-0 ml-auto"
                                                >
                                                    그룹 삭제
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                <span className="text-xs font-medium text-gray-500 block">영업 시간대</span>
                                                {group.ranges.map((range, ri) => (
                                                    <div key={ri} className="flex items-center gap-2 flex-wrap">
                                                        <input
                                                            type="time"
                                                            value={range.open}
                                                            onChange={(e) => updateTimeRange(index, ri, "open", e.target.value)}
                                                            className="border p-1.5 rounded text-sm"
                                                        />
                                                        <span className="text-gray-400">~</span>
                                                        <input
                                                            type="time"
                                                            value={range.close}
                                                            onChange={(e) => updateTimeRange(index, ri, "close", e.target.value)}
                                                            className="border p-1.5 rounded text-sm"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => removeTimeRangeFromGroup(index, ri)}
                                                            disabled={group.ranges.length <= 1}
                                                            className="text-red-600 hover:text-red-700 text-sm disabled:opacity-40"
                                                        >
                                                            삭제
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={() => addTimeRangeToGroup(index)}
                                                    className="text-sm text-green-600 hover:text-green-700 font-medium"
                                                >
                                                    + 시간대 추가
                                                </button>
                                            </div>
                                            <div className="border-t border-gray-200 pt-2">
                                                <span className="text-xs font-medium text-gray-500 block mb-1">브레이크 (선택)</span>
                                                {group.break ? (
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <input
                                                            type="time"
                                                            value={group.break.start}
                                                            onChange={(e) =>
                                                                setGroupBreak(index, { ...group.break!, start: e.target.value })
                                                            }
                                                            className="border p-1.5 rounded text-sm"
                                                        />
                                                        <span className="text-gray-400">~</span>
                                                        <input
                                                            type="time"
                                                            value={group.break.end}
                                                            onChange={(e) =>
                                                                setGroupBreak(index, { ...group.break!, end: e.target.value })
                                                            }
                                                            className="border p-1.5 rounded text-sm"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setGroupBreak(index, null)}
                                                            className="text-red-600 hover:text-red-700 text-sm"
                                                        >
                                                            브레이크 제거
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setGroupBreak(index, { start: "14:00", end: "17:00" })}
                                                        className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                                                    >
                                                        + 브레이크 추가
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
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
                    </div>

                    {/* 쉬는 날 (휴무일) */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-600">쉬는 날 (휴무일)</label>
                            <button
                                type="button"
                                onClick={addClosedDayRow}
                                className="text-sm text-green-600 hover:text-green-700 font-medium"
                            >
                                + 휴무일 추가
                            </button>
                        </div>
                        {closedDays.length === 0 ? (
                            <p className="text-xs text-gray-500">휴무일이 없으면 비워두세요. 추가 버튼으로 요일·비고를 입력할 수 있습니다.</p>
                        ) : (
                            <ul className="space-y-2">
                                {closedDays.map((row, index) => (
                                    <li key={index} className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                                        <select
                                            value={row.day_of_week ?? ""}
                                            onChange={(e) => updateClosedDayRow(index, "day_of_week", e.target.value === "" ? null : Number(e.target.value))}
                                            className="border p-1.5 rounded text-sm min-w-[100px]"
                                        >
                                            <option value="">요일 선택</option>
                                            <option value="0">일요일</option>
                                            <option value="1">월요일</option>
                                            <option value="2">화요일</option>
                                            <option value="3">수요일</option>
                                            <option value="4">목요일</option>
                                            <option value="5">금요일</option>
                                            <option value="6">토요일</option>
                                        </select>
                                        <input
                                            type="text"
                                            placeholder="비고 (선택)"
                                            value={row.note}
                                            onChange={(e) => updateClosedDayRow(index, "note", e.target.value)}
                                            className="flex-1 min-w-[120px] border p-1.5 rounded text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeClosedDayRow(index)}
                                            className="text-red-600 hover:text-red-700 text-sm"
                                        >
                                            삭제
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-700">
                        장소 목록 (전체 {totalCount}개, 현재 {places.length}개 표시)
                    </h2>
                </div>
                
                {/* 검색 입력 필드 */}
                <div className="mb-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="장소 이름으로 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none pl-10"
                        />
                        <svg
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
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
                                            <td className="p-3 border-b text-gray-500 truncate max-w-xs">
                                                {p.address}
                                            </td>
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

                        {/* 페이지네이션 */}
                        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="text-sm text-gray-600">
                                페이지 {currentPage} / {Math.ceil(totalCount / itemsPerPage) || 1}
                            </div>

                            <div className="flex gap-2 items-center">
                                <button
                                    onClick={() => goToPage(1)}
                                    disabled={currentPage === 1 || loading}
                                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    처음
                                </button>
                                <button
                                    onClick={() => goToPage(currentPage - 1)}
                                    disabled={currentPage === 1 || loading}
                                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    이전
                                </button>

                                {/* 페이지 번호 버튼 (현재 페이지 ±2 범위) */}
                                {Array.from({ length: Math.min(5, Math.ceil(totalCount / itemsPerPage)) }, (_, i) => {
                                    const totalPages = Math.ceil(totalCount / itemsPerPage);
                                    let pageNum: number;

                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }

                                    if (pageNum > totalPages) return null;

                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => goToPage(pageNum)}
                                            disabled={loading}
                                            className={`px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${
                                                currentPage === pageNum
                                                    ? "bg-green-600 text-white border-green-600"
                                                    : ""
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}

                                <button
                                    onClick={() => goToPage(currentPage + 1)}
                                    disabled={!hasMore || loading}
                                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    다음
                                </button>
                                <button
                                    onClick={() => goToPage(Math.ceil(totalCount / itemsPerPage))}
                                    disabled={!hasMore || loading}
                                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    마지막
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
