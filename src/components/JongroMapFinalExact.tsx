"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type FlowLike = {
    intro?: Array<{ ids?: number[] }>;
    ids?: number[];
    categories?: any[];
    places?: any[];
};

type Props = {
    data?: {
        flow?: FlowLike;
        tokens?: { title?: string; subtitle?: string } | null;
        backgroundImage?: string | null;
        synopsis?: string | null;
    };
};

type StoryItem = {
    id: number;
    speaker: string;
    dialogue: string;
    nextTrigger: string | null;
    missionId?: number | null;
};

type MissionItem = {
    id: number;
    missionNumber: number;
    missionType: string;
    question: string;
    description: string;
    hint: string;
    answer?: string;
};
const nl2br = (text: string) => {
    return String(text || "")
        .split("\n")
        .map((item, key) => (
            <span key={key}>
                {item}
                <br />
            </span>
        ));
};
// 화자 표기 포맷: 'Unknown' 등 비표준 값을 한국어로 정제
const formatSpeakerName = (name?: string | null) => {
    const s = String(name ?? "").trim();
    if (!s || /^unknown$/i.test(s)) return "익명";
    return s;
};

const getPlaceThemeKey = (p: any): string => {
    return String(p?.theme ?? p?.category ?? p?.type ?? "")
        .trim()
        .toLowerCase();
};

const THEME_LABEL_KO: Record<string, string> = {
    footsteps: "발자취",
    history: "역사",
    time: "시간",
    location: "장소",
};

