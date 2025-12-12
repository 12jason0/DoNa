"use client";

import { useEffect, useState, FormEvent } from "react";
import type { DoNaCourseTags, ConceptTag, MoodTag, TargetTag, BudgetTag } from "@/types/tag";

// --- 1. 선택지 상수 정의 ---
const CONCEPT_OPTIONS: ConceptTag[] = [
    "실내",
    "야외",
    "복합",
    "활동적인",
    "정적인",
    "맛집",
    "카페",
    "주점",
    "전시",
    "복합문화공간",
    "쇼핑",
    "팝업",
    "체험",
    "공연",
    "테마파크",
    "힐링",
    "이색체험",
    "맛집탐방",
    "인생샷",
    "기념일",
    "소개팅",
    "빵지순례",
];

const MOOD_OPTIONS: MoodTag[] = [
    "로맨틱",
    "힙한",
    "트렌디한",
    "조용한",
    "활기찬",
    "레트로",
    "고급스러운",
    "감성",
    "편안한",
    "이국적인",
    "전통적인",
    "신비로운",
];

const TARGET_OPTIONS: TargetTag[] = ["연인", "썸", "친구", "가족", "혼자", "반려동물", "단체/모임"];

const BUDGET_OPTIONS: BudgetTag[] = ["3만원 이하", "3~6만원", "6~10만원", "10~20만원", "20만원 이상"];

// --- 2. 타입 정의 ---

// ✅ DB: course_places 테이블 구조와 매핑되는 타입
type LinkedPlace = {
    // JOIN된 장소 정보
    place: {
        id: number;
        name: string;
        category?: string;
    };
    // course_places 테이블의 컬럼들
    order_index: number;
    estimated_duration?: number;
    recommended_time?: string;
    notes?: string;
};

// 단순 장소 선택용 (드롭다운)
type SimplePlace = {
    id: number;
    name: string;
    category?: string;
};

type Course = {
    id: number;
    title: string;
    sub_title?: string | null;
    description?: string | null;
    target_situation?: string | null;
    concept?: string | null;
    region?: string | null;
    duration?: string | null;
    imageUrl?: string | null;
    tags?: DoNaCourseTags | null;
    is_editor_pick?: boolean;
    places?: LinkedPlace[]; // 화면 표시용 (DB 저장시엔 별도 로직)
    placesCount?: number;
};

const INITIAL_TAGS: DoNaCourseTags = {
    concept: [],
    mood: [],
    target: [],
    budget: "3~6만원",
};

const INITIAL_COURSE: Omit<Course, "id"> = {
    title: "",
    sub_title: "",
    description: "",
    target_situation: "",
    concept: "",
    region: "",
    duration: "",
    imageUrl: "",
    tags: INITIAL_TAGS,
    is_editor_pick: false,
    places: [],
};

