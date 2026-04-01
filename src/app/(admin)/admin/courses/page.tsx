"use client";

import React, { useEffect, useState, FormEvent, useMemo, useRef } from "react";
import type { DoNaCourseTags, ConceptTag, MoodTag, TargetTag, BudgetTag } from "@/types/tag";
import NaverMapComponent from "@/components/NaverMap";
import type { Place } from "@/types/map";
import {
    parseTipsFromDb,
    tipsToJson,
    TIP_CATEGORY_VALUES,
    getTipCategoryLabel,
    type TipItem,
    type TipCategory,
} from "@/types/tip";
import { useLocale } from "@/context/LocaleContext";

// --- 1. 선택지 상수 정의 ---
// 11개 컨셉 + 조건 태그 (중복 제거: 맛집→맛집탐방, 주점→술자리, 카페→카페투어, 전시/공연→공연·전시)
const CONCEPT_OPTIONS: ConceptTag[] = [
    "이색데이트",
    "감성데이트",
    "야경",
    "힐링",
    "가성비",
    "인생샷",
    "맛집탐방",
    "카페투어",
    "술자리",
    "실내데이트",
    "공연·전시",
    "실내",
    "야외",
    "기념일",
    "소개팅",
];

// Mood: 트렌디한→힙한, 편안한→조용한 흡수 / 신비로운·전통적인 제거
const MOOD_OPTIONS: MoodTag[] = [
    "로맨틱",
    "힙한",
    "활기찬",
    "레트로",
    "고급스러운",
    "감성",
    "조용한",
    "이국적인",
];

const TARGET_OPTIONS: TargetTag[] = ["연인", "썸", "친구", "가족", "혼자"];

const BUDGET_OPTIONS: BudgetTag[] = ["3만원 이하", "3~6만원", "6~10만원", "10~20만원", "20만원 이상"];
const REGION_OPTIONS = [
    "성수",
    "홍대",
    "연남",
    "종로",
    "을지로",
    "강남",
    "용산",
    "이태원",
    "잠실",
    "여의도",
    "영등포",
    "한남",
    "서촌",
    "안국",
    "합정",
    "건대",
];
const DURATION_OPTIONS = ["2시간", "3시간", "4시간", "5시간", "6시간+"];

// 선택형 코스용 세그먼트 (브런치/저녁 등 유저가 고를 구간)
const SEGMENT_OPTIONS = [
    { value: "", label: "— 없음 (고정 코스)" },
    { value: "brunch", label: "🥐 브런치" },
    { value: "dinner", label: "🍽 저녁" },
    { value: "bar", label: "🍸 바" },
    { value: "date", label: "💕 데이트" },
    { value: "cafe", label: "☕ 카페" },
    { value: "lunch", label: "🍴 점심" },
];