export default function JongroMapFinalExact({ data }: Props) {
    const searchParams = useSearchParams();
    const storyId = Number(searchParams.get("id")) || 0;
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedPlace, setSelectedPlace] = useState<any | null>(null);
    const [mapOverlay, setMapOverlay] = useState<boolean>(false);
    const introRef = useRef<HTMLDivElement | null>(null);
    const lastMsgRef = useRef<HTMLDivElement | null>(null);
    const [showNext, setShowNext] = useState<boolean>(false);
    const [showPreface, setShowPreface] = useState<boolean>(false);
    const prefaceScrollRef = useRef<HTMLDivElement | null>(null);
    const [introMessages, setIntroMessages] = useState<Array<{ type: string; text: string; speaker?: string }>>([]);

    const [isPlayingStory, setIsPlayingStory] = useState(false);
    const [storyLines, setStoryLines] = useState<StoryItem[]>([]);
    const [missions, setMissions] = useState<MissionItem[]>([]);
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const [visibleLines, setVisibleLines] = useState<StoryItem[]>([]);
    const [activeMission, setActiveMission] = useState<MissionItem | null>(null);
    const [isPlaceClear, setIsPlaceClear] = useState(false);
    const [missionAnswer, setMissionAnswer] = useState("");
    const storyEndRef = useRef<HTMLDivElement | null>(null);

    const [clearedMissions, setClearedMissions] = useState<Record<number, boolean>>({});
    const solvedMissionIds = React.useMemo(() => Object.keys(clearedMissions).map((k) => Number(k)), [clearedMissions]);

    const [photoFiles, setPhotoFiles] = useState<File[]>([]);
    const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationError, setValidationError] = useState<string>("");
    const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

    const resumeIndexRef = useRef<number | null>(null);
    const [pendingMission, setPendingMission] = useState<MissionItem | null>(null);
    const storageKeyForPlace = (placeId: number) => `escape_cleared_missions_${placeId}`;
    const [clearedPlaceIds, setClearedPlaceIds] = useState<number[]>([]);
    const CLEARED_PLACES_KEY = "escape_cleared_places";
    const [showClearedModal, setShowClearedModal] = useState<boolean>(false);
    const [clearedModalPlaceName, setClearedModalPlaceName] = useState<string>("");

    useEffect(() => {
        try {
            const raw = typeof window !== "undefined" ? localStorage.getItem(CLEARED_PLACES_KEY) : null;
            if (raw) {
                const arr = JSON.parse(raw) as number[];
                if (Array.isArray(arr)) {
                    setClearedPlaceIds(arr.map((n) => Number(n)).filter((n) => Number.isFinite(n)));
                }
            }
        } catch {}
    }, []);

    const flow = data?.flow;
    const tokens = data?.tokens || {};
    const bgImage = data?.backgroundImage || null;

    // 메시지 로딩
    useEffect(() => {
        (async () => {
            try {
                const ids =
                    (Array.isArray(flow?.intro) &&
                        Array.isArray(flow?.intro[0]?.ids) &&
                        (flow!.intro![0]!.ids as number[])) ||
                    (Array.isArray(flow?.ids) && (flow!.ids as number[])) ||
                    [];
                if (ids.length > 0) {
                    const res = await fetch(`/api/escape/messages?ids=${ids.join(",")}`, { cache: "no-store" });
                    const json = await res.json().catch(() => ({}));
                    const list = Array.isArray(json?.messages) ? json.messages : [];
                    const onlyIntro = list.filter(
                        (m: any) => !m?.placeId && String(m?.type || "").toLowerCase() !== "place"
                    );
                    if (onlyIntro.length > 0) {
                        const mapped = onlyIntro.map((m: any) => {
                            const role = String(m?.role || "")
                                .trim()
                                .toLowerCase();
                            const speaker = String(m?.speaker || "")
                                .trim()
                                .toLowerCase();
                            let type = "npc";
                            if (role === "system" || speaker === "system") type = "system";
                            else if (
                                role === "user" ||
                                speaker === "me" ||
                                speaker === "나" ||
                                speaker === "user" ||
                                speaker === "player"
                            )
                                type = "me";
                            else type = "npc";
                            return { type, text: String(m?.text || ""), speaker: String(m?.speaker || "") };
                        });
                        setIntroMessages(mapped);
                        return;
                    }
                }
                setIntroMessages([]);
            } catch {
                setIntroMessages([]);
            }
        })();
    }, [flow]);

    // (모바일: 한 번에 렌더링) 인트로 메시지 점진 노출 비활성화

    useEffect(() => {
        if (!showPreface) return;
        const t = setTimeout(() => setShowPreface(false), 4000);
        return () => clearTimeout(t);
    }, [showPreface]);

    useEffect(() => {
        const el = lastMsgRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                setShowNext(entry.isIntersecting);
            },
            { root: null, threshold: 0.2 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [lastMsgRef.current, introMessages]);

    const handleStartPlace = async (placeId: number, placeData?: any) => {
        setIsPlayingStory(true);
        setIsPlaceClear(false);
        setStoryLines([]);
        setMissions([]);
        setVisibleLines([]);
        setCurrentLineIndex(0);
        setActiveMission(null);
        setPendingMission(null);
        resumeIndexRef.current = null;
        try {
            // 0) 기존에 깨둔 미션 복원
            let restoredCleared: number[] = [];
            try {
                const raw = typeof window !== "undefined" ? localStorage.getItem(storageKeyForPlace(placeId)) : null;
                if (raw) {
                    const arr = JSON.parse(raw) as number[];
                    if (Array.isArray(arr)) {
                        restoredCleared = arr.map((n) => Number(n)).filter((n) => Number.isFinite(n));
                        setClearedMissions(
                            restoredCleared.reduce((acc, id) => {
                                acc[id] = true;
                                return acc;
                            }, {} as Record<number, boolean>)
                        );
                    }
                }
            } catch {}
            const source = placeData ?? selectedPlace;
            // 서버에서 완료된 미션 개수 조회(있다면 앞에서부터 그 개수만큼 완료 처리)
            let serverClearedCount = 0;
            try {
                const pidForFetch = Number(placeData?.id ?? selectedPlace?.id ?? placeId);
                if (Number.isFinite(pidForFetch)) {
                    const r = await fetch(`/api/submit-mission?chapterId=${pidForFetch}`, {
                        cache: "no-store",
                        credentials: "include",
                    });
                    if (r.ok) {
                        const j = await r.json().catch(() => ({}));
                        serverClearedCount = Number(j?.count || 0);
                    }
                }
            } catch {}
            const localStories = Array.isArray((source as any)?.stories)
                ? ((source as any)?.stories as StoryItem[])
                : [];
            const localMissions = Array.isArray((source as any)?.missions)
                ? ((source as any)?.missions as MissionItem[])
                : [];
            if (localStories.length > 0 || localMissions.length > 0) {
                // 서버 클리어 개수를 토대로 맨 앞 N개 미션을 완료 처리
                if (serverClearedCount > 0 && localMissions.length > 0) {
                    const sorted = localMissions
                        .slice()
                        .sort(
                            (a: any, b: any) =>
                                (Number(a?.missionNumber || 0) || 0) - (Number(b?.missionNumber || 0) || 0)
                        );
                    const toClear = sorted.slice(0, Math.min(serverClearedCount, sorted.length));
                    setClearedMissions((prev) => {
                        const upd = { ...prev };
                        toClear.forEach((m) => (upd[Number(m.id)] = true));
                        // localStorage 동기화
                        try {
                            const pid = Number((source as any)?.id ?? placeId);
                            const key = storageKeyForPlace(pid);
                            const ids = Object.keys(upd).map((k) => Number(k));
                            if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(ids));
                        } catch {}
                        return upd;
                    });
                }
                setStoryLines(localStories);
                setMissions(localMissions);
                // 스토리는 항상 처음부터 시작하되, 미션은 cleared 처리로 자동 스킵
                processNextLine(0, localStories, localMissions);
                return;
            }
            const res = await fetch(`/api/escape/place/detail?placeId=${placeId}`);
            const json = await res.json();
            const stories = Array.isArray(json?.stories) ? (json.stories as StoryItem[]) : [];
            const missionsFromApi = Array.isArray(json?.missions) ? (json.missions as MissionItem[]) : [];
            if (serverClearedCount > 0 && missionsFromApi.length > 0) {
                const sorted = missionsFromApi
                    .slice()
                    .sort(
                        (a: any, b: any) => (Number(a?.missionNumber || 0) || 0) - (Number(b?.missionNumber || 0) || 0)
                    );
                const toClear = sorted.slice(0, Math.min(serverClearedCount, sorted.length));
                setClearedMissions((prev) => {
                    const upd = { ...prev };
                    toClear.forEach((m) => (upd[Number(m.id)] = true));
                    try {
                        const pid = Number(placeId);
                        const key = storageKeyForPlace(pid);
                        const ids = Object.keys(upd).map((k) => Number(k));
                        if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(ids));
                    } catch {}
                    return upd;
                });
            }
            setStoryLines(stories);
            setMissions(missionsFromApi);
            // 스토리는 항상 처음부터 시작
            processNextLine(0, stories, missionsFromApi);
        } catch (e) {
            console.error(e);
            alert("데이터를 불러오는데 실패했습니다.");
            setIsPlayingStory(false);
        }
    };

    const processNextLine = (idx: number, allStories: StoryItem[], allMissions: MissionItem[]) => {
        if (idx >= allStories.length) return;
        const current = allStories[idx];

        // 1) 현재 대사 출력
        setVisibleLines((prev) => [...prev, current]);
        setCurrentLineIndex(idx);
        setTimeout(() => {
            storyEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);

        // 2) 미션 체크
        const currentMissionId = (current as any)?.missionId;
        if (currentMissionId) {
            const missionById = allMissions.find((m) => Number(m.id) === Number(currentMissionId));
            if (missionById) {
                const alreadyCleared =
                    clearedMissions[Number(missionById.id)] || solvedMissionIds.includes(Number(missionById.id));
                if (!alreadyCleared) {
                    try {
                        console.log("🧩 미션 발견! 대화 일시정지:", missionById);
                    } catch {}
                    resumeIndexRef.current = idx + 1; // 미션 후 재개 인덱스 저장
                    setPendingMission(missionById);
                    setTimeout(() => {
                        setValidationError("");
                        setMissionAnswer("");
                        setPhotoFiles([]);
                        setPhotoPreviewUrls([]);
                        setActiveMission(missionById); // activeMission으로 모달 오픈
                    }, 1000);
                    return; // 여기서 종료 → 아래 다음 대사 예약 안 함
                } else {
                    try {
                        console.log("✅ 이미 완료한 미션입니다. 진행합니다.");
                    } catch {}
                }
            }
        }

        // 2-b) Fallback: 텍스트/트리거에서 미션 감지 (missionId가 없는 경우)
        // - 패턴: [미션 1], 미션 1, MISSION_1, MISSION-1
        // - 번호가 없고 '미션' 키워드만 있으면 아직 미완료인 첫 미션을 사용
        const dialogueText = String((current as any)?.dialogue || "");
        const triggerText = String((current as any)?.nextTrigger || "");
        const textNumMatch = dialogueText.match(/(?:미션|MISSION)[\s_\-]*([0-9]+)/i);
        const trigNumMatch = triggerText.match(/MISSION[\s_\-]*([0-9]+)/i);
        let candidateMission: MissionItem | undefined;
        const desiredNumber = Number(textNumMatch?.[1] || trigNumMatch?.[1] || NaN);
        if (!currentMissionId) {
            if (Number.isFinite(desiredNumber)) {
                candidateMission =
                    allMissions.find((m: any) => Number(m.missionNumber) === desiredNumber) ||
                    allMissions[desiredNumber - 1];
            } else if (/미션/i.test(dialogueText) || /MISSION/i.test(triggerText)) {
                candidateMission = allMissions.find(
                    (m) => !clearedMissions[Number(m.id)] && !solvedMissionIds.includes(Number(m.id))
                );
            }
            if (candidateMission) {
                try {
                    console.log("🧩 (Fallback) 텍스트/트리거 기반 미션 감지:", candidateMission);
                } catch {}
                resumeIndexRef.current = idx + 1;
                setPendingMission(candidateMission);
                setTimeout(() => {
                    setValidationError("");
                    setMissionAnswer("");
                    setPhotoFiles([]);
                    setPhotoPreviewUrls([]);
                    setActiveMission(candidateMission as any);
                }, 1000);
                return;
            }
        }

        // 3) 특수 트리거
        const trigger = current.nextTrigger;
        if (trigger) {
            const t = String(trigger || "").toUpperCase();
            if (t === "CLEAR_PLACE") {
                setIsPlaceClear(true);
                // 장소 완료 처리 후 지도 복귀 및 등 비활성화
                setTimeout(() => {
                    const pid = Number((selectedPlace as any)?.id ?? 0);
                    if (pid) {
                        try {
                            const next = Array.from(new Set([...(clearedPlaceIds || []), pid]));
                            setClearedPlaceIds(next);
                            if (typeof window !== "undefined") {
                                localStorage.setItem(CLEARED_PLACES_KEY, JSON.stringify(next));
                            }
                        } catch {}
                    }
                    setSelectedPlace(null);
                    setSelectedCategory(null);
                    setIsPlayingStory(false);
                }, 800);
                return;
            }
        }

        // 3-b) 마지막 대사이고 모든 미션이 완료된 경우 자동 완료 처리
        if (idx === allStories.length - 1) {
            const placeAllMissionIds = (allMissions || []).map((m) => Number(m.id));
            const allCleared =
                placeAllMissionIds.length === 0 ||
                placeAllMissionIds.every(
                    (mid) => clearedMissions[Number(mid)] || solvedMissionIds.includes(Number(mid))
                );
            if (allCleared) {
                setTimeout(() => {
                    const pid = Number((selectedPlace as any)?.id ?? 0);
                    if (pid) {
                        try {
                            const next = Array.from(new Set([...(clearedPlaceIds || []), pid]));
                            setClearedPlaceIds(next);
                            if (typeof window !== "undefined") {
                                localStorage.setItem(CLEARED_PLACES_KEY, JSON.stringify(next));
                            }
                        } catch {}
                    }
                    setIsPlaceClear(true);
                    setSelectedPlace(null);
                    setSelectedCategory(null);
                    setIsPlayingStory(false);
                }, 1200);
                return;
            }
        }

        // 4) 다음 대사 자동 재생 (activeMission 체크 제거)
        setTimeout(() => {
            processNextLine(idx + 1, allStories, allMissions);
        }, 1500);
    };

    const handleConfirm = async () => {
        if (!activeMission) return;
        try {
            setIsSubmitting(true);
            const t = String(activeMission.missionType || "").toUpperCase();
            if (t === "PHOTO") {
                const files = photoFiles || [];
                if (files.length < 2) {
                    setValidationError("사진 2장을 모두 업로드해 주세요.");
                    setIsSubmitting(false);
                    return;
                }
                const form = new FormData();
                files.forEach((f) => form.append("photos", f, f.name));
                
                // 탈출방 업로드를 위한 파라미터 추가
                if (storyId) {
                    form.append("type", "escape");
                    form.append("escapeId", storyId.toString());
                }
                
                const uploadRes = await fetch("/api/upload", { 
                    method: "POST", 
                    body: form,
                    credentials: "include", // 쿠키를 포함하여 userId를 서버에서 가져올 수 있도록
                });
                if (!uploadRes.ok) {
                    const err = await uploadRes.json().catch(() => ({} as any));
                    setValidationError(err?.message || "업로드에 실패했습니다.");
                    setIsSubmitting(false);
                    return;
                }
                const uploadJson = (await uploadRes.json()) as any;
                const urls: string[] = uploadJson?.photo_urls || uploadJson?.photoUrls || [];
                if (!Array.isArray(urls) || urls.length < 2) {
                    setValidationError("업로드된 사진 URL을 확인하지 못했습니다.");
                    setIsSubmitting(false);
                    return;
                }
                const chapterId = Number((selectedPlace as any)?.id ?? 0);
                const submitRes = await fetch("/api/submit-mission", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        chapterId,
                        missionType: "PHOTO",
                        isCorrect: true,
                        photoUrls: urls,
                    }),
                });
                if (!submitRes.ok) {
                    const err = await submitRes.json().catch(() => ({} as any));
                    setValidationError(err?.message || "제출 저장에 실패했습니다.");
                    setIsSubmitting(false);
                    return;
                }
                try {
                    setClearedMissions((prev) => {
                        const updated = { ...prev, [Number(activeMission.id)]: true };
                        try {
                            const pid = Number((selectedPlace as any)?.id ?? 0);
                            const key = storageKeyForPlace(pid);
                            const ids = Object.keys(updated).map((k) => Number(k));
                            if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(ids));
                        } catch {}
                        return updated;
                    });
                } catch {}
                try {
                    photoPreviewUrls.forEach((u) => URL.revokeObjectURL(u));
                } catch {}
                setPhotoFiles([]);
                setPhotoPreviewUrls([]);
                setValidationError("");
            } else {
                if (t === "QUIZ" || t === "TEXT") {
                    const normalize = (s: any) =>
                        String(s ?? "")
                            .normalize("NFKC")
                            .toLowerCase()
                            .replace(/\s+/g, "")
                            .replace(/[.,!?'"`~\-_/\\(){}\[\]:;<>@#$%^&*+=|]/g, "");
                    const rawCorrect =
                        (activeMission as any)?.answer ?? (activeMission as any)?.missionPayload?.answer ?? "";
                    const validAnswers: string[] = Array.isArray(rawCorrect)
                        ? (rawCorrect as any[]).map((x) => String(x))
                        : String(rawCorrect)
                              .split(/[|,]/)
                              .map((s) => s.trim())
                              .filter(Boolean);
                    const hasAnyCorrect = validAnswers.length > 0 || String(rawCorrect).trim().length > 0;
                    const normalizedUser = normalize(missionAnswer);
                    const isCorrect = hasAnyCorrect
                        ? validAnswers.length
                            ? validAnswers.map(normalize).some((a) => a === normalizedUser)
                            : normalizedUser.length > 0 && normalizedUser === normalize(rawCorrect)
                        : true; // 서버가 정답을 보내지 않으면 통과
                    if (!isCorrect) {
                        setValidationError("틀렸습니다. 다시 시도해보세요.");
                        setIsSubmitting(false);
                        return;
                    }
                }
                const chapterId = Number((selectedPlace as any)?.id ?? 0);
                const submitRes = await fetch("/api/submit-mission", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        chapterId,
                        missionType: t,
                        isCorrect: true,
                        textAnswer: missionAnswer.trim(),
                    }),
                });
                if (!submitRes.ok) {
                    const err = await submitRes.json().catch(() => ({} as any));
                    setValidationError(err?.message || "제출 저장에 실패했습니다.");
                    setIsSubmitting(false);
                    return;
                }
                try {
                    setClearedMissions((prev) => {
                        const updated = { ...prev, [Number(activeMission.id)]: true };
                        try {
                            const pid = Number((selectedPlace as any)?.id ?? 0);
                            const key = storageKeyForPlace(pid);
                            const ids = Object.keys(updated).map((k) => Number(k));
                            if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(ids));
                        } catch {}
                        return updated;
                    });
                } catch {}
            }
            setShowSuccessModal(true);
            setMissionAnswer("");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleMissionSuccessComplete = () => {
        setShowSuccessModal(false);
        setActiveMission(null);
        setPhotoFiles([]);
        setPhotoPreviewUrls([]);
        setMissionAnswer("");
        setPendingMission(null);
        setTimeout(() => {
            const nextIdx = Number.isFinite(resumeIndexRef.current as any)
                ? (resumeIndexRef.current as number)
                : currentLineIndex + 1;
            resumeIndexRef.current = null;
            processNextLine(nextIdx, storyLines, missions);
        }, 500);
    };

    const categories = React.useMemo(() => {
        const raw =
            (Array.isArray(flow?.categories) && flow?.categories) ||
            (Array.isArray(flow?.places) && flow?.places) ||
            [];
        return (raw as any[]).map((c, idx) => ({
            id: String(c?.id ?? c?.key ?? idx),
            name: String(c?.name ?? c?.title ?? ""),
            icon: c?.icon ?? "",
            position: c?.position ?? { top: "50%", left: "50%" },
            label: String(c?.label ?? ""),
            description: String(c?.description ?? ""),
            image: c?.image ?? c?.thumbnail ?? "",
            places: Array.isArray(c?.places) ? c.places : [],
        }));
    }, [flow]);

    const rawPlaces = React.useMemo<any[]>(() => {
        const places = (flow as any)?.places;
        const placeOptions = (flow as any)?.placeOptions;
        if (Array.isArray(placeOptions)) return placeOptions as any[];
        if (Array.isArray(places)) return places as any[];
        return [];
    }, [flow]);

    const fallbackMarkers = React.useMemo(() => {
        if (rawPlaces.length > 0) {
            const defaultPositions = [
                { top: "25%", left: "28%" },
                { top: "35%", left: "70%" },
                { top: "62%", left: "24%" },
                { top: "68%", left: "66%" },
                { top: "45%", left: "50%" },
                { top: "20%", left: "50%" },
                { top: "80%", left: "40%" },
                { top: "50%", left: "15%" },
                { top: "50%", left: "85%" },
            ];
            return rawPlaces.map((place, idx) => {
                const assignedPos = (place as any)?.position ?? defaultPositions[idx % defaultPositions.length];
                const themeKey = getPlaceThemeKey(place);
                const labelKo =
                    THEME_LABEL_KO[themeKey] ||
                    (place as any)?.label ||
                    (place as any)?.category ||
                    (place as any)?.theme ||
                    "미션";
                return {
                    id: String((place as any)?.id ?? idx),
                    name: (place as any)?.name,
                    label: labelKo,
                    position: assignedPos,
                    places: [place],
                    image: (place as any)?.image || (place as any)?.imageUrl || "",
                    description: (place as any)?.description || "",
                    icon: (place as any)?.icon || "",
                };
            });
        }
        return [];
    }, [rawPlaces]);

    const displayTitle = tokens?.title || "1919 DM";
    const displaySubtitle = tokens?.subtitle || "익선동 리얼타임 미스터리";
    const mapUrl =
        (flow as any)?.map?.image ||
        (tokens as any)?.mapImage ||
        "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/escape/jongro/jongroMap.png";
    const combinedCategories: any[] = fallbackMarkers as any[];
    const selectedCategoryData = combinedCategories.find((c: any) => c.id === selectedCategory);

    // 가상의 모달 상태 (activeMission 유무로 대체했지만 타입 안전을 위해 선언)
    const [missionModalOpen, setMissionModalOpen] = useState<boolean>(false);

    return (
        <div className="jongro-exact-container">
            {showPreface && (
                <div className="absolute inset-0 flex items-end justify-center p-4 pb-[12vh] animate-fade-in overflow-y-auto z-[1500]">
                    <div className="w-full max-w-lg rounded-2xl overflow-hidden">
                        <div
                            ref={prefaceScrollRef}
                            className="bg-white/95 rounded-t-2xl p-5 max-h-[70vh] overflow-y-auto space-y-4 shadow-2xl"
                        >
                            <header className="text-center mb-6 pt-4 pb-3 border-b border-[#c8aa64]">
                                <h1 className="font-serif text-3xl text-[#c8aa64] tracking-widest font-black">
                                    {displayTitle}
                                </h1>
                                <h2 className="font-serif text-sm text-[#8b8070] mt-2 font-bold">{displaySubtitle}</h2>
                                <div className="w-16 h-[3px] bg-gradient-to-r from-transparent via-[#c8aa64] to-transparent mx-auto mt-4" />
                            </header>
                            <div className="space-y-4">
                                {String(data?.synopsis || "")
                                    .split("\n")
                                    .map((line, i) => {
                                        if (!line.trim()) return <div key={i} className="h-2" />;
                                        return (
                                            <div key={i} className="flex justify-center">
                                                <div className="max-w-[90%] px-4 py-3 rounded-xl bg-[#f5e6d3] text-[#3a3530] border border-[#d4a574] shadow-sm text-center">
                                                    <div className="leading-7 text-[0.95rem] font-serif font-medium">
                                                        <span>{nl2br(line)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                            <div className="h-10" />
                        </div>
                        <div className="bg-white/95 rounded-b-2xl p-4 text-center border-t text-[#c8aa64] text-xs font-bold">
                            접속 중...
                        </div>
                    </div>
                </div>
            )}

            {!mapOverlay && (
                <div className="message-scroll-area-exact">
                    <header className="story-header-exact">
                        <h1 className="main-title-exact">{displayTitle}</h1>
                        <h2 className="sub-title-exact">{displaySubtitle}</h2>
                        <div className="header-divider-exact"></div>
                    </header>
                    <div className="message-list-exact" ref={introRef}>
                        {introMessages.map((msg, index) => (
                            <div key={index} className="w-full">
                                {msg.type === "system" ? (
                                    <div className="system-notificationbox-exact">
                                        <div className="system-content-exact">
                                            <span className="text-xl inline-block align-middle mr-1">⚠️</span>
                                            {nl2br(msg.text)}
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`message-row-exact ${msg.type === "me" ? "row-me" : "row-npc"}`}>
                                        {msg.type === "npc" && (
                                            <div className="npc-name-tag">{formatSpeakerName(msg.speaker)}</div>
                                        )}
                                        <div className={`message-bubble-exact type-${msg.type}`}>
                                            <div className="bubble-text-exact">{nl2br(msg.text)}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={lastMsgRef} className="map-trigger-exact" />
                    </div>
                    <div className="intro-bottom-cta-exact">
                        <button className="intro-cta-button-exact" onClick={() => setMapOverlay(true)}>
                            <span className="btn-content">
                                NEXT STAGE <span className="ml-2 text-xs">▶</span>
                            </span>
                        </button>
                    </div>
                    <div className="message-footer-spacer-exact"></div>
                </div>
            )}

            {mapOverlay && (
                <div className="map-overlay-exact">
                    <div className="map-overlay-bg-exact" />
                    <div className="map-overlay-content-exact">
                        <button
                            className="map-top-left-back-exact"
                            aria-label="뒤로"
                            onClick={() => {
                                setSelectedCategory(null);
                                setSelectedPlace(null);
                                setMapOverlay(false);
                                setTimeout(() => {
                                    introRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }, 0);
                            }}
                        >
                            ←
                        </button>
                        <div className="map-container-exact overlay">
                            <div className="map-background-exact" style={{ backgroundImage: `url(${mapUrl})` }} />
                            {!selectedCategory && (
                                <div className="markers-container-exact">
                                    {combinedCategories.map((category) => {
                                        const isCleared = clearedPlaceIds.includes(Number(category.id));
                                        return (
                                            <button
                                                key={category.id}
                                                className={`map-marker-exact ${isCleared ? "cleared opacity-70" : ""}`}
                                                style={{
                                                    top: (category as any).position.top,
                                                    left: (category as any).position.left,
                                                }}
                                                onClick={() => {
                                                    if (isCleared) {
                                                        setClearedModalPlaceName(
                                                            String((category as any).label || "이 장소")
                                                        );
                                                        setShowClearedModal(true);
                                                    } else {
                                                        setSelectedCategory(category.id);
                                                    }
                                                }}
                                                title={(category as any).label}
                                            >
                                                <div className={`marker-lantern-exact ${isCleared ? "cleared" : ""}`}>
                                                    <span className="lantern-ring"></span>
                                                </div>
                                                <div className="marker-label-exact">{(category as any).label}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {showClearedModal && (
                                <div className="fixed inset-0 z-[2500] bg-black/80 flex items-center justify-center p-6">
                                    <div className="w-full max-w-[360px] bg-[#1a1814] rounded-2xl border border-[#c8aa64] shadow-2xl overflow-hidden">
                                        <div className="px-6 py-4 border-b border-[#c8aa64]/30 text-center">
                                            <span
                                                className="text-[#c8aa64] font-bold tracking-widest"
                                                style={{ fontFamily: "'Eulyoo1945', serif" }}
                                            >
                                                안내
                                            </span>
                                        </div>
                                        <div className="px-6 py-6 text-center">
                                            <p className="text-[#eaddcf] font-serif text-lg">
                                                <span className="font-bold text-[#c8aa64]">
                                                    {clearedModalPlaceName}
                                                </span>
                                                의 미션은 이미 완료되었습니다.
                                            </p>
                                            <p className="text-[#8b8070] mt-2 text-sm">
                                                다른 랜턴을 선택해 진행해 주세요.
                                            </p>
                                        </div>
                                        <div className="px-6 pb-6">
                                            <button
                                                onClick={() => setShowClearedModal(false)}
                                                className="w-full py-3 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#bfa048] text-[#1a1814] font-extrabold tracking-widest border border-[#f5e6d3]/20 active:scale-95"
                                                style={{ fontFamily: "'Eulyoo1945', serif" }}
                                            >
                                                확인
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {selectedCategory && !selectedPlace && (
                                <div className="popup-card-exact">
                                    <button className="popup-close-exact" onClick={() => setSelectedCategory(null)}>
                                        ✕
                                    </button>
                                    <div className="card-frame-exact">
                                        <h2 className="card-title-exact">{(selectedCategoryData as any)?.name}</h2>
                                        {(selectedCategoryData as any)?.image && (
                                            <div className="card-image-exact">
                                                <img
                                                    src={(selectedCategoryData as any)?.image}
                                                    alt={(selectedCategoryData as any)?.name || "preview"}
                                                    className="card-image-tag-exact"
                                                    loading="lazy"
                                                />
                                            </div>
                                        )}
                                        <p className="card-desc-exact">{(selectedCategoryData as any)?.description}</p>
                                        <div className="grid grid-cols-1 gap-2 mt-4 w-full">
                                            {(selectedCategoryData as any)?.places?.map((p: any) => (
                                                <button
                                                    key={p.id}
                                                    className="card-button-exact"
                                                    onClick={() => {
                                                        setSelectedPlace(p);
                                                        handleStartPlace(p.id, p);
                                                    }}
                                                    title={p.name || "place"}
                                                >
                                                    미션 하러 가기
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {selectedPlace && (
                                <div className="popup-card-exact detail-exact">
                                    {!isPlayingStory ? (
                                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[350px] z-[100] animate-fade-in-up">
                                            <div className="relative bg-[#fdfbf7] rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden border border-[#c8aa64]">
                                                {/* ... 장소 상세 UI (기존 유지) ... */}
                                                <div className="bg-[#eae0d0] px-5 py-3 border-b border-[#c8aa64] flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-[#c8aa64]"></span>
                                                        <span className="text-xs font-serif font-bold text-[#5a4d41] tracking-widest">
                                                            LOCATION DATA
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => setSelectedPlace(null)}
                                                        className="text-[#8b8070] hover:text-[#3a3530] transition-colors p-1"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                                <div className="p-6 flex flex-col items-center text-center relative">
                                                    <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-black to-transparent pointer-events-none" />
                                                    <h3 className="text-2xl font-serif font-bold text-[#2a2620] mb-2 relative inline-block z-10">
                                                        {(selectedPlace as any).name || "장소명 없음"}
                                                        <span className="absolute -bottom-1 left-0 w-full h-[2px] bg-[#c8aa64]/50"></span>
                                                    </h3>
                                                    <div className="mb-5">
                                                        <span className="px-2 py-0.5 text-[10px] border border-[#8b8070] text-[#8b8070] rounded-sm font-serif uppercase">
                                                            {(selectedPlace as any).category || "Place"}
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-40 bg-[#f0ebe5] mb-5 rounded border border-[#dcdcdc] flex items-center justify-center overflow-hidden shadow-inner relative group">
                                                        {(selectedPlace as any).imageUrl ||
                                                        (selectedPlace as any).image ? (
                                                            <img
                                                                src={
                                                                    (selectedPlace as any).imageUrl ||
                                                                    (selectedPlace as any).image
                                                                }
                                                                alt="place"
                                                                className="w-full h-full object-cover sepia-[0.3] contrast-[0.95] group-hover:sepia-0 transition-all duration-700"
                                                            />
                                                        ) : (
                                                            <div className="flex flex-col items-center text-[#c8aa64] opacity-50">
                                                                <span className="text-4xl mb-2">📷</span>
                                                                <span className="text-xs font-serif">
                                                                    사진 기록 없음
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/5 mix-blend-multiply pointer-events-none"></div>
                                                    </div>
                                                    <p className="text-[#4a4440] text-sm font-serif leading-relaxed mb-6 break-keep z-10 px-2">
                                                        {(selectedPlace as any).description ||
                                                            "이 장소에 대한 정보가 없습니다."}
                                                    </p>
                                                    <button
                                                        className="w-full py-3.5 bg-[#3a3530] text-[#eaddcf] font-serif font-bold text-lg rounded shadow-[0_4px_14px_rgba(0,0,0,0.25)] hover:bg-[#2a2620] active:scale-95 transition-all flex items-center justify-center gap-2 z-10 border border-[#5a4d41]"
                                                        onClick={() => handleStartPlace((selectedPlace as any).id)}
                                                    >
                                                        <span>🧩</span> 미션 시작하기
                                                    </button>
                                                </div>
                                                <div className="h-1.5 w-full bg-[#c8aa64]"></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col h-full bg-[#2a2620]" style={{ height: "80vh" }}>
                                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                                {visibleLines.map((line, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`message-wrapper-exact ${
                                                            line.speaker === "System" ? "wrapper-system" : "wrapper-npc"
                                                        } ${
                                                            line.speaker === "Me" || line.speaker === "나"
                                                                ? "wrapper-me"
                                                                : ""
                                                        }`}
                                                    >
                                                        {line.speaker === "System" ? (
                                                            <div className="system-notificationbox-exact relative">
                                                                <div className="system-content-exact">
                                                                    {nl2br(line.dialogue)}
                                                                </div>
                                                                {idx === visibleLines.length - 1 &&
                                                                    pendingMission &&
                                                                    !activeMission &&
                                                                    !showSuccessModal && (
                                                                        <button
                                                                            onClick={() =>
                                                                                setActiveMission(pendingMission)
                                                                            }
                                                                            className="absolute left-1/2 bottom-0 translate-x-[-50%] translate-y-[50%] z-20 flex items-center gap-2 px-5 py-2 rounded-full bg-[#1a1814] border border-[#c8aa64] text-[#c8aa64] text-sm font-bold tracking-widest shadow-[0_4px_15px_rgba(0,0,0,0.5)] hover:bg-[#c8aa64] hover:text-[#1a1814] transition-all active:scale-95 whitespace-nowrap"
                                                                            style={{
                                                                                fontFamily: "'Eulyoo1945', serif",
                                                                            }}
                                                                        >
                                                                            <svg
                                                                                xmlns="http://www.w3.org/2000/svg"
                                                                                width="16"
                                                                                height="16"
                                                                                viewBox="0 0 24 24"
                                                                                fill="none"
                                                                                stroke="currentColor"
                                                                                strokeWidth="2.5"
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                            >
                                                                                <path d="M21 2v6h-6"></path>
                                                                                <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                                                                                <path d="M3 22v-6h6"></path>
                                                                                <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                                                                            </svg>
                                                                            미션 다시 확인하기
                                                                        </button>
                                                                    )}
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {/* ME (오른쪽) */}
                                                                {line.speaker === "Me" || line.speaker === "나" ? (
                                                                    <div className="message-bubble-exact type-me">
                                                                        <div className="bubble-text-exact">
                                                                            {nl2br(line.dialogue)}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    /* NPC (왼쪽) */
                                                                    <div className="flex flex-col items-start max-w-[85%] pt-10">
                                                                        <span className="text-xs">
                                                                            {formatSpeakerName(line.speaker)}
                                                                        </span>
                                                                        <div className="message-bubble-exact type-npc">
                                                                            <div className="bubble-text-exact">
                                                                                {nl2br(line.dialogue)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                                <div ref={storyEndRef} />
                                            </div>

                                            {/* ✨ 마진 문제 해결된 최종 모달 코드 */}
                                            {activeMission && !showSuccessModal && (
                                                <div className="fixed inset-0 z-[2000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.3s_ease-out]">
                                                    {/* 모달 박스 */}
                                                    <div
                                                        className="w-full max-w-[350px] bg-[#1a1814] rounded-2xl border border-[#c8aa64] shadow-[0_0_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative max-h-[92vh]"
                                                        style={{ fontFamily: "'RIDIBatang', 'Noto Serif KR', serif" }}
                                                    >
                                                        {/* 1. 헤더 */}
                                                        <div className="relative pt-6 pb-2 px-5 flex items-center justify-center shrink-0 z-10">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xl filter sepia(1) brightness-125">
                                                                    🧩
                                                                </span>
                                                                <span
                                                                    className="text-[#c8aa64] font-bold text-xl tracking-[0.2em]"
                                                                    style={{ fontFamily: "'Eulyoo1945', serif" }}
                                                                >
                                                                    MISSION
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => setActiveMission(null)}
                                                                className="absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#c8aa64]/40 hover:text-[#c8aa64] rounded-full hover:bg-[#c8aa64]/10 transition-colors"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>

                                                        {/* 2. 컨텐츠 영역 */}
                                                        <div className="p-6 pt-2 pb-0 overflow-y-auto hide-scrollbar">
                                                            {/* 질문 */}
                                                            <p className="text-[#eaddcf] text-[1.1rem] leading-loose text-center font-medium break-keep mb-6 mt-4">
                                                                {(activeMission as any)?.question ??
                                                                    (activeMission as any)?.missionPayload?.question ??
                                                                    ""}
                                                            </p>

                                                            {/* 힌트 */}
                                                            {((activeMission as any)?.hint ??
                                                                (activeMission as any)?.missionPayload?.hint) && (
                                                                <div className="text-center mb-4 animate-pulse">
                                                                    <p className="text-[#c8aa64] text-xs font-bold tracking-widest mb-1 opacity-80">
                                                                        💡 HINT
                                                                    </p>
                                                                    <p className="text-[#d4b886] text-sm opacity-90 font-light">
                                                                        {(activeMission as any)?.hint ??
                                                                            (activeMission as any)?.missionPayload
                                                                                ?.hint}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* 3. 사진 업로드: div로 감싸고 여기서 mt-10을 줌 (확실한 방법) */}
                                                            {String(
                                                                (activeMission as any)?.missionType
                                                            ).toUpperCase() === "PHOTO" ? (
                                                                <div className="w-full pt-10">
                                                                    {" "}
                                                                    {/* 🟢 여기서 마진을 줍니다 */}
                                                                    <label
                                                                        className={`relative w-full aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden group hover:border-[#c8aa64] hover:bg-[#c8aa64]/5 ${
                                                                            photoFiles.length > 0
                                                                                ? "border-[#c8aa64] bg-black"
                                                                                : "border-[#c8aa64]/30 bg-transparent"
                                                                        }`}
                                                                    >
                                                                        <input
                                                                            type="file"
                                                                            accept="image/*"
                                                                            multiple
                                                                            className="hidden"
                                                                            onChange={(e) => {
                                                                                if (e.target.files) {
                                                                                    const f = Array.from(
                                                                                        e.target.files
                                                                                    );
                                                                                    if (f.length > 2) {
                                                                                        alert("최대 2장입니다.");
                                                                                        return;
                                                                                    }
                                                                                    setPhotoFiles(f as File[]);
                                                                                    setPhotoPreviewUrls(
                                                                                        f.map((file) =>
                                                                                            URL.createObjectURL(file)
                                                                                        )
                                                                                    );
                                                                                    setValidationError("");
                                                                                }
                                                                            }}
                                                                        />

                                                                        {photoFiles.length > 0 ? (
                                                                            <div className="absolute inset-0 grid grid-cols-2 gap-[1px] bg-[#c8aa64]">
                                                                                {photoPreviewUrls.map((url, idx) => (
                                                                                    <div
                                                                                        key={idx}
                                                                                        className="relative bg-black w-full h-full"
                                                                                    >
                                                                                        <img
                                                                                            src={url}
                                                                                            className="w-full h-full object-cover opacity-90 contrast-110"
                                                                                            alt="preview"
                                                                                        />
                                                                                        <div className="absolute bottom-0 right-0 bg-black/60 text-[#c8aa64] text-[10px] px-2 py-0.5 font-bold">
                                                                                            #{idx + 1}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                    <span className="text-[#c8aa64] text-sm border border-[#c8aa64] px-3 py-1 rounded-full bg-[#1a1814]">
                                                                                        📷 다시 찍기
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-center p-4">
                                                                                <svg
                                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                                    className="h-9 w-9 text-[#c8aa64] opacity-40 mx-auto mb-3"
                                                                                    fill="none"
                                                                                    viewBox="0 0 24 24"
                                                                                    stroke="currentColor"
                                                                                >
                                                                                    <path
                                                                                        strokeLinecap="round"
                                                                                        strokeLinejoin="round"
                                                                                        strokeWidth={1}
                                                                                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                                                                                    />
                                                                                    <path
                                                                                        strokeLinecap="round"
                                                                                        strokeLinejoin="round"
                                                                                        strokeWidth={1}
                                                                                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                                                                                    />
                                                                                </svg>
                                                                                <p className="text-[#c8aa64] text-lg font-bold opacity-90">
                                                                                    터치하여 촬영하기
                                                                                </p>
                                                                                <p className="text-[#8b8070] text-xs mt-1 font-light tracking-wider">
                                                                                    총 2장의 사진이 필요합니다
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </label>
                                                                    {photoFiles.length === 1 && (
                                                                        <p className="text-center text-[#ff6b35] text-sm font-bold animate-pulse mt-2">
                                                                            ⚠️ 사진이 1장 더 필요합니다
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="w-full mt-10">
                                                                    {" "}
                                                                    {/* 텍스트 입력창도 동일하게 mt-10 */}
                                                                    <input
                                                                        type="text"
                                                                        value={missionAnswer}
                                                                        onChange={(e) => {
                                                                            setMissionAnswer(e.target.value);
                                                                            setValidationError("");
                                                                        }}
                                                                        placeholder="정답을 입력하세요"
                                                                        className="w-full bg-transparent border-b border-[#c8aa64]/50 px-4 py-3 text-[#eaddcf] placeholder-[#5a5450] text-center text-xl focus:outline-none focus:border-[#c8aa64] transition-colors"
                                                                        style={{ fontFamily: "'RIDIBatang', serif" }}
                                                                    />
                                                                </div>
                                                            )}

                                                            {/* 에러 메시지 */}
                                                            {validationError && (
                                                                <div className="mt-6 text-[#ff6b35] text-sm font-bold text-center">
                                                                    🛑 {validationError}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* 4. 하단 버튼 영역 */}
                                                        <div className="px-6 mt-4 pt-6 pb-8 shrink-0 bg-gradient-to-t from-[#1a1814] via-[#1a1814] to-transparent">
                                                            <button
                                                                onClick={handleConfirm}
                                                                disabled={
                                                                    isSubmitting ||
                                                                    (String(
                                                                        (activeMission as any)?.missionType
                                                                    ).toUpperCase() === "PHOTO" &&
                                                                        photoFiles.length < 2)
                                                                }
                                                                className={`w-full py-4 rounded-lg font-bold text-lg tracking-widest transition-all flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(0,0,0,0.5)] ${
                                                                    isSubmitting
                                                                        ? "bg-[#3a3530] text-[#5a5450]"
                                                                        : String(
                                                                              (activeMission as any)?.missionType
                                                                          ).toUpperCase() === "PHOTO" &&
                                                                          photoFiles.length < 2
                                                                        ? "bg-[#3a3530] text-[#5a5450] opacity-60"
                                                                        : "bg-gradient-to-r from-[#d4af37] to-[#bfa048] text-[#1a1814] hover:brightness-110 active:scale-95"
                                                                }`}
                                                                style={{ fontFamily: "'Eulyoo1945', serif" }}
                                                            >
                                                                {isSubmitting ? (
                                                                    <span className="animate-spin">⏳</span>
                                                                ) : (
                                                                    <>
                                                                        <span>📤</span> 제출하기
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* 성공 스탬프 모달 (버튼 업그레이드 적용) */}
                                            {showSuccessModal && (
                                                <div className="fixed inset-0 z-[3000] bg-black/90 flex items-center justify-center p-4 animate-fade-in">
                                                    <div className="flex flex-col items-center text-center w-full max-w-sm">
                                                        <div className="relative mb-8 animate-[stampBounce_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)_both]">
                                                            <div className="w-40 h-40 rounded-full border-4 border-emerald-500 flex items-center justify-center bg-emerald-900/20 shadow-[0_0_50px_rgba(16,185,129,0.3)] backdrop-blur-sm relative overflow-hidden">
                                                                <div className="absolute inset-0 border border-emerald-500/30 rounded-full m-2"></div>
                                                                <span className="text-7xl transform -rotate-12 drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">
                                                                    ✅
                                                                </span>
                                                            </div>
                                                            <div className="absolute -bottom-2 -right-4 bg-emerald-600 text-[#eaddcf] font-black text-xs px-3 py-1 rounded shadow-lg transform rotate-[-6deg] border border-emerald-400/50 tracking-widest">
                                                                VERIFIED
                                                            </div>
                                                        </div>
                                                        <h2 className="text-3xl font-serif font-bold text-[#eaddcf] mb-3 animate-[slideUp_0.6s_ease-out_0.3s_both] drop-shadow-md">
                                                            <span className="text-emerald-400 inline-block transform -skew-x-6 mr-2">
                                                                MISSION
                                                            </span>
                                                            <span>CLEAR!</span>
                                                        </h2>
                                                        <p className="text-[#8b8070] mb-10 animate-[slideUp_0.6s_ease-out_0.5s_both] text-sm font-medium tracking-wide">
                                                            훌륭합니다. 시간이 다시 흐르기 시작합니다.
                                                        </p>
                                                        {/* ✨ [수정된 부분] 골드 그라데이션 + 아이콘 버튼 */}
                                                        <button
                                                            onClick={handleMissionSuccessComplete}
                                                            className="group relative w-full max-w-[240px] py-4 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#bfa048] border border-[#f5e6d3]/20 shadow-[0_0_30px_rgba(212,175,55,0.25)] animate-[fadeIn_0.8s_ease-out_0.8s_both] hover:brightness-110 active:scale-95 transition-all duration-300 flex items-center justify-center gap-3"
                                                        >
                                                            <span className="font-serif font-bold text-[#1a1814] text-lg tracking-widest">
                                                                다음 이야기 보기
                                                            </span>
                                                            <div className="bg-[#1a1814]/10 rounded-full p-1 transition-transform group-hover:translate-x-1">
                                                                <svg
                                                                    width="16"
                                                                    height="16"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="#1a1814"
                                                                    strokeWidth="3"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                >
                                                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                                                </svg>
                                                            </div>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {isPlaceClear && !activeMission && (
                                                <div className="p-4 bg-[#1a1814] border-t border-[#c8aa64]">
                                                    <button
                                                        className="w-full bg-[#c8aa64] text-[#2a2620] py-3 rounded font-bold"
                                                        onClick={() => {
                                                            setSelectedPlace(null);
                                                            setSelectedCategory(null);
                                                            setIsPlayingStory(false);
                                                        }}
                                                    >
                                                        🎉 탐색 완료! (지도로 나가기)
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
    /* 1. 구글 폰트(@import)는 보안 정책상 막혔으므로 제거하고, 아래의 'cdn.jsdelivr.net' 폰트만 사용합니다. */
    
    /* component-local fonts */
    @font-face {
        font-family: 'Eulyoo1945';
        /* ✅ 수정됨: fastly -> cdn 으로 변경 (보안 정책 허용 도메인 사용) */
        src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_20-10-21@1.0/Eulyoo1945-Regular.woff') format('woff');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
    }
    
    @font-face {
        font-family: 'RIDIBatang';
        /* ✅ 수정됨: fastly -> cdn 으로 변경 */
        src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_twelve@1.0/RIDIBatang.woff') format('woff');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
    }

    /* 2. 기본 폰트 설정도 로드 가능한 폰트로 변경 */
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'RIDIBatang', serif; }
    
    .jongro-exact-container { max-width: 500px; margin: 0 auto; background-color: #1a1814; min-height: 100vh; }

    /* ... (나머지 스타일은 그대로 유지) ... */
    
    /* 배경 패턴 */
        .message-scroll-area-exact {
          padding: 20px;
        background-color: #2a2620;
          background-image:
            linear-gradient(rgba(20, 18, 16, 0.7), rgba(20, 18, 16, 0.7)),
            url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54.627 0l.83.828-1.415 1.415-.828-.828-.828.828-1.415-1.415.828-.828-.828-.828 1.415-1.415.828.828.828-.828 1.415 1.415-.828.828zM22.485 0l.83.828-1.415 1.415-.828-.828-.828.828-1.415-1.415.828-.828-.828-.828 1.415-1.415.828.828.828-.828 1.415 1.415-.828.828zM0 22.485l.828.83-1.415 1.415-.828-.828-.828.828L-2.83 22.485l.828-.828-.828-.828 1.415-1.415.828.828.828-.828 1.415 1.415-.828.828zM0 54.627l.828.83-1.415 1.415-.828-.828-.828.828L-2.83 54.627l.828-.828-.828-.828 1.415-1.415.828.828.828-.828 1.415 1.415-.828.828zM54.627 60l.83-.828-1.415-1.415-.828.828-.828-.828-1.415 1.415.828.828-.828.828 1.415 1.415.828-.828.828.828 1.415-1.415-.828-.828zM22.485 60l.83-.828-1.415-1.415-.828.828-.828-.828-1.415 1.415.828.828-.828.828 1.415 1.415.828-.828.828.828 1.415-1.415-.828-.828z' fill='%233e3832' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E");
    }

    .story-header-exact { text-align: center; margin-bottom: 50px; padding-top: 30px; padding-bottom: 25px; border-bottom: 1px solid #8b8070; position: relative; }
    .story-header-exact::after { content: ''; position: absolute; bottom: -3px; left: 50%; transform: translateX(-50%); width: 60px; height: 5px; background-color: #2a2620; border-left: 1px solid #8b8070; border-right: 1px solid #8b8070; }
    
    .main-title-exact { font-family: 'Eulyoo1945', serif; font-size: 2.4rem; color: #c8aa64; letter-spacing: 4px; font-weight: 900; text-shadow: 2px 2px 0px rgba(0,0,0,0.5); }
    .sub-title-exact { font-family: 'Eulyoo1945', serif; font-size: 0.95rem; color: #8b8070; letter-spacing: 2px; margin-top: 8px; font-weight: 600; text-transform: uppercase; }
    
    .header-divider-exact { width: 40px; height: 2px; background: #c8aa64; margin: 15px auto 0; opacity: 0.5; }

    /* ---------------------------------------------------------------- */
    /* 💬 [재수정] 말풍선 디자인 - 바닥에 착 붙는 스타일 */
    /* ---------------------------------------------------------------- */

    .message-list-exact { display: flex; flex-direction: column; gap: 16px; margin-bottom: 40px; }
    .message-row-exact { display: flex; flex-direction: column; width: 100%; }
    .row-npc { align-items: flex-start; }
    .row-me { align-items: flex-end; }

    /* 대화 말풍선 (착붙 그림자) */
    .message-wrapper-exact { display: flex; width: 100%; animation: fadeInUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both ; }
    .message-bubble-exact { position: relative; max-width: 82%; padding: 12px 16px; border-radius: 2px; line-height: 1.6; font-size: 0.98rem; box-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.1) inset; word-break: keep-all; font-family: 'RIDIBatang', serif; }

    /* NPC (왼쪽): 낡은 서류 종이 */
    .wrapper-npc { flex-direction: column; align-items: flex-start; padding-left: 0; padding-top: 10px; padding-bottom: 10px;}
    .wrapper-npc .text-xs { color: #c8aa64; font-weight: 700; font-size: 0.8rem; margin-bottom: 2px; margin-left: 4px; text-shadow: 1px 1px 0 rgba(0,0,0,0.8); opacity: 0.9; }
    .message-bubble-exact.type-npc { background-color: #e8dfd1; color: #2a2620; border: 1px solid #9d8e7e; margin-left: 8px; border-top-left-radius: 0; }
    .message-bubble-exact.type-npc::before { content: ''; position: absolute; top: -1px; left: -6px; width: 0; height: 0; border-style: solid; border-width: 0 6px 8px 0; border-color: transparent #e8dfd1 transparent transparent; filter: drop-shadow(-1px 0px 0px #9d8e7e); }

    /* ME (오른쪽): 짙은 잉크 메모 */
    .wrapper-me { justify-content: flex-end; padding-right: 0; }
    .message-bubble-exact.type-me { background-color: #2c2824; color: #d6cabb; border: 1px solid #4a4440; margin-right: 8px; border-top-right-radius: 0; text-align: left; }
    .message-bubble-exact.type-me::before { content: ''; position: absolute; top: -1px; right: -6px; width: 0; height: 0; border-style: solid; border-width: 8px 6px 0 0; border-color: #2c2824 transparent transparent transparent; filter: drop-shadow(1px 0px 0px #4a4440); }

    /* SYSTEM (중앙): 금박 라인 박스 (심플) */
    .wrapper-system { justify-content: center; margin: 20px 0; }
    /* ✨ [수정] 시스템 메시지 박스: 양옆 여백 확보 */
    .system-notificationbox-exact { 
        width: 92%; /* 꽉 차지 않게 너비 줄임 */
        margin: 20px auto; /* 중앙 정렬 */
        background: linear-gradient(90deg, transparent, rgba(200,170,100,0.15), transparent); 
        border-top: 1px solid rgba(200,170,100,0.3); 
        border-bottom: 1px solid rgba(200,170,100,0.3); 
        padding: 12px 0; 
        text-align: center; 
        border-radius: 4px; /* 살짝 둥글게 */
    }
    .system-notificationbox-exact::before { display: none; }
    .system-content-exact { font-family: 'RIDIBatang', serif; color: #c8aa64; font-weight: 600; font-size: 0.9rem; letter-spacing: 1px; }

    /* ---------------------------------------------------------------- */
    /* [수정됨] 인트로 '다음' 버튼 */
    /* ---------------------------------------------------------------- */
    .intro-bottom-cta-exact {
        display: flex;
        justify-content: center;
        padding: 30px 0 50px;
    }
    .intro-cta-button-exact {
          width: 100%;
        max-width: 200px;
        padding: 14px;
        font-family: 'Noto Serif KR', serif;
        background: linear-gradient(to bottom, #d4af37, #bfa048);
        color: #1a1814;
        font-weight: 800;
        font-size: 1.1rem;
        letter-spacing: 2px;
        border: 1px solid #f5e6d3;
        border-radius: 4px; /* 각진 버튼 */
        box-shadow: 0 4px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.4);
        text-shadow: 0 1px 0 rgba(255,255,255,0.3);
        cursor: pointer;
        transition: all 0.2s;
    }
    .intro-cta-button-exact:hover {
        filter: brightness(1.1);
        transform: translateY(-2px);
        box-shadow: 0 6px 15px rgba(212, 175, 55, 0.4);
    }
    .intro-cta-button-exact:active {
        transform: translateY(1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }

    /* 기타 버튼들 */
    .card-button-exact,
    .detail-button-exact {
        font-family: 'Noto Serif KR', serif;
        background: linear-gradient(to bottom, #d4af37, #bfa048);
        color: #1a1814;
        font-weight: 800;
        border: 1px solid #f5e6d3;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4);
        text-shadow: 0 1px 0 rgba(255,255,255,0.3);
        transition: all 0.2s;
    }
    .card-button-exact:hover,
    .detail-button-exact:hover { filter: brightness(1.1); transform: translateY(-1px); }
    .card-button-exact:active,
    .detail-button-exact:active { transform: translateY(1px); box-shadow: 0 2px 4px rgba(0,0,0,0.3); }

    /* 애니메이션 및 유틸 */
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes lanternFloat { from { transform: translateY(0) rotateX(3deg); } to { transform: translateY(-8px) rotateX(0deg); } }
    @keyframes stampBounce { 0% { transform: scale(3); opacity: 0; } 60% { transform: scale(0.9); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    
    .message-footer-spacer-exact { height: 60px; }
    .map-trigger-exact { height: 1px; visibility: hidden; }
    .bubble-text-exact br { display: block; }

    /* 지도 관련 스타일 (기존 유지) */
    .map-section-scroll-exact { width: 100%; height: 80vh; background-color: #2a2620; position: relative; overflow: hidden; }
    .map-container-exact { width: 100%; height: 100%; position: relative; max-width: 500px; margin: 0 auto; }
        .map-overlay-exact { position: fixed; inset: 0; z-index: 9999; }
    .map-overlay-bg-exact { position: absolute; inset: 0; background: transparent; }
        .map-overlay-content-exact { position: absolute; inset: 0; }
        .map-top-left-back-exact { position: absolute; left: 16px; top: 16px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.45); border: 1px solid #c8aa64; color: #c8aa64; border-radius: 9999px; z-index: 5; font-size: 18px; }
        .map-top-left-back-exact:hover { background: rgba(200,170,100,0.2); }
    .map-container-exact.overlay { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; margin: 0; transform: none; }
        .map-background-exact { position: absolute; z-index: 0; width: 100%; height: 100%; background-image: url('https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/escape/jongro/jongroMap.png'); background-size: cover; background-position: center; background-repeat: no-repeat; opacity: 1; }
        .markers-container-exact { position: absolute; z-index: 20; width: 100%; height: 100%; top: 0; left: 0; }
        .map-marker-exact { position: absolute; background: none; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 15; transition: transform 0.3s ease; padding: 0; transform: translate(-50%, -100%); }
        .map-marker-exact:hover { transform: translate(-50%, -100%) scale(1.15); z-index: 20; }
        .map-marker-exact.cleared:hover { transform: translate(-50%, -100%); }
    .marker-lantern-exact { width: 40px; height: 60px; border-radius: 4px; position: relative; background: linear-gradient(110deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.06) 46%, rgba(255,255,255,0.08) 46%, rgba(255,255,255,0.18) 100%), url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.22'/%3E%3C/svg%3E"), linear-gradient(to bottom, #a63737 50%, #2c3e8c 50%); background-blend-mode: normal, overlay, normal; border: 2px solid #3e2723; box-shadow: 0 0 15px rgba(255, 138, 101, 0.35), 0 0 28px rgba(255, 160, 0, 0.18), inset 0 0 18px rgba(255, 255, 255, 0.1), inset 6px 0 10px rgba(0,0,0,0.18); animation: lanternFloat 2.6s ease-in-out infinite alternate; cursor: pointer; transform-style: preserve-3d; }
        .marker-lantern-exact.cleared { background: linear-gradient(to bottom, #1a1a1a 0%, #0f0f0f 100%); border-color: #2a2620; box-shadow: inset 0 0 12px rgba(0,0,0,0.6); animation: none; filter: grayscale(1) brightness(0.75); }
    .marker-lantern-exact::before, .marker-lantern-exact::after { content: ''; position: absolute; left: -4px; width: 44px; height: 6px; background-color: #2d1e18; border-radius: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.6); }
        .marker-lantern-exact::before { top: -2px; }
        .marker-lantern-exact::after { bottom: -2px; }
    .lantern-ring { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); width: 8px; height: 8px; border: 2px solid #8d6e63; border-radius: 50%; }
        .marker-label-exact { color: #c8aa64; font-family: 'Noto Serif KR', serif; font-size: 0.75rem; font-weight: 700; text-shadow: 0 0 4px rgba(0, 0, 0, 0.9); letter-spacing: 0.5px; background: rgba(0, 0, 0, 0.6); padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(200, 170, 100, 0.3); }

        .popup-card-exact { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 88%; max-width: 360px; background: linear-gradient(135deg, #3a3530 0%, #4a4440 100%); border: 4px solid #c8aa64; border-radius: 12px; padding: 0; z-index: 60; box-shadow: 0 40px 100px rgba(0, 0, 0, 0.9), 0 0 80px rgba(200, 170, 100, 0.5), inset 0 1px 0 rgba(200, 170, 100, 0.25); animation: cardSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); overflow: hidden; }
        .popup-card-exact.detail-exact { max-width: 330px; }
        .popup-close-exact { position: absolute; top: 15px; right: 15px; background: rgba(0, 0, 0, 0.3); border: 1px solid #c8aa64; color: #c8aa64; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; transition: all 0.3s ease; z-index: 70; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; }
        .popup-close-exact:hover { background: rgba(200, 170, 100, 0.2); transform: rotate(90deg); }
        .popup-back-exact { background: none; border: none; color: #c8aa64; font-family: 'Noto Serif KR', serif; cursor: pointer; font-size: 0.9rem; padding: 15px 25px; transition: all 0.3s ease; display: block; }
        .popup-back-exact:hover { color: #ff6b35; }
        .card-frame-exact { padding: 25px; display: flex; flex-direction: column; gap: 15px; }
        .card-frame-exact::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 2px solid #c8aa64; border-radius: 8px; pointer-events: none; margin: 15px; opacity: 0.5; }
        .card-title-exact { font-family: 'Noto Serif KR', serif; font-size: 1.6rem; color: #c8aa64; text-align: center; letter-spacing: 1.5px; font-weight: 700; margin-bottom: 10px; }
        .card-image-exact { margin: 6px auto 10px; width: 92%; border: 2px solid #c8aa64; border-radius: 6px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.35); }
        .card-image-tag-exact { display: block; width: 100%; height: auto; }
        .detail-frame-exact { padding: 25px; display: flex; flex-direction: column; gap: 15px; }
        .detail-title-exact { font-family: 'Noto Serif KR', serif; font-size: 1.4rem; color: #c8aa64; text-align: center; }
        .detail-desc-exact { font-family: 'Noto Sans KR', sans-serif; font-size: 0.9rem; color: #8b8070; text-align: center; }
        .detail-story-exact { background: rgba(200, 170, 100, 0.1); padding: 15px; border-left: 3px solid #c8aa64; border-radius: 4px; font-size: 0.85rem; color: #c8aa64; line-height: 1.8; font-family: 'Noto Sans KR', sans-serif; }
        /* 스크롤바 숨김 */
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .hide-scrollbar::-webkit-scrollbar { width: 0; height: 0; display: none; }
      `}</style>
        </div>
    );
}