export default function AdminCoursesPage() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [allPlaces, setAllPlaces] = useState<SimplePlace[]>([]);
    const [formData, setFormData] = useState<Omit<Course, "id">>(INITIAL_COURSE);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- 장소 추가용 State (course_places 컬럼들) ---
    const [addPlaceId, setAddPlaceId] = useState<number | "">("");
    const [addOrder, setAddOrder] = useState<number>(1);
    const [addDuration, setAddDuration] = useState<number | "">("");
    const [addRecTime, setAddRecTime] = useState<string>(""); // recommended_time
    const [addNotes, setAddNotes] = useState<string>(""); // notes

    // --- 데이터 불러오기 ---
    const fetchCourses = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/admin/courses");
            const data = await res.json();
            setCourses(data as Course[]);
        } catch (e) {
            console.error("코스 로딩 실패:", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllPlaces = async () => {
        try {
            const res = await fetch("/api/places?all=1&limit=300");
            const data = await res.json();
            setAllPlaces(data?.places || []);
        } catch (e) {
            console.error(e);
        }
    };

    // ✅ 특정 코스의 장소 목록(course_places)만 따로 불러오는 함수
    const fetchCoursePlaces = async (courseId: number) => {
        try {
            // 이 API는 course_places 테이블을 조회해서 place 정보를 join해와야 함
            const res = await fetch(`/api/courses/${courseId}/places`);
            if (res.ok) {
                const data = await res.json(); // LinkedPlace[] 형태여야 함
                setFormData((prev) => ({ ...prev, places: data.places || [] }));

                // 다음 순서 자동 계산
                const nextOrder = (data.places?.length || 0) + 1;
                setAddOrder(nextOrder);
            }
        } catch (e) {
            console.error("장소 목록 로딩 실패:", e);
        }
    };

    useEffect(() => {
        fetchCourses();
        fetchAllPlaces();
    }, []);

    // --- 입력 핸들러 ---
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setFormData((prev) => ({ ...prev, [name]: checked }));
    };

    // --- 태그 선택 핸들러 ---
    const toggleArrayTag = (category: "concept" | "mood" | "target", tag: string) => {
        setFormData((prev) => {
            const currentTags = prev.tags || INITIAL_TAGS;
            const categoryTags = (currentTags[category] as string[]) || [];
            let newCategoryTags;
            if (categoryTags.includes(tag)) {
                newCategoryTags = categoryTags.filter((t) => t !== tag);
            } else {
                newCategoryTags = [...categoryTags, tag];
            }
            return { ...prev, tags: { ...currentTags, [category]: newCategoryTags } };
        });
    };

    const setBudgetTag = (tag: BudgetTag) => {
        setFormData((prev) => {
            const currentTags = prev.tags || INITIAL_TAGS;
            return { ...prev, tags: { ...currentTags, budget: tag } };
        });
    };

    // --- 수정 모드 진입 ---
    const startEdit = async (courseSummary: Course) => {
        setEditingId(courseSummary.id);

        try {
            // ✅ 새로 만든 관리자용 상세 조회 API 호출
            const res = await fetch(`/api/admin/courses/${courseSummary.id}`);
            if (!res.ok) throw new Error("코스 정보를 불러오지 못했습니다.");

            const courseDetail = await res.json();

            // 받아온 최신 상세 정보로 폼 채우기
            const safeTags = { ...INITIAL_TAGS, ...(courseDetail.tags || {}) };

            setFormData({
                title: courseDetail.title || "",
                sub_title: courseDetail.sub_title || "",
                description: courseDetail.description || "",
                target_situation: courseDetail.target_situation || "",
                concept: courseDetail.concept || "",
                region: courseDetail.region || "",
                duration: courseDetail.duration || "",
                imageUrl: courseDetail.imageUrl || "",
                tags: safeTags,
                is_editor_pick: courseDetail.is_editor_pick || false,

                // ✅ API에서 include로 가져온 places (coursePlaces) 데이터를 바로 넣음
                // 백엔드에서 places: course.coursePlaces로 매핑해서 보냈으므로 그대로 사용
                places: courseDetail.places || [],
            });

            // 추가 폼 초기화
            setAddPlaceId("");
            setAddDuration("");
            setAddRecTime("");
            setAddNotes("");

            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (e) {
            console.error(e);
            alert("코스 상세 정보를 불러오는 중 오류가 발생했습니다.");
            setEditingId(null);
        }
    };
    // --- 취소 핸들러 ---
    const cancelEdit = () => {
        setEditingId(null);
        setFormData(INITIAL_COURSE);
        setAddPlaceId("");
    };

    // --- 코스 삭제 ---
    const handleDelete = async (id: number) => {
        if (!confirm("정말 이 코스를 삭제하시겠습니까?")) return;
        const token = localStorage.getItem("authToken");
        try {
            const res = await fetch(`/api/courses/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                alert("삭제되었습니다.");
                fetchCourses();
                if (editingId === id) cancelEdit();
            } else {
                alert("삭제 실패");
            }
        } catch (e) {
            console.error(e);
        }
    };

    // --- 코스 기본 정보 저장 ---
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const token = localStorage.getItem("authToken");

        try {
            const url = editingId ? `/api/courses/${editingId}` : "/api/courses";
            const method = editingId ? "PATCH" : "POST";

            // places는 별도 API로 관리하므로 body에서 제외
            const { places, ...bodyData } = formData;

            const res = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(bodyData),
            });

            if (res.ok) {
                alert(editingId ? "코스 정보가 수정되었습니다." : "새 코스가 생성되었습니다.");
                if (!editingId) {
                    setFormData(INITIAL_COURSE);
                    fetchCourses();
                } else {
                    // 수정 상태 유지 (장소 관리를 위해)
                    fetchCourses();
                }
            } else {
                const errorData = await res.json();
                alert(`실패: ${errorData.error || "알 수 없는 오류"}`);
            }
        } catch (e) {
            console.error(e);
            alert("네트워크 오류 발생");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- [하위 기능] 코스에 장소 추가 (course_places 테이블 저장) ---
    const handleAddPlaceToCourse = async () => {
        if (!editingId) return alert("코스를 먼저 생성하거나 수정 모드여야 합니다.");
        if (!addPlaceId) return alert("장소를 선택해주세요.");

        const token = localStorage.getItem("authToken");
        try {
            // POST /api/courses/[id]/places -> course_places 테이블에 insert
            const res = await fetch(`/api/courses/${editingId}/places`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    place_id: Number(addPlaceId),
                    order_index: Number(addOrder),
                    estimated_duration: addDuration ? Number(addDuration) : undefined,
                    recommended_time: addRecTime || undefined,
                    notes: addNotes || undefined,
                }),
            });

            if (res.ok) {
                alert("장소가 추가되었습니다.");
                // 리스트 갱신
                await fetchCoursePlaces(editingId);

                // 입력폼 초기화
                setAddPlaceId("");
                setAddDuration("");
                setAddRecTime("");
                setAddNotes("");
            } else {
                const err = await res.json();
                alert(err.error || "추가 실패");
            }
        } catch (e) {
            console.error(e);
        }
    };

    // --- [하위 기능] 코스에서 장소 제거 ---
    const handleRemovePlaceFromCourse = async (placeId: number) => {
        if (!editingId || !confirm("정말 이 장소를 코스에서 뺄까요?")) return;
        const token = localStorage.getItem("authToken");
        try {
            const res = await fetch(`/api/courses/${editingId}/places/${placeId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                await fetchCoursePlaces(editingId); // 리스트 갱신
            } else {
                alert("제거 실패");
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-12 pb-20">
            <h1 className="text-2xl font-bold text-gray-800">코스 데이터 관리</h1>

            {/* --- 입력 폼 --- */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-gray-700">
                        {editingId ? `🔄 코스 수정 (ID: ${editingId})` : "✨ 새 코스 추가"}
                    </h2>
                    {editingId && (
                        <button onClick={cancelEdit} className="text-sm text-gray-500 underline hover:text-gray-700">
                            수정 취소하고 초기화
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* 1. 기본 정보 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">코스 제목 *</label>
                            <input
                                name="title"
                                value={formData.title}
                                onChange={handleInputChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">지역</label>
                            <input
                                name="region"
                                placeholder="예: 성수, 홍대"
                                value={formData.region || ""}
                                onChange={handleInputChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">소요시간</label>
                            <input
                                name="duration"
                                placeholder="예: 3시간"
                                value={formData.duration || ""}
                                onChange={handleInputChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="border-t border-gray-100 my-4"></div>

                    {/* 2. 태그 선택 섹션 */}
                    <div className="space-y-6">
                        <h3 className="font-bold text-gray-800">🏷️ 태그 선택</h3>
                        {/* Concept */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-green-700">Concept</label>
                            <div className="flex flex-wrap gap-2">
                                {CONCEPT_OPTIONS.map((tag) => (
                                    <button
                                        type="button"
                                        key={tag}
                                        onClick={() => toggleArrayTag("concept", tag)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                                            formData.tags?.concept?.includes(tag)
                                                ? "bg-green-600 text-white border-green-600"
                                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                        }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Mood, Target, Budget (생략 없이 위와 동일한 패턴으로 구현됨) */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-purple-700">Mood</label>
                            <div className="flex flex-wrap gap-2">
                                {MOOD_OPTIONS.map((tag) => (
                                    <button
                                        type="button"
                                        key={tag}
                                        onClick={() => toggleArrayTag("mood", tag)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                                            formData.tags?.mood?.includes(tag)
                                                ? "bg-purple-600 text-white border-purple-600"
                                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                        }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-blue-700">Target</label>
                            <div className="flex flex-wrap gap-2">
                                {TARGET_OPTIONS.map((tag) => (
                                    <button
                                        type="button"
                                        key={tag}
                                        onClick={() => toggleArrayTag("target", tag)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                                            formData.tags?.target?.includes(tag)
                                                ? "bg-blue-600 text-white border-blue-600"
                                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                        }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-orange-700">Budget</label>
                            <div className="flex flex-wrap gap-2">
                                {BUDGET_OPTIONS.map((tag) => (
                                    <button
                                        type="button"
                                        key={tag}
                                        onClick={() => setBudgetTag(tag)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                                            formData.tags?.budget === tag
                                                ? "bg-orange-500 text-white border-orange-500"
                                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                        }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 my-4"></div>

                    {/* 3. 상세 정보 및 이미지 */}
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">설명 (Description)</label>
                            <textarea
                                name="description"
                                value={formData.description || ""}
                                onChange={handleInputChange}
                                rows={3}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-600">이미지 URL</label>
                                <input
                                    name="imageUrl"
                                    value={formData.imageUrl || ""}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                />
                            </div>
                            <div className="flex items-center space-x-3 pt-6">
                                <input
                                    type="checkbox"
                                    id="is_editor_pick"
                                    name="is_editor_pick"
                                    checked={formData.is_editor_pick}
                                    onChange={handleCheckboxChange}
                                    className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                                />
                                <label
                                    htmlFor="is_editor_pick"
                                    className="text-sm font-medium text-gray-700 cursor-pointer"
                                >
                                    에디터 픽 (추천 코스)
                                </label>
                            </div>
                        </div>
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
                        {isSubmitting
                            ? "처리 중..."
                            : editingId
                            ? "코스 기본정보 수정 완료"
                            : "코스 생성하기 (생성 후 장소 추가)"}
                    </button>
                </form>

                {/* 4. ✅ 코스 구성 (장소 관리) 섹션 - course_places 테이블 연동 */}
                {editingId && (
                    <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-200">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">📍 코스 구성 (장소 목록)</h3>

                        {/* 현재 연결된 장소 목록 */}
                        {formData.places && formData.places.length > 0 ? (
                            <div className="space-y-2 mb-6">
                                {formData.places
                                    .sort((a, b) => a.order_index - b.order_index)
                                    .map((item) => (
                                        <div
                                            key={item.place.id}
                                            className="flex items-center justify-between bg-gray-50 p-3 rounded border hover:border-green-300 transition"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 flex items-center justify-center bg-green-100 text-green-700 font-bold rounded-full shadow-sm">
                                                    {item.order_index}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold text-gray-800">{item.place.name}</p>
                                                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                                                            {item.place.category}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1 flex gap-3">
                                                        {item.estimated_duration && (
                                                            <span>⏱ {item.estimated_duration}분</span>
                                                        )}
                                                        {item.recommended_time && (
                                                            <span>🕒 {item.recommended_time}</span>
                                                        )}
                                                        {item.notes && <span>📝 {item.notes}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePlaceFromCourse(item.place.id)}
                                                className="text-red-500 hover:text-red-700 text-xs font-bold border border-red-200 bg-white px-3 py-1.5 rounded hover:bg-red-50"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-gray-50 rounded border border-dashed border-gray-300 text-gray-500 mb-6">
                                아직 등록된 장소가 없습니다. 아래에서 추가해주세요.
                            </div>
                        )}

                        {/* 장소 추가 폼 (course_places 컬럼 입력) */}
                        <div className="bg-green-50 p-5 rounded-xl border border-green-100 shadow-sm">
                            <h4 className="text-sm font-bold text-green-800 mb-4 flex items-center gap-2">
                                ➕ 장소 추가하기 (course_places 저장)
                            </h4>
                            <div className="grid grid-cols-12 gap-3 items-end">
                                <div className="col-span-12 md:col-span-4">
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">장소 선택</label>
                                    <select
                                        className="w-full border p-2 rounded text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none"
                                        value={addPlaceId}
                                        onChange={(e) => setAddPlaceId(e.target.value ? Number(e.target.value) : "")}
                                    >
                                        <option value="">장소를 선택하세요</option>
                                        {allPlaces.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                [{p.category}] {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-3 md:col-span-1">
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">순서</label>
                                    <input
                                        type="number"
                                        className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                        value={addOrder}
                                        onChange={(e) => setAddOrder(Number(e.target.value))}
                                    />
                                </div>
                                <div className="col-span-4 md:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                                        소요시간(분)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                        placeholder="60"
                                        value={addDuration}
                                        onChange={(e) => setAddDuration(Number(e.target.value))}
                                    />
                                </div>
                                <div className="col-span-5 md:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                                        추천 시간대
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                        placeholder="점심, 노을질 때"
                                        value={addRecTime}
                                        onChange={(e) => setAddRecTime(e.target.value)}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-3 flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                                            비고(Notes)
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                            placeholder="예약 필수 등"
                                            value={addNotes}
                                            onChange={(e) => setAddNotes(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddPlaceToCourse}
                                        className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-green-700 h-[38px] self-end shadow-sm"
                                    >
                                        추가
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- 리스트 --- */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold mb-4 text-gray-700">등록된 코스 목록 ({courses.length})</h2>
                {loading ? (
                    <p>로딩 중...</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                <tr>
                                    <th className="p-3 border-b">ID</th>
                                    <th className="p-3 border-b">제목</th>
                                    <th className="p-3 border-b">장소 수</th>
                                    <th className="p-3 border-b">주요 태그</th>
                                    <th className="p-3 border-b text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* 1. map((c) => ...) 를 map((c, index) => ...) 로 변경합니다 */}
                                {courses.map((c, index) => (
                                    <tr key={c.id} className="hover:bg-gray-50 group">
                                        {/* 2. c.id 대신 index + 1을 넣으면 무조건 1부터 시작합니다 */}
                                        <td className="p-3 border-b text-gray-500">{c.id}</td>

                                        <td className="p-3 border-b font-medium text-gray-800">
                                            {c.title}
                                            {c.is_editor_pick && (
                                                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                                                    PICK
                                                </span>
                                            )}
                                        </td>

                                        <td className="p-3 border-b text-gray-600">
                                            {/* 아까 수정한 placesCount 적용 */}
                                            {c.placesCount || 0}개
                                        </td>

                                        <td className="p-3 border-b text-gray-500">
                                            {/* 아까 수정한 태그 표시 방식 적용 */}
                                            {c.tags && c.tags.concept ? c.tags.concept.slice(0, 3).join(", ") : "-"}
                                        </td>

                                        <td className="p-3 border-b text-right space-x-2">
                                            <button
                                                onClick={() => startEdit(c)}
                                                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-700 text-xs"
                                            >
                                                수정
                                            </button>
                                            <button
                                                onClick={() => handleDelete(c.id)}
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