// --- 팁 에디터 (통합) ---
function TipItemEditor({
    tips,
    onChange,
    label,
}: {
    tips: TipItem[];
    onChange: (tips: TipItem[]) => void;
    label: string;
}) {
    const { t } = useLocale();
    const addTip = () =>
        onChange([
            ...tips,
            {
                category: "PARKING" as TipCategory,
                content: "",
            },
        ]);
    const updateTip = (index: number, field: "category" | "content", value: string) => {
        const next = [...tips];
        next[index] = { ...next[index], [field]: value };
        onChange(next);
    };
    const removeTip = (index: number) => onChange(tips.filter((_, i) => i !== index));

    return (
        <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
            <div className="space-y-2 border rounded p-2 bg-gray-50">
                {tips.map((tipRow, i) => (
                    <div key={i} className="flex gap-2 items-start">
                        <select
                            value={tipRow.category}
                            onChange={(e) => updateTip(i, "category", e.target.value)}
                            className="border p-1.5 rounded text-xs w-32 shrink-0"
                        >
                            {TIP_CATEGORY_VALUES.map((c, idx) => (
                                <option key={`${c}-${idx}`} value={c}>
                                    {getTipCategoryLabel(c, t)}
                                </option>
                            ))}
                        </select>
                        <textarea
                            value={tipRow.content}
                            onChange={(e) => updateTip(i, "content", e.target.value)}
                            className="flex-1 border p-1.5 rounded text-sm resize-none min-h-[60px]"
                            placeholder="예: 주차 정보, 시그니처 메뉴, 포토존 등"
                            rows={2}
                        />
                        <button
                            type="button"
                            onClick={() => removeTip(i)}
                            className="shrink-0 px-2 py-1 text-red-500 text-xs hover:bg-red-50 rounded"
                        >
                            삭제
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={addTip}
                    className="text-xs text-green-600 font-medium hover:underline"
                >
                    + 팁 추가
                </button>
            </div>
        </div>
    );
}

// --- 2. 타입 정의 ---

// ✅ DB: course_places 테이블 구조와 매핑되는 타입
type LinkedPlace = {
    // course_places 테이블의 id
    id?: number;
    course_id?: number;
    place_id?: number;
    // JOIN된 장소 정보
    place: {
        id: number;
        name: string;
        category?: string;
    };
    // course_places 테이블의 컬럼들
    order_index: number;
    segment?: string | null;
    order_in_segment?: number | null;
    estimated_duration?: number;
    recommended_time?: string;
    tips?: string;
    tips_en?: string | null;
    tips_ja?: string | null;
    tips_zh?: string | null;
};

// 단순 장소 선택용 (드롭다운)
type SimplePlace = {
    id: number;
    name: string;
    category?: string;
    address?: string;
    description?: string;
    latitude?: number;
    longitude?: number;
    imageUrl?: string;
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
    isPublic: boolean;
    grade?: "FREE" | "BASIC" | "PREMIUM";
    isSelectionType?: boolean; // 선택형 코스 (브런치/저녁 등 유저 선택)
    places?: LinkedPlace[];
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
    isPublic: true,
    grade: "FREE",
    isSelectionType: false,
    places: [],
};

export default function AdminCoursesPage() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [allPlaces, setAllPlaces] = useState<SimplePlace[]>([]);
    const [formData, setFormData] = useState<Omit<Course, "id">>(INITIAL_COURSE);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null); // 지도 확장용
    const [selectedPlaceForModal, setSelectedPlaceForModal] = useState<Place | null>(null); // 모달용 선택된 장소
    const [showPlaceModal, setShowPlaceModal] = useState(false); // 모달 표시 여부
    const [surroundingPlaces, setSurroundingPlaces] = useState<Place[]>([]); // 현재 지도 영역 내 장소들
    const getMapBoundsRef = useRef<
        (() => { minLat: number; maxLat: number; minLng: number; maxLng: number } | null) | null
    >(null); // 지도 bounds 가져오기 함수

    // --- 장소 추가용 State (course_places 컬럼들) ---
    const [addPlaceId, setAddPlaceId] = useState<number | "">("");
    const [addOrder, setAddOrder] = useState<number>(1);
    const [addSegment, setAddSegment] = useState<string>("");
    const [addOrderInSegment, setAddOrderInSegment] = useState<number | "">(0);
    const [addDuration, setAddDuration] = useState<number | "">("");
    const [addRecTime, setAddRecTime] = useState<string>(""); // recommended_time
    const [addTips, setAddTips] = useState<TipItem[]>([]);

    const regionOptions = useMemo(() => {
        const fromCourses = courses
            .map((c) => (c.region || "").trim())
            .filter((v): v is string => Boolean(v));
        return Array.from(new Set([...REGION_OPTIONS, ...fromCourses])).sort((a, b) => a.localeCompare(b, "ko"));
    }, [courses]);

    const conceptOptions = useMemo(() => {
        const fromCourses = courses
            .map((c) => (c.concept || "").trim())
            .filter((v): v is string => Boolean(v));
        return Array.from(new Set([...CONCEPT_OPTIONS, ...fromCourses])).sort((a, b) => a.localeCompare(b, "ko"));
    }, [courses]);

    // 장소 검색용 State
    const [placeSearchQuery, setPlaceSearchQuery] = useState<string>("");
    const [placeSearchResults, setPlaceSearchResults] = useState<SimplePlace[]>([]);
    const [placeSearchLoading, setPlaceSearchLoading] = useState<boolean>(false);
    const [showPlaceSearchResults, setShowPlaceSearchResults] = useState<boolean>(false);

    // 장소 수정용 State
    const [editingPlaceId, setEditingPlaceId] = useState<number | null>(null);
    const [editingPlaceData, setEditingPlaceData] = useState<{
        order_index: number;
        segment?: string;
        order_in_segment?: number | "";
        estimated_duration?: number | "";
        recommended_time?: string;
        tips: TipItem[];
        tips_en: TipItem[];
        tips_ja: TipItem[];
        tips_zh: TipItem[];
    } | null>(null);

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

    // 검색어 변경 시 debounce 검색
    useEffect(() => {
        if (!placeSearchQuery.trim()) {
            setPlaceSearchResults([]);
            setShowPlaceSearchResults(false);
            return;
        }

        const timer = setTimeout(async () => {
            setPlaceSearchLoading(true);
            try {
                const res = await fetch(
                    `/api/places?all=1&search=${encodeURIComponent(placeSearchQuery.trim())}&limit=20`
                );
                const data = await res.json();
                setPlaceSearchResults(data?.places || []);
                setShowPlaceSearchResults(true);
            } catch (e) {
                console.error("장소 검색 실패:", e);
                setPlaceSearchResults([]);
            } finally {
                setPlaceSearchLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [placeSearchQuery]);

    // ✅ 특정 코스의 장소 목록(course_places)만 따로 불러오는 함수
    const fetchCoursePlaces = async (courseId: number) => {
        try {
            // 이 API는 course_places 테이블을 조회해서 place 정보를 join해와야 함
            const res = await fetch(`/api/courses/${courseId}/places`);
            if (res.ok) {
                const data = await res.json(); // LinkedPlace[] 형태 (배열로 직접 반환)
                // API 응답이 배열이므로 그대로 사용
                const placesArray = Array.isArray(data) ? data : [];
                setFormData((prev) => ({ ...prev, places: placesArray }));

                // 다음 순서 자동 계산
                const nextOrder = placesArray.length + 1;
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

    // 모든 places 데이터를 지도용 Place[]로 변환 (새 코스 추가 모드용)
    const allPlacesMap: Place[] = useMemo(() => {
        if (!allPlaces || allPlaces.length === 0) return [];

        return allPlaces
            .filter((p: any) => {
                return p?.latitude != null && p?.longitude != null;
            })
            .map((p: any) => {
                return {
                    id: p.id,
                    name: p.name,
                    latitude: Number(p.latitude),
                    longitude: Number(p.longitude),
                    address: p.address,
                    category: p.category,
                    imageUrl: p.imageUrl,
                    description: p.description,
                } as Place;
            });
    }, [allPlaces]);

    // 코스의 장소들을 지도에 표시할 Place[] 형태로 변환 (편집 중인 코스용)
    const mapPlaces: Place[] = useMemo(() => {
        if (!formData.places || formData.places.length === 0) return [];

        return formData.places
            .filter((item) => {
                const place = item.place as any;
                return place?.latitude != null && place?.longitude != null;
            })
            .sort((a, b) => a.order_index - b.order_index)
            .map((item) => {
                const place = item.place as any;
                return {
                    id: place.id,
                    name: place.name,
                    latitude: Number(place.latitude),
                    longitude: Number(place.longitude),
                    address: place.address,
                    category: place.category,
                    imageUrl: place.imageUrl,
                    description: place.description,
                    orderIndex: item.order_index,
                } as Place;
            });
    }, [formData.places]);

    // 현 지도 영역에서 장소 찾기 함수
    const handleSearchInMapArea = async () => {
        if (!getMapBoundsRef.current) return;

        const bounds = getMapBoundsRef.current();
        if (!bounds) {
            alert("지도 정보를 가져올 수 없습니다.");
            return;
        }

        try {
            // 🟢 API를 직접 호출하여 현재 지도 영역 내의 모든 장소를 가져옴
            const res = await fetch(
                `/api/places?all=1&minLat=${bounds.minLat}&maxLat=${bounds.maxLat}&minLng=${bounds.minLng}&maxLng=${bounds.maxLng}&limit=10000`
            );
            const data = await res.json();

            if (data.success && data.places) {
                const placesInView = data.places
                    .filter((p: any) => {
                        // 🟢 좌표가 유효한지 확인
                        const lat = Number(p.latitude);
                        const lng = Number(p.longitude);
                        return (
                            !isNaN(lat) &&
                            !isNaN(lng) &&
                            lat >= bounds.minLat &&
                            lat <= bounds.maxLat &&
                            lng >= bounds.minLng &&
                            lng <= bounds.maxLng
                        );
                    })
                    .map(
                        (p: any) =>
                            ({
                                id: p.id,
                                name: p.name,
                                latitude: Number(p.latitude),
                                longitude: Number(p.longitude),
                                category: p.category,
                                imageUrl: p.imageUrl,
                                address: p.address,
                                description: p.description,
                            } as Place)
                    );

                setSurroundingPlaces(placesInView);
            } else {
                console.error("장소 검색 실패:", data);
                alert("장소를 불러오는 중 오류가 발생했습니다.");
            }
        } catch (error) {
            console.error("장소 검색 오류:", error);
            alert("장소를 불러오는 중 오류가 발생했습니다.");
        }
    };

    // 지도에 표시할 최종 places 데이터
    // 편집 모드: 코스 장소 + 주변 장소 (둘 다 핀으로 표시)
    // 새 코스 추가 모드: 추가한 장소 + 주변 장소
    const displayMapPlaces: Place[] = useMemo(() => {
        if (editingId) {
            // 편집 모드: 코스 장소 + 주변 장소 (코스에 포함되지 않은 것만)
            const coursePlaceIds = new Set(mapPlaces.map((p) => p.id));
            const visibleSurrounding = surroundingPlaces.filter((sp) => !coursePlaceIds.has(sp.id));
            return [...mapPlaces, ...visibleSurrounding];
        } else {
            // 새 코스 추가 모드: 추가한 장소 + 주변 장소 (중복 제거)
            const addedPlaceIds = new Set(mapPlaces.map((p) => p.id));
            const visibleSurrounding = surroundingPlaces.filter((sp) => !addedPlaceIds.has(sp.id));
            return [...mapPlaces, ...visibleSurrounding];
        }
    }, [editingId, mapPlaces, surroundingPlaces]);

    // 경로를 그릴 장소 데이터 (코스에 포함된 장소만)
    const pathPlaces: Place[] = useMemo(() => {
        if (editingId) {
            // 편집 모드: 코스에 포함된 장소만 경로로 연결
            return mapPlaces;
        } else {
            // 새 코스 추가 모드: 경로 없음
            return [];
        }
    }, [editingId, mapPlaces]);

    // 지도 초기 중심점 (서울 시청 기준)
    const mapCenter = { lat: 37.5665, lng: 126.978 };

    // 지도 초기 줌 레벨
    const mapZoom = 13;

    // 특정 코스의 장소들을 지도용 Place[]로 변환하는 헬퍼 함수
    const getCourseMapPlaces = (course: Course): Place[] => {
        if (!course.places || course.places.length === 0) return [];

        return course.places
            .filter((item) => {
                const place = (item as any).place as any;
                return place?.latitude != null && place?.longitude != null;
            })
            .sort((a, b) => a.order_index - b.order_index)
            .map((item) => {
                const place = (item as any).place as any;
                return {
                    id: place.id,
                    name: place.name,
                    latitude: Number(place.latitude),
                    longitude: Number(place.longitude),
                    address: place.address,
                    category: place.category,
                    imageUrl: place.imageUrl,
                    description: place.description,
                    orderIndex: item.order_index,
                } as Place;
            });
    };

    // --- 입력 핸들러 ---
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    /** 컨셉: course.concept + tags.concept 단일 소스 (대표 1개) */
    const handleConceptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const trimmed = value.trim();
        setFormData((prev) => {
            const currentTags = prev.tags || INITIAL_TAGS;
            return {
                ...prev,
                concept: value,
                tags: {
                    ...currentTags,
                    concept: trimmed ? ([trimmed] as ConceptTag[]) : [],
                },
            };
        });
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
            const conceptFromColumn = (courseDetail.concept || "").trim();
            safeTags.concept = conceptFromColumn ? ([conceptFromColumn] as ConceptTag[]) : [];

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
                isPublic: courseDetail.isPublic ?? true,
                grade: courseDetail.grade || "FREE",
                isSelectionType: courseDetail.isSelectionType ?? false,

                // ✅ API에서 include로 가져온 places (coursePlaces) 데이터를 바로 넣음
                // 백엔드에서 places: course.coursePlaces로 매핑해서 보냈으므로 그대로 사용
                places: courseDetail.places || [],
            });

            // 추가 폼 초기화
            setAddPlaceId("");
            setAddDuration("");
            setAddRecTime("");
            setAddTips([]);

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
        try {
            const res = await fetch(`/api/courses/${id}`, {
                method: "DELETE",
                credentials: "include",
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

        try {
            // 🟢 admin API 사용 (쿠키 기반 인증)
            const url = editingId ? `/api/admin/courses/${editingId}` : "/api/admin/courses";
            const method = editingId ? "PATCH" : "POST";

            // places는 별도 API로 관리하므로 body에서 제외
            const conceptTrimmed = (formData.concept || "").trim();
            const tagsSynced = {
                ...(formData.tags || INITIAL_TAGS),
                concept: conceptTrimmed ? ([conceptTrimmed] as ConceptTag[]) : [],
            };
            const { places, ...rest } = formData;
            const restBodyData = { ...rest, concept: conceptTrimmed, tags: tagsSynced };
            const bodyData = {
                ...restBodyData,
                // target_situation은 직접 입력 대신 Target 태그 선택값으로만 저장한다.
                target_situation: (formData.tags?.target || []).join(", "),
            };

            const res = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                credentials: "include", // 🟢 쿠키 전송을 위해 필요
                body: JSON.stringify(bodyData),
            });

            if (res.ok) {
                const result = await res.json();
                if (editingId) {
                    alert("코스 정보가 수정되었습니다.");
                    fetchCourses();
                } else {
                    // 🟢 새 코스 생성 후 즉시 편집 모드로 진입
                    const newCourseId = result?.course?.id;
                    if (newCourseId) {
                        alert("새 코스가 생성되었습니다. 편집 모드로 전환합니다.");
                        // 코스 목록을 먼저 새로고침한 후 편집 모드로 진입
                        await fetchCourses();
                        // 생성된 코스 찾아서 편집 모드로 전환
                        const newCourse = courses.find((c) => c.id === newCourseId) || ({ id: newCourseId } as Course);
                        startEdit(newCourse);
                    } else {
                        alert("새 코스가 생성되었습니다.");
                        setFormData(INITIAL_COURSE);
                        fetchCourses();
                    }
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

        try {
            // POST /api/courses/[id]/places -> course_places 테이블에 insert
            const res = await fetch(`/api/courses/${editingId}/places`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    place_id: Number(addPlaceId),
                    order_index: Number(addOrder),
                    segment: formData.isSelectionType && addSegment ? addSegment : undefined,
                    order_in_segment: formData.isSelectionType && addOrderInSegment !== "" ? Number(addOrderInSegment) : undefined,
                    estimated_duration: addDuration ? Number(addDuration) : undefined,
                    recommended_time: addRecTime || undefined,
                    tips: tipsToJson(addTips) ?? undefined,
                }),
            });

            if (res.ok) {
                alert("장소가 추가되었습니다.");
                // 리스트 갱신
                await fetchCoursePlaces(editingId);

                // 입력폼 초기화
                setAddPlaceId("");
                setPlaceSearchQuery("");
                setPlaceSearchResults([]);
                setShowPlaceSearchResults(false);
                setAddOrder(formData.places ? formData.places.length + 1 : 1);
                setAddSegment("");
                setAddOrderInSegment(0);
                setAddDuration("");
                setAddRecTime("");
                setAddTips([]);
            } else {
                const err = await res.json();
                alert(err.error || "추가 실패");
            }
        } catch (e) {
            console.error(e);
        }
    };

    // --- [하위 기능] 코스에서 장소 제거 ---
    const handleRemovePlaceFromCourse = async (place: LinkedPlace) => {
        if (!editingId || !("id" in place) || !place.id || !confirm("정말 이 장소를 코스에서 제거하시겠습니까?"))
            return;
        try {
            const res = await fetch(`/api/courses/${editingId}/places/${place.id}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (res.ok) {
                await fetchCoursePlaces(editingId); // 리스트 갱신
                if (editingPlaceId === place.id) {
                    cancelEditPlace();
                }
            } else {
                const text = await res.text();
                let errMsg = `HTTP ${res.status}`;
                try {
                    if ((res.headers.get("content-type") || "").includes("application/json")) {
                        const err = JSON.parse(text);
                        errMsg = err.error || errMsg;
                    }
                } catch {
                    if (text.startsWith("<")) errMsg = `${res.status} (서버가 HTML을 반환했습니다)`;
                }
                alert(`제거 실패: ${errMsg}`);
            }
        } catch (e) {
            console.error(e);
        }
    };

    // 장소 수정 시작
    const startEditPlace = (place: LinkedPlace & { id?: number }) => {
        if (!("id" in place)) return;
        setEditingPlaceId((place as any).id);
        setEditingPlaceData({
            order_index: place.order_index,
            segment: (place as any).segment ?? "",
            order_in_segment: (place as any).order_in_segment ?? "",
            estimated_duration: place.estimated_duration ?? "",
            recommended_time: place.recommended_time ?? "",
            tips: parseTipsFromDb(place.tips),
            tips_en: parseTipsFromDb((place as LinkedPlace).tips_en),
            tips_ja: parseTipsFromDb((place as LinkedPlace).tips_ja),
            tips_zh: parseTipsFromDb((place as LinkedPlace).tips_zh),
        });
    };

    // 장소 수정 취소
    const cancelEditPlace = () => {
        setEditingPlaceId(null);
        setEditingPlaceData(null);
    };

    // 장소 수정 저장
    const handleUpdatePlace = async (place: LinkedPlace & { id?: number }) => {
        if (!editingId || !editingPlaceId || !editingPlaceData || !("id" in place)) return;

        try {
            const coursePlaceId = (place as any).id;
            const res = await fetch(`/api/courses/${editingId}/places/${coursePlaceId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    order_index: editingPlaceData.order_index,
                    segment: formData.isSelectionType && editingPlaceData.segment ? editingPlaceData.segment : null,
                    order_in_segment:
                        formData.isSelectionType && editingPlaceData.order_in_segment !== ""
                            ? Number(editingPlaceData.order_in_segment)
                            : null,
                    estimated_duration:
                        editingPlaceData.estimated_duration === "" ? null : editingPlaceData.estimated_duration,
                    recommended_time: editingPlaceData.recommended_time || null,
                    tips: tipsToJson(editingPlaceData.tips) ?? null,
                    tips_en: tipsToJson(editingPlaceData.tips_en) ?? null,
                    tips_ja: tipsToJson(editingPlaceData.tips_ja) ?? null,
                    tips_zh: tipsToJson(editingPlaceData.tips_zh) ?? null,
                }),
            });

            if (res.ok) {
                alert("장소 정보가 수정되었습니다.");
                cancelEditPlace();
                await fetchCoursePlaces(editingId);
            } else {
                const text = await res.text();
                let errMsg = `HTTP ${res.status}`;
                try {
                    const ct = res.headers.get("content-type") || "";
                    if (ct.includes("application/json")) {
                        const err = JSON.parse(text);
                        errMsg = err.error || errMsg;
                    }
                } catch {
                    if (text.startsWith("<")) errMsg = `${res.status} (서버가 HTML을 반환했습니다)`;
                }
                alert(`수정 실패: ${errMsg}`);
            }
        } catch (e) {
            console.error("장소 수정 실패:", e);
            alert("장소 수정 중 오류가 발생했습니다.");
        }
    };

    // 🟢 장소 순서 변경 함수 (위로 이동)
    const handleMovePlaceUp = async (place: LinkedPlace & { id?: number }) => {
        if (!editingId || !("id" in place) || !formData.places) return;

        const sortedPlaces = [...formData.places].sort((a, b) => a.order_index - b.order_index);
        const currentIndex = sortedPlaces.findIndex((p) => (p as any).id === (place as any).id);

        if (currentIndex <= 0) return; // 이미 맨 위

        const prevPlace = sortedPlaces[currentIndex - 1];
        const currentOrder = place.order_index;
        const prevOrder = prevPlace.order_index;

        try {
            // 두 장소의 order_index를 교환
            const currentPlaceId = (place as any).id;
            const prevPlaceId = (prevPlace as any).id;

            // 병렬로 두 요청 실행
            const [res1, res2] = await Promise.all([
                fetch(`/api/courses/${editingId}/places/${currentPlaceId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ order_index: prevOrder }),
                }),
                fetch(`/api/courses/${editingId}/places/${prevPlaceId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ order_index: currentOrder }),
                }),
            ]);

            if (res1.ok && res2.ok) {
                await fetchCoursePlaces(editingId);
            } else {
                const parse = async (r: Response) => {
                    const text = await r.text();
                    if ((r.headers.get("content-type") || "").includes("application/json")) {
                        try {
                            return (JSON.parse(text) as { error?: string }).error;
                        } catch {
                            return undefined;
                        }
                    }
                    return r.status === 200 ? undefined : `HTTP ${r.status}`;
                };
                const err1 = await parse(res1);
                const err2 = await parse(res2);
                alert(`순서 변경 실패: ${err1 || err2 || "알 수 없는 오류"}`);
            }
        } catch (e) {
            console.error("순서 변경 실패:", e);
            alert("순서 변경 중 오류가 발생했습니다.");
        }
    };

    // 🟢 장소 순서 변경 함수 (아래로 이동)
    const handleMovePlaceDown = async (place: LinkedPlace & { id?: number }) => {
        if (!editingId || !("id" in place) || !formData.places) return;

        const sortedPlaces = [...formData.places].sort((a, b) => a.order_index - b.order_index);
        const currentIndex = sortedPlaces.findIndex((p) => (p as any).id === (place as any).id);

        if (currentIndex >= sortedPlaces.length - 1) return; // 이미 맨 아래

        const nextPlace = sortedPlaces[currentIndex + 1];
        const currentOrder = place.order_index;
        const nextOrder = nextPlace.order_index;

        try {
            // 두 장소의 order_index를 교환
            const currentPlaceId = (place as any).id;
            const nextPlaceId = (nextPlace as any).id;

            // 병렬로 두 요청 실행
            const [res1, res2] = await Promise.all([
                fetch(`/api/courses/${editingId}/places/${currentPlaceId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ order_index: nextOrder }),
                }),
                fetch(`/api/courses/${editingId}/places/${nextPlaceId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ order_index: currentOrder }),
                }),
            ]);

            if (res1.ok && res2.ok) {
                await fetchCoursePlaces(editingId);
            } else {
                const parse = async (r: Response) => {
                    const text = await r.text();
                    if ((r.headers.get("content-type") || "").includes("application/json")) {
                        try {
                            return (JSON.parse(text) as { error?: string }).error;
                        } catch {
                            return undefined;
                        }
                    }
                    return r.status === 200 ? undefined : `HTTP ${r.status}`;
                };
                const err1 = await parse(res1);
                const err2 = await parse(res2);
                alert(`순서 변경 실패: ${err1 || err2 || "알 수 없는 오류"}`);
            }
        } catch (e) {
            console.error("순서 변경 실패:", e);
            alert("순서 변경 중 오류가 발생했습니다.");
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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 왼쪽: 입력 폼 */}
                    <form onSubmit={handleSubmit} className="space-y-8 lg:col-span-2">
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
                                <label className="text-sm font-medium text-gray-600">부제목 (Sub Title)</label>
                                <input
                                    name="sub_title"
                                    placeholder="예: 썸녀가 감동하는 완벽 코스"
                                    value={formData.sub_title || ""}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-600">지역</label>
                                <input
                                    name="region"
                                    list="admin-course-region-options"
                                    value={formData.region || ""}
                                    onChange={handleInputChange}
                                    placeholder="예: 홍대, 홍대/신촌, 마포"
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                />
                                <datalist id="admin-course-region-options">
                                    {regionOptions.map((region) => (
                                        <option key={region} value={region} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-600">컨셉 (Concept)</label>
                                <input
                                    name="concept"
                                    list="admin-course-concept-options"
                                    placeholder="목록에서 고르거나 직접 입력 (저장 시 태그와 동기화)"
                                    value={formData.concept || ""}
                                    onChange={handleConceptChange}
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                />
                                <datalist id="admin-course-concept-options">
                                    {conceptOptions.map((c) => (
                                        <option key={c} value={c} />
                                    ))}
                                </datalist>
                                <p className="text-xs text-gray-500">
                                    저장 시 <code className="text-[11px]">tags.concept</code>도 동일 값 1개로 맞춥니다.
                                </p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-600">소요시간</label>
                                <select
                                    name="duration"
                                    value={formData.duration || ""}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                >
                                    <option value="">선택 안 함</option>
                                    {DURATION_OPTIONS.map((duration) => (
                                        <option key={duration} value={duration}>
                                            {duration}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 my-4"></div>

                        {/* 2. 태그 선택 섹션 */}
                        <div className="space-y-6">
                            <h3 className="font-bold text-gray-800">🏷️ 태그 선택</h3>
                            <p className="text-xs text-gray-500 -mt-4 mb-2">
                                컨셉은 위쪽 &quot;컨셉 (Concept)&quot; 입력란에서 선택·입력합니다.
                            </p>
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
                                <p className="text-xs text-gray-500">
                                    target_situation 저장값: {(formData.tags?.target || []).join(", ") || "-"}
                                </p>
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
                                <div className="space-y-1 pt-6">
                                    <label className="text-sm font-medium text-gray-600">등급 (Grade)</label>
                                    <select
                                        name="grade"
                                        value={formData.grade || "FREE"}
                                        onChange={handleInputChange}
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                    >
                                        <option value="FREE">무료 (Free)</option>
                                        <option value="BASIC">베이직 (Basic)</option>
                                        <option value="PREMIUM">프리미엄 (Premium)</option>
                                    </select>
                                </div>
                                <div className="flex items-center space-x-3 pt-6">
                                    <input
                                        type="checkbox"
                                        id="isPublic"
                                        name="isPublic"
                                        checked={formData.isPublic}
                                        onChange={handleCheckboxChange}
                                        className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                                    />
                                    <label
                                        htmlFor="isPublic"
                                        className="text-sm font-medium text-gray-700 cursor-pointer"
                                    >
                                        코스 공개 (체크 해제 시 숨김)
                                    </label>
                                </div>
                                <div className="flex items-center space-x-3 pt-6">
                                    <input
                                        type="checkbox"
                                        id="isSelectionType"
                                        name="isSelectionType"
                                        checked={formData.isSelectionType}
                                        onChange={handleCheckboxChange}
                                        className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                                    />
                                    <label
                                        htmlFor="isSelectionType"
                                        className="text-sm font-medium text-gray-700 cursor-pointer"
                                    >
                                        선택형 코스 (브런치/저녁 등 유저가 장소 선택)
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

                    {/* 오른쪽: 지도 */}
                    <div className="lg:col-span-1">
                        <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                            <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                                <h4 className="text-sm font-semibold text-gray-700">
                                    🗺️ {editingId ? "코스 경로" : "현 지역 장소"} ({displayMapPlaces.length}개)
                                </h4>
                                {surroundingPlaces.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setSurroundingPlaces([])}
                                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                                    >
                                        초기화
                                    </button>
                                )}
                            </div>
                            <div className="w-full h-[500px] relative">
                                {/* 현 지도 영역에서 장소 찾기 버튼 */}
                                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
                                    <button
                                        type="button"
                                        onClick={handleSearchInMapArea}
                                        className="bg-white text-gray-700 px-4 py-2 rounded-full shadow-lg text-sm font-bold border border-gray-300 hover:bg-gray-50 flex items-center gap-2 transition-all"
                                    >
                                        <span>📍</span>
                                        <span>이 지역에서 장소 찾기</span>
                                        {surroundingPlaces.length > 0 && (
                                            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                                                {surroundingPlaces.length}
                                            </span>
                                        )}
                                    </button>
                                </div>

                                {surroundingPlaces.length === 0 && !editingId && (
                                    <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-10 bg-blue-50 border border-blue-200 rounded px-4 py-2 text-xs text-blue-800 shadow-sm max-w-xs text-center">
                                        💡 지도를 움직여 원하는 지역으로 이동한 후<br />
                                        "이 지역에서 장소 찾기" 버튼을 클릭하세요
                                    </div>
                                )}

                                <NaverMapComponent
                                    places={displayMapPlaces}
                                    userLocation={null}
                                    selectedPlace={null}
                                    onPlaceClick={(place) => {
                                        setSelectedPlaceForModal(place);
                                        setShowPlaceModal(true);
                                    }}
                                    drawPath={!!(editingId && pathPlaces.length > 0)}
                                    routeMode="walking"
                                    numberedMarkers={false} // 주변 장소도 있으므로 번호 표시 안 함
                                    showControls={false} // 🟢 admin 페이지에서는 컨트롤 버튼 숨김
                                    showPlaceOverlay={false}
                                    suppressNearFallback={true}
                                    center={mapCenter}
                                    pathPlaces={pathPlaces} // 경로는 코스 장소만 연결
                                    onMapReady={(getBounds) => {
                                        getMapBoundsRef.current = getBounds;
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. ✅ 코스 구성 (장소 관리) 섹션 - course_places 테이블 연동 */}
                {editingId && (
                    <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-200">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">📍 코스 구성 (장소 목록)</h3>

                        {/* 현재 연결된 장소 목록 */}
                        {formData.places && formData.places.length > 0 ? (
                            <div className="space-y-2 mb-6">
                                {formData.places
                                    .sort((a, b) => a.order_index - b.order_index)
                                    .map((item, index) => {
                                        const isEditing = editingPlaceId === (item as any).id;
                                        const editData = isEditing ? editingPlaceData : null;
                                        const sortedPlaces = [...(formData.places || [])].sort(
                                            (a, b) => a.order_index - b.order_index
                                        );
                                        const currentIndex = sortedPlaces.findIndex(
                                            (p) => (p as any).id === (item as any).id
                                        );
                                        const canMoveUp = currentIndex > 0;
                                        const canMoveDown = currentIndex < sortedPlaces.length - 1;

                                        return (
                                            <div
                                                key={item.place.id}
                                                className="bg-gray-50 p-4 rounded-lg border hover:border-green-300 transition"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex items-start gap-4 flex-1">
                                                        {/* 🟢 순서 변경 버튼 그룹 */}
                                                        {!isEditing && (
                                                            <div className="flex flex-col gap-1 shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleMovePlaceUp(item)}
                                                                    disabled={!canMoveUp}
                                                                    className={`w-6 h-6 flex items-center justify-center rounded border transition ${
                                                                        canMoveUp
                                                                            ? "bg-white border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-green-600"
                                                                            : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                                                    }`}
                                                                    title="위로 이동"
                                                                >
                                                                    ↑
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleMovePlaceDown(item)}
                                                                    disabled={!canMoveDown}
                                                                    className={`w-6 h-6 flex items-center justify-center rounded border transition ${
                                                                        canMoveDown
                                                                            ? "bg-white border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-green-600"
                                                                            : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                                                    }`}
                                                                    title="아래로 이동"
                                                                >
                                                                    ↓
                                                                </button>
                                                            </div>
                                                        )}
                                                        <div className="w-8 h-8 flex items-center justify-center bg-green-100 text-green-700 font-bold rounded-full shadow-sm shrink-0">
                                                            {isEditing && editData ? (
                                                                <input
                                                                    type="number"
                                                                    value={editData.order_index}
                                                                    onChange={(e) =>
                                                                        setEditingPlaceData({
                                                                            ...editData,
                                                                            order_index: Number(e.target.value),
                                                                        })
                                                                    }
                                                                    className="w-8 h-8 text-center text-sm font-bold bg-white border rounded-full"
                                                                    min="1"
                                                                />
                                                            ) : (
                                                                item.order_index
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                                <p className="font-semibold text-gray-800">
                                                                    {item.place.name}
                                                                </p>
                                                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                                                                    {item.place.category}
                                                                </span>
                                                                {formData.isSelectionType && (item as any).segment && (
                                                                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                                                                        {SEGMENT_OPTIONS.find((s) => s.value === (item as any).segment)?.label ?? (item as any).segment}
                                                                        {(item as any).order_in_segment != null && (
                                                                            <span className="ml-0.5">#{(item as any).order_in_segment + 1}</span>
                                                                        )}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {isEditing && editData ? (
                                                                <div className="space-y-2">
                                                                    {formData.isSelectionType && (
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            <div>
                                                                                <label className="text-xs font-medium text-gray-600">세그먼트</label>
                                                                                <select
                                                                                    value={editData.segment ?? ""}
                                                                                    onChange={(e) =>
                                                                                        setEditingPlaceData({
                                                                                            ...editData,
                                                                                            segment: e.target.value,
                                                                                        })
                                                                                    }
                                                                                    className="w-full border p-1.5 rounded text-sm mt-1"
                                                                                >
                                                                                    {SEGMENT_OPTIONS.map((opt) => (
                                                                                        <option key={opt.value || "none"} value={opt.value}>
                                                                                            {opt.label}
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                            <div>
                                                                                <label className="text-xs font-medium text-gray-600">세그먼트 내 순서</label>
                                                                                <input
                                                                                    type="number"
                                                                                    min={0}
                                                                                    value={editData.order_in_segment ?? ""}
                                                                                    onChange={(e) =>
                                                                                        setEditingPlaceData({
                                                                                            ...editData,
                                                                                            order_in_segment:
                                                                                                e.target.value === "" ? "" : Number(e.target.value),
                                                                                        })
                                                                                    }
                                                                                    className="w-full border p-1.5 rounded text-sm mt-1"
                                                                                    placeholder="0"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div>
                                                                            <label className="text-xs font-medium text-gray-600">
                                                                                소요시간(분)
                                                                            </label>
                                                                            <input
                                                                                type="number"
                                                                                value={
                                                                                    editData.estimated_duration || ""
                                                                                }
                                                                                onChange={(e) =>
                                                                                    setEditingPlaceData({
                                                                                        ...editData,
                                                                                        estimated_duration:
                                                                                            e.target.value === ""
                                                                                                ? ""
                                                                                                : Number(
                                                                                                      e.target.value
                                                                                                  ),
                                                                                    })
                                                                                }
                                                                                className="w-full border p-1.5 rounded text-sm mt-1"
                                                                                placeholder="60"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-xs font-medium text-gray-600">
                                                                                추천 시간대
                                                                            </label>
                                                                            <input
                                                                                type="text"
                                                                                value={editData.recommended_time || ""}
                                                                                onChange={(e) =>
                                                                                    setEditingPlaceData({
                                                                                        ...editData,
                                                                                        recommended_time:
                                                                                            e.target.value,
                                                                                    })
                                                                                }
                                                                                className="w-full border p-1.5 rounded text-sm mt-1"
                                                                                placeholder="점심"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <TipItemEditor
                                                                        label="팁 (한국어)"
                                                                        tips={editData.tips}
                                                                        onChange={(tips) =>
                                                                            setEditingPlaceData({
                                                                                ...editData,
                                                                                tips,
                                                                            })
                                                                        }
                                                                    />
                                                                    <TipItemEditor
                                                                        label="팁 (English)"
                                                                        tips={editData.tips_en}
                                                                        onChange={(tips_en) =>
                                                                            setEditingPlaceData({
                                                                                ...editData,
                                                                                tips_en,
                                                                            })
                                                                        }
                                                                    />
                                                                    <TipItemEditor
                                                                        label="팁 (日本語)"
                                                                        tips={editData.tips_ja}
                                                                        onChange={(tips_ja) =>
                                                                            setEditingPlaceData({
                                                                                ...editData,
                                                                                tips_ja,
                                                                            })
                                                                        }
                                                                    />
                                                                    <TipItemEditor
                                                                        label="팁 (中文)"
                                                                        tips={editData.tips_zh}
                                                                        onChange={(tips_zh) =>
                                                                            setEditingPlaceData({
                                                                                ...editData,
                                                                                tips_zh,
                                                                            })
                                                                        }
                                                                    />
                                                                    <div className="flex gap-2 mt-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleUpdatePlace(item)}
                                                                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700"
                                                                        >
                                                                            저장
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={cancelEditPlace}
                                                                            className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-bold rounded hover:bg-gray-300"
                                                                        >
                                                                            취소
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-3">
                                                                    {item.estimated_duration && (
                                                                        <span>⏱ {item.estimated_duration}분</span>
                                                                    )}
                                                                    {item.recommended_time && (
                                                                        <span>🕒 {item.recommended_time}</span>
                                                                    )}
                                                                    {parseTipsFromDb(item.tips).length > 0 && (
                                                                        <span className="text-gray-600 font-medium">
                                                                            📌 팁:{" "}
                                                                            {parseTipsFromDb(item.tips)
                                                                                .map((t) => t.content)
                                                                                .join(" / ")}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {!isEditing && (
                                                        <div className="flex gap-2 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => startEditPlace(item)}
                                                                className="px-3 py-1.5 text-blue-600 hover:text-blue-700 text-xs font-bold border border-blue-200 bg-white rounded hover:bg-blue-50"
                                                            >
                                                                수정
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemovePlaceFromCourse(item)}
                                                                className="px-3 py-1.5 text-red-500 hover:text-red-700 text-xs font-bold border border-red-200 bg-white rounded hover:bg-red-50"
                                                            >
                                                                삭제
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
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
                                <div className="col-span-12 md:col-span-4 relative">
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">장소 선택</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none"
                                            placeholder="장소를 검색하세요"
                                            value={placeSearchQuery}
                                            onChange={(e) => {
                                                setPlaceSearchQuery(e.target.value);
                                                if (!e.target.value.trim()) {
                                                    setShowPlaceSearchResults(false);
                                                    setAddPlaceId("");
                                                }
                                            }}
                                            onFocus={() => {
                                                if (placeSearchResults.length > 0) {
                                                    setShowPlaceSearchResults(true);
                                                }
                                            }}
                                            onBlur={() => {
                                                // 약간의 지연을 두어 클릭 이벤트가 실행되도록
                                                setTimeout(() => setShowPlaceSearchResults(false), 200);
                                            }}
                                        />
                                        {placeSearchLoading && (
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                                                검색 중...
                                            </div>
                                        )}
                                        {showPlaceSearchResults && placeSearchResults.length > 0 && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                {placeSearchResults.map((p) => (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm border-b border-gray-100 last:border-b-0"
                                                        onClick={() => {
                                                            setAddPlaceId(p.id);
                                                            setPlaceSearchQuery(p.name);
                                                            setShowPlaceSearchResults(false);
                                                        }}
                                                    >
                                                        <div className="font-medium text-gray-900">{p.name}</div>
                                                        {p.category && (
                                                            <div className="text-xs text-gray-500">[{p.category}]</div>
                                                        )}
                                                        {p.address && (
                                                            <div className="text-xs text-gray-400 truncate">
                                                                {p.address}
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {showPlaceSearchResults &&
                                            placeSearchQuery.trim() &&
                                            placeSearchResults.length === 0 &&
                                            !placeSearchLoading && (
                                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-500 text-center">
                                                    검색 결과가 없습니다
                                                </div>
                                            )}
                                    </div>
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
                                {formData.isSelectionType && (
                                    <>
                                        <div className="col-span-4 md:col-span-2">
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">세그먼트</label>
                                            <select
                                                className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white"
                                                value={addSegment}
                                                onChange={(e) => setAddSegment(e.target.value)}
                                            >
                                                {SEGMENT_OPTIONS.filter((o) => o.value).map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">세그먼트 내 순서</label>
                                            <input
                                                type="number"
                                                min={0}
                                                className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                                value={addOrderInSegment}
                                                onChange={(e) =>
                                                    setAddOrderInSegment(e.target.value === "" ? "" : Number(e.target.value))
                                                }
                                            />
                                        </div>
                                    </>
                                )}
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
                                <div className="col-span-12 md:col-span-3">
                                    <TipItemEditor
                                        label="팁"
                                        tips={addTips}
                                        onChange={setAddTips}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-1 flex items-end">
                                    <button
                                        type="button"
                                        onClick={handleAddPlaceToCourse}
                                        className="w-full bg-green-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-green-700 shadow-sm"
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
                                {courses
                                    .sort((a, b) => a.id - b.id) // ID 순으로 정렬
                                    .map((c, index) => {
                                        const courseMapPlaces = getCourseMapPlaces(c);
                                        const isExpanded = expandedCourseId === c.id;
                                        return (
                                            <React.Fragment key={c.id}>
                                                <tr className="hover:bg-gray-50 group">
                                                    <td className="p-3 border-b text-gray-500 font-medium">{c.id}</td>

                                                    <td className="p-3 border-b font-medium text-gray-800">
                                                        {c.title}
                                                        {c.is_editor_pick && (
                                                            <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                                                                PICK
                                                            </span>
                                                        )}
                                                        {c.isSelectionType && (
                                                            <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                                                선택형
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="p-3 border-b text-gray-600">
                                                        {/* 아까 수정한 placesCount 적용 */}
                                                        {c.placesCount || 0}개
                                                    </td>

                                                    <td className="p-3 border-b text-gray-500">
                                                        {/* 아까 수정한 태그 표시 방식 적용 */}
                                                        {(c.concept || "").trim() ||
                                                            (c.tags?.concept?.length
                                                                ? c.tags.concept.slice(0, 3).join(", ")
                                                                : "-")}
                                                    </td>

                                                    <td className="p-3 border-b text-right space-x-2">
                                                        <button
                                                            onClick={() =>
                                                                setExpandedCourseId(isExpanded ? null : c.id)
                                                            }
                                                            disabled={courseMapPlaces.length === 0}
                                                            className={`px-3 py-1 border rounded text-xs ${
                                                                courseMapPlaces.length === 0
                                                                    ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                                                    : isExpanded
                                                                    ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                                                                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100"
                                                            }`}
                                                        >
                                                            {isExpanded ? "🗺️ 지도 닫기" : "🗺️ 지도 보기"}
                                                        </button>
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
                                                {/* 확장된 지도 영역 */}
                                                {isExpanded && courseMapPlaces.length > 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="p-0 border-b">
                                                            <div className="bg-gray-50 p-4">
                                                                <div className="mb-2">
                                                                    <h4 className="text-sm font-semibold text-gray-700">
                                                                        🗺️ {c.title} - 코스 경로 지도
                                                                    </h4>
                                                                    <p className="text-xs text-gray-500 mt-1">
                                                                        총 {courseMapPlaces.length}개 장소
                                                                    </p>
                                                                </div>
                                                                <div className="w-full h-[400px] rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm">
                                                                    <NaverMapComponent
                                                                        places={courseMapPlaces}
                                                                        userLocation={null}
                                                                        selectedPlace={null}
                                                                        onPlaceClick={(place) => {
                                                                            setSelectedPlaceForModal(place);
                                                                            setShowPlaceModal(true);
                                                                        }}
                                                                        drawPath={true}
                                                                        routeMode="walking"
                                                                        numberedMarkers={true}
                                                                        showControls={false} // 🟢 admin 페이지에서는 컨트롤 버튼 숨김
                                                                        showPlaceOverlay={false}
                                                                        suppressNearFallback={true}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 장소 상세 모달 */}
            {showPlaceModal && selectedPlaceForModal && (
                <div
                    className="fixed inset-0 bg-black/60 z-9999 flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => {
                        setShowPlaceModal(false);
                        setSelectedPlaceForModal(null);
                    }}
                >
                    <div
                        className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative h-64 bg-gray-100">
                            {selectedPlaceForModal.imageUrl ? (
                                <img
                                    src={selectedPlaceForModal.imageUrl}
                                    alt={selectedPlaceForModal.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-linear-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                                    <span className="text-gray-400 text-4xl">📍</span>
                                </div>
                            )}
                            <button
                                onClick={() => {
                                    setShowPlaceModal(false);
                                    setSelectedPlaceForModal(null);
                                }}
                                className="absolute top-4 right-4 bg-black/30 backdrop-blur-md text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/50 transition-colors text-xl font-bold"
                            >
                                <span className="symbol-ko-font">×</span>
                            </button>
                            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />
                            <div className="absolute bottom-6 left-6 text-white">
                                <h3 className="text-2xl font-bold mb-1">{selectedPlaceForModal.name}</h3>
                                {selectedPlaceForModal.category && (
                                    <span className="inline-block px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium">
                                        {selectedPlaceForModal.category}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {selectedPlaceForModal.address && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 mb-1">주소</h4>
                                    <p className="text-gray-800">{selectedPlaceForModal.address}</p>
                                </div>
                            )}

                            {selectedPlaceForModal.description && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 mb-1">설명</h4>
                                    <p className="text-gray-700 whitespace-pre-line">
                                        {selectedPlaceForModal.description}
                                    </p>
                                </div>
                            )}

                            <div>
                                <h4 className="text-sm font-semibold text-gray-500 mb-1">좌표</h4>
                                <p className="text-gray-600 text-sm">
                                    위도: {selectedPlaceForModal.latitude.toFixed(6)}, 경도:{" "}
                                    {selectedPlaceForModal.longitude.toFixed(6)}
                                </p>
                            </div>

                            {selectedPlaceForModal.orderIndex && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 mb-1">코스 순서</h4>
                                    <span className="inline-flex items-center justify-center w-8 h-8 bg-green-100 text-green-700 font-bold rounded-full">
                                        {selectedPlaceForModal.orderIndex}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
