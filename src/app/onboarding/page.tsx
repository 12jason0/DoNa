"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { VIBE_OPTIONS, VALUE_OPTIONS, CREW_OPTIONS, REGION_GROUPS } from "@/constants/onboardingData";
import Image from "next/image";
import { X, ArrowRight } from "lucide-react";

interface UserPreferences {
    concept: string[];
    companion: string;
    mood: string[];
    regions: string[];
}

// 부모 컴포넌트에서 닫기를 제어할 수 있도록 onClose prop 추가 (선택 사항)
interface AIOnboardingProps {
    onClose?: () => void;
}

const AIOnboarding = ({ onClose }: AIOnboardingProps) => {
    const router = useRouter();

    // =================================================================
    // 상태 관리
    // =================================================================
    const [currentStep, setCurrentStep] = useState<number>(() => {
        try {
            const s1 = localStorage.getItem("onboardingStep1") === "1";
            const s2 = localStorage.getItem("onboardingStep2") === "1";
            const s3 = localStorage.getItem("onboardingStep3") === "1";
            if (!s1) return 1;
            if (!s2) return 2;
            if (!s3) return 3;
            return 4;
        } catch {
            return 1;
        }
    });
    const [showIntro, setShowIntro] = useState(currentStep === 1);
    const [isIntroFading, setIsIntroFading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showResult, setShowResult] = useState(false);

    const [preferences, setPreferences] = useState<UserPreferences>({
        concept: [],
        companion: "",
        mood: [],
        regions: [],
    });

    const [analysisKeyword, setAnalysisKeyword] = useState({ vibe: "", type: "" });
    const totalSteps = 4;
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSavingRef = useRef(false);

    const [selectedVibeIds, setSelectedVibeIds] = useState<string[]>([]);
    const [selectedValueId, setSelectedValueId] = useState<string | null>(null);
    const [selectedCrew, setSelectedCrew] = useState<string | null>(null);

    // =================================================================
    // API 저장 로직
    // =================================================================
    const savePreferences = useCallback(async (prefsToSave: UserPreferences, silent = true) => {
        if (isSavingRef.current) return;
        try {
            const token = localStorage.getItem("authToken");
            if (!token) return;

            isSavingRef.current = true;
            await fetch("/api/users/preferences", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ preferences: prefsToSave }),
            });
            if (!silent) console.log("Saved.");
        } catch (error) {
            console.error("Save failed:", error);
        } finally {
            isSavingRef.current = false;
        }
    }, []);

    // =================================================================
    // 🔥 [핵심] 이어하기 & 초기화 로직 개선
    // =================================================================
    useEffect(() => {
        const computeFirstUnansweredStep = (
            prefs: UserPreferences,
            flags: { s1: boolean; s2: boolean; s3: boolean; s4: boolean }
        ) => {
            // 1단계: 분위기/컨셉
            const step1Answered = flags.s1 || prefs.mood.length > 0 || prefs.concept.length > 0;
            if (!step1Answered) return 1;

            // 2단계: 가치관 (DB에 별도 필드가 없어 로컬 플래그 s2 의존도가 높음)
            const step2Answered = flags.s2;
            if (!step2Answered) return 2;

            // 3단계: 동행자
            const step3Answered = flags.s3 || (prefs.companion ?? "") !== "";
            if (!step3Answered) return 3;

            // 4단계: 지역 (선택이지만, 완료 플래그가 없으면 보여줌)
            return 4;
        };

        const init = async () => {
            try {
                const token = localStorage.getItem("authToken");
                let serverPrefs: UserPreferences | null = null;

                // 1. 서버 데이터 가져오기
                if (token) {
                    try {
                        const res = await fetch("/api/users/preferences", {
                            method: "GET",
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        if (res.ok) {
                            const data = await res.json();
                            const raw = data?.preferences ?? data;
                            const normalized: UserPreferences = {
                                concept: Array.isArray(raw?.concept) ? raw.concept : [],
                                companion: typeof raw?.companion === "string" ? raw.companion : "",
                                mood: Array.isArray(raw?.mood) ? raw.mood : [],
                                regions: Array.isArray(raw?.regions) ? raw.regions : [],
                            };
                            serverPrefs = normalized;
                            setPreferences(normalized);

                            // 서버 데이터 기반으로 UI 상태 복구 (선택 표시 등)
                            if (normalized.companion) setSelectedCrew(normalized.companion);
                            // vibeIds나 valueId는 DB에 정확히 매핑 안 될 수 있어 스킵하거나 로직 추가 필요
                        }
                    } catch {
                        /* ignore */
                    }
                }

                // 2. 로컬 진행 상황 체크
                const s1 = localStorage.getItem("onboardingStep1") === "1";
                const s2 = localStorage.getItem("onboardingStep2") === "1";
                const s3 = localStorage.getItem("onboardingStep3") === "1";
                const s4 = localStorage.getItem("onboardingStep4") === "1";

                // 3. 다음 단계 계산
                const next = computeFirstUnansweredStep(serverPrefs ?? preferences, { s1, s2, s3, s4 });

                setCurrentStep(next);

                // 🔥 [수정] 2단계 이상 진행된 상태라면, '인트로'를 건너뛰고 바로 질문으로 진입
                if (next > 1) {
                    setShowIntro(false);
                }
            } catch (error) {
                console.error(error);
            }
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 자동 저장 트리거
    useEffect(() => {
        const hasAnyData =
            preferences.concept.length > 0 ||
            preferences.companion !== "" ||
            preferences.mood.length > 0 ||
            preferences.regions.length > 0;

        if (!hasAnyData) return;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(() => {
            savePreferences(preferences, true);
        }, 1000);

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [preferences, savePreferences]);

    // =================================================================
    // 핸들러 함수들
    // =================================================================
    const handleVibeSelect = (option: (typeof VIBE_OPTIONS)[number]) => {
        setPreferences((prev) => ({
            ...prev,
            concept: [...new Set([...prev.concept, ...option.concepts])],
            mood: [...new Set([...prev.mood, ...option.moods])],
        }));
        setSelectedVibeIds((prev) => (prev.includes(option.id) ? prev : [...prev, option.id]));
        setAnalysisKeyword((prev) => ({ ...prev, vibe: option.desc }));
        localStorage.setItem("onboardingStep1", "1");

        // UX: 바로 넘어가는 대신 약간의 딜레이
        setTimeout(() => nextStep(), 300);
    };

    const handleValueSelect = (option: (typeof VALUE_OPTIONS)[number]) => {
        setPreferences((prev) => ({
            ...prev,
            concept: [...new Set([...prev.concept, option.addConcept])],
            mood: [...new Set([...prev.mood, option.addMood])],
        }));
        setSelectedValueId(option.id);
        setAnalysisKeyword((prev) => ({ ...prev, type: option.typeLabel }));
        localStorage.setItem("onboardingStep2", "1");
        setTimeout(() => nextStep(), 300);
    };

    const handleCrewSelect = (value: string) => {
        setPreferences((prev) => ({ ...prev, companion: value }));
        setSelectedCrew(value);
        localStorage.setItem("onboardingStep3", "1");
        setTimeout(() => nextStep(), 300);
    };

    const handleRegionSelect = (group: (typeof REGION_GROUPS)[number]) => {
        setPreferences((prev) => {
            const current = prev.regions || [];
            const isSelected = current.includes(group.dbValues[0]);
            let newRegions = [...current];

            if (isSelected) {
                newRegions = newRegions.filter((r) => !(group.dbValues as readonly string[]).includes(r));
            } else {
                const combined = [...newRegions, ...(group.dbValues as readonly string[])];
                newRegions = [...new Set(combined)];
            }
            return { ...prev, regions: newRegions };
        });
        localStorage.setItem("onboardingStep4", "1");
    };

    const nextStep = () => {
        if (currentStep < totalSteps) {
            setCurrentStep(currentStep + 1);
        } else {
            handleFinalize();
        }
    };

    const prevStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    const handleFinalize = async () => {
        setIsAnalyzing(true);
        setTimeout(async () => {
            setIsAnalyzing(false);
            setShowResult(true);
            await savePreferences(preferences, false);

            // 완료 플래그 설정 및 임시 플래그 삭제
            localStorage.setItem("onboardingComplete", "1");
            ["onboardingStep1", "onboardingStep2", "onboardingStep3", "onboardingStep4"].forEach((key) =>
                localStorage.removeItem(key)
            );
        }, 1500);
    };

    const completeOnboarding = () => {
                window.location.href = "/";
    };

    // 🔥 [수정] 닫기 동작 개선
    const handleClose = () => {
        if (onClose) {
            // 부모 컴포넌트가 제어권을 가진 경우
            onClose();
        } else {
            // 단독 페이지 혹은 라우팅 기반일 경우
            // "다음에 하기" 느낌을 주기 위해 뒤로가기 혹은 홈으로
            if (window.history.length > 1) {
                router.back();
            } else {
                router.push("/");
            }
        }
    };

    const handleStart = () => {
        setIsIntroFading(true);
        setTimeout(() => {
            setShowIntro(false);
        }, 800);
    };

    // =================================================================
    // UI 렌더링: 인트로 (Step 1이 아닐 경우 자동으로 스킵됨)
    // =================================================================
    if (showIntro) {
                return (
            <div
                className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-700 ease-in-out ${
                    isIntroFading ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
            >
                {/* 무거운 외부 이미지 대신 가벼운 그라디언트 배경 사용 */}
                <div className="absolute inset-0 z-0 bg-gradient-to-br from-black via-gray-900 to-black" />

                <div className="relative z-10 w-full h-full max-w-[480px] mx-auto flex flex-col justify-between p-8 pb-12 animate-fadeIn">
                    <div className="flex justify-end pt-4">
                        {/* 🔥 닫기 버튼에 '다음에 하기' 툴팁이나 텍스트를 추가해도 좋음 */}
                        <button
                            onClick={handleClose}
                            className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white/80 hover:bg-white/20 transition-all border border-white/10 group relative"
                                >
                            <X size={20} />
                            <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 text-white/80 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                다음에 하기
                            </span>
                                </button>
                    </div>

                    <div className="flex flex-col items-start text-left space-y-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/30 bg-white/10 backdrop-blur-md text-white/90 text-xs font-medium tracking-wider uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            AI Curation
                        </div>
                        <h1 className="text-4xl font-light text-white leading-[1.15] tracking-tight">
                            어디로 떠날지
                            <br />
                            <span className="font-bold">고민하지 마세요.</span>
                        </h1>
                        <p className="text-white/70 text-base font-light leading-relaxed max-w-[80%]">
                            당신의 취향을 분석해
                            <br />
                            가장 완벽한 주말을 설계해 드립니다.
                        </p>
                        <div className="h-4"></div>
                        <button
                            onClick={handleStart}
                            className="w-full py-5 bg-white text-black rounded-2xl font-bold text-lg hover:bg-gray-100 active:scale-[0.98] transition-all flex items-center justify-between px-6 group"
                        >
                            <span>지금 시작하기</span>
                            <ArrowRight
                                size={20}
                                className="text-gray-400 group-hover:text-black group-hover:translate-x-1 transition-all"
                            />
                        </button>
                    </div>
                        </div>
                    </div>
                );
    }

    // 결과 화면
    if (showResult) {
        // (기존 코드와 동일, 생략 가능하지만 문맥상 유지)
                return (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
                {/* ...결과 UI 코드... */}
                <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center relative overflow-hidden">
                    <button onClick={completeOnboarding} className="absolute top-4 right-4 text-gray-400">
                        <X size={24} />
                    </button>
                    {/* ... (생략된 내용) ... */}
                    <div className="mt-8">
                        <h2 className="text-2xl font-bold mb-2">분석 완료!</h2>
                        <p className="text-gray-500 mb-6">회원님의 취향 DNA가 추출되었습니다.</p>
                                <button
                            onClick={completeOnboarding}
                            className="w-full py-4 bg-black text-white rounded-xl font-bold text-lg hover:scale-[1.02] transition-transform"
                        >
                            맞춤 코스 확인하기 ➔
                                </button>
                    </div>
                        </div>
                    </div>
                );
    }

    // 로딩 화면
    if (isAnalyzing) {
        return (
            <div className="fixed inset-0 z-50 h-screen bg-black/70 backdrop-blur-md flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin mb-6"></div>
                <h2 className="text-xl font-bold text-white animate-pulse">취향 데이터 분석 중...</h2>
            </div>
        );
        }

    // =================================================================
    // 메인 온보딩 UI (Step 1~4)
    // =================================================================
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm">
            {/* ... 배경 이미지 및 컨테이너 ... */}
            <div className="relative z-10 w-full h-full max-w-[480px] bg-white sm:h-[85vh] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
                {/* 닫기 버튼 */}
                <div className="absolute top-4 right-4 z-50">
                    <button
                        onClick={handleClose}
                        className="p-2 bg-white/80 backdrop-blur-sm hover:bg-white rounded-full transition-all text-gray-700 shadow-sm hover:scale-110 active:scale-95"
                    >
                        <X size={20} />
                    </button>
                    </div>

                {/* Progress Bar */}
                <div className="px-4 pt-16 pb-2 shrink-0">
                    <div className="h-1.5 w-full bg-gray-200/80 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-[#7aa06f] to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(((currentStep - 1) / (totalSteps - 1)) * 100, 100)}%` }}
                        />
                    </div>
                </div>

                {/* 질문 컨텐츠 (기존 로직 유지) */}
                <div className="flex-1 flex flex-col px-5 w-full mx-auto overflow-hidden relative">
                    {currentStep === 1 && (
                        /* Step 1 UI */
                        <div className="animate-slideUp flex flex-col h-full overflow-y-auto scrollbar-hide">
                            <h1 className="text-2xl font-bold text-gray-900 mb-2 mt-4 leading-tight shrink-0">
                                당신이 꿈꾸는
                                <br />
                                '완벽한 주말'의 모습은?
                            </h1>
                            <div className="grid grid-cols-2 gap-3 pb-6">
                                {VIBE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => handleVibeSelect(opt)}
                                        className="relative group overflow-hidden rounded-2xl aspect-square shadow-md"
                                    >
                                        <Image src={opt.img} alt={opt.title} fill className="object-cover" />
                                        <span className="absolute bottom-4 left-4 text-white font-bold text-sm drop-shadow">
                                            {opt.title}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Step 2: 가치관 선택 */}
                    {currentStep === 2 && (
                        <div className="animate-slideUp flex flex-col h-full justify-center pb-12">
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">딱 하나만 고른다면?</h1>
                            <p className="text-gray-500 mb-8 text-sm">실패 없는 추천을 위해 가치관을 파악합니다.</p>
                            <div className="flex flex-col gap-4">
                                {VALUE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => handleValueSelect(opt)}
                                        className={`w-full bg-white p-5 rounded-2xl shadow-sm border transition-all active:scale-95 flex items-center gap-4 text-left group ${
                                            selectedValueId === opt.id
                                                ? "border-[#7aa06f] ring-2 ring-[#7aa06f]"
                                                : "border-gray-100 hover:border-gray-300"
                                        }`}
                    >
                                        <span className="text-3xl bg-gray-50 p-3 rounded-2xl group-hover:scale-110 transition-transform">
                                            {opt.icon}
                                        </span>
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg whitespace-pre-wrap leading-snug">
                                                {opt.title}
                                            </h3>
                                        </div>
                                    </button>
                                ))}
                    </div>
                </div>
                    )}

                    {/* Step 3: 동행자 선택 */}
                    {currentStep === 3 && (
                        <div className="animate-slideUp flex flex-col h-full justify-center pb-12">
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                                누구와 함께할 때<br />
                                가장 '나다운'가요?
                            </h1>
                            <p className="text-gray-500 mb-8 text-sm">주로 함께하는 대상을 알려주세요.</p>
                            <div className="grid grid-cols-2 gap-3">
                                {CREW_OPTIONS.map((crew) => (
                    <button
                                        key={crew.value}
                                        onClick={() => handleCrewSelect(crew.value)}
                                        className={`p-5 rounded-2xl border transition-all text-left shadow-sm active:scale-95 bg-white ${
                                            selectedCrew === crew.value
                                                ? "border-[#7aa06f] ring-2 ring-[#7aa06f]"
                                                : "border-gray-100 hover:border-gray-300"
                                        }`}
                                    >
                                        <div className="text-lg font-bold text-gray-800 mb-1">{crew.label}</div>
                                        <div className="text-xs text-gray-400">{crew.sub}</div>
                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="animate-slideUp flex flex-col h-full">
                            <h1 className="text-2xl font-bold text-gray-900 mb-2 mt-4">자주 출몰하는 지역은?</h1>
                            <div className="flex-1 flex content-start flex-wrap gap-2.5 overflow-y-auto pb-4">
                                {REGION_GROUPS.map((group) => (
                                    <button
                                        key={group.id}
                                        onClick={() => handleRegionSelect(group)}
                                        className={`px-3 py-3 rounded-xl text-sm font-medium flex-grow text-center shadow-sm ${
                                            preferences.regions.includes(group.dbValues[0])
                                                ? "bg-white border-2 border-[#7aa06f]"
                                                : "bg-white border hover:bg-gray-50"
                                        }`}
                                        style={{ flexBasis: "45%" }}
                                    >
                                        {group.label}
                                    </button>
                                ))}
                            </div>
                            <div className="shrink-0 mt-auto pb-6 pt-4">
                    <button
                        onClick={nextStep}
                                    className="w-full py-4 bg-[#7aa06f] text-white rounded-xl font-bold shadow-lg"
                    >
                                    분석 시작하기 ✨
                    </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 이전 버튼 */}
                {currentStep > 1 && !isAnalyzing && !showResult && (
                    <div className="px-6 pb-6 pt-2 shrink-0">
                    <button
                            onClick={prevStep}
                            className="text-gray-400 text-sm flex items-center gap-1 hover:text-gray-600"
                    >
                            ← 이전 단계
                    </button>
                </div>
                )}
            </div>
        </div>
    );
};

export default AIOnboarding;
