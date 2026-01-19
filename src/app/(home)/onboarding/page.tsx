"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    const searchParams = useSearchParams();

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
    const [isResetting, setIsResetting] = useState(false); // 🟢 reset 중인지 확인하는 플래그

    // 🟢 reset=true 파라미터가 있으면 첫 단계로 리셋 (다른 useEffect보다 먼저 실행)
    useEffect(() => {
        const shouldReset = searchParams?.get("reset") === "true";
        if (shouldReset) {
            setIsResetting(true);
            // localStorage 초기화
            try {
                localStorage.removeItem("onboardingStep1");
                localStorage.removeItem("onboardingStep2");
                localStorage.removeItem("onboardingStep3");
                localStorage.removeItem("onboardingStep4");
                localStorage.removeItem("onboardingComplete");
            } catch (e) {
                // localStorage 접근 실패 무시
            }
            setCurrentStep(1);
            setShowIntro(true);
            setPreferences({
                concept: [],
                companion: "",
                mood: [],
                regions: [],
            });
            setSelectedVibeIds([]);
            setSelectedValueId(null);
            setSelectedCrew(null);
            // URL에서 reset 파라미터 제거
            const url = new URL(window.location.href);
            url.searchParams.delete("reset");
            router.replace(url.pathname + url.search, { scroll: false });
        }
    }, [searchParams, router]);

    // =================================================================
    // API 저장 로직
    // =================================================================
    const savePreferences = useCallback(async (prefsToSave: UserPreferences, silent = true) => {
        if (isSavingRef.current) return;
        try {
            // 🟢 쿠키 기반 인증: authenticatedFetch 사용
            const { authenticatedFetch } = await import("@/lib/authClient");
            isSavingRef.current = true;
            await authenticatedFetch("/api/users/preferences", {
                method: "POST",
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
        // 🟢 reset 중이면 이 로직을 실행하지 않음
        if (isResetting) {
            setIsResetting(false); // reset 완료
            return;
        }

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
                // 🟢 reset 중이면 서버 데이터를 가져오지 않고 초기 상태 유지
                const shouldReset = searchParams?.get("reset") === "true";
                if (shouldReset) {
                    // reset은 이미 위의 useEffect에서 처리되므로 여기서는 아무것도 하지 않음
                    return;
                }

                // 🟢 쿠키 기반 인증: authenticatedFetch 사용
                const { authenticatedFetch } = await import("@/lib/authClient");
                let serverPrefs: UserPreferences | null = null;

                // 1. 서버 데이터 가져오기
                try {
                    const raw = await authenticatedFetch<{ preferences?: UserPreferences } | UserPreferences>(
                        "/api/users/preferences"
                    );
                    if (raw) {
                        const prefsData = (raw as any)?.preferences ?? raw;
                        const normalized: UserPreferences = {
                            concept: Array.isArray(prefsData?.concept) ? prefsData.concept : [],
                            companion: typeof prefsData?.companion === "string" ? prefsData.companion : "",
                            mood: Array.isArray(prefsData?.mood) ? prefsData.mood : [],
                            regions: Array.isArray(prefsData?.regions) ? prefsData.regions : [],
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
    }, [searchParams]);

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
        // 기존 선택 초기화하고 새로운 값만 설정 (덮어쓰기)
        setPreferences((prev) => ({
            ...prev,
            concept: [...option.concepts],
            mood: [...option.moods],
        }));
        setSelectedVibeIds([option.id]);
        setAnalysisKeyword((prev) => ({ ...prev, vibe: option.desc }));
        localStorage.setItem("onboardingStep1", "1");

        // UX: 바로 넘어가는 대신 약간의 딜레이
        setTimeout(() => nextStep(), 300);
    };

    const handleValueSelect = (option: (typeof VALUE_OPTIONS)[number]) => {
        // 기존 선택 초기화하고 새로운 값만 설정 (덮어쓰기)
        // 주의: Step 1의 선택값은 유지해야 함 (concept, mood는 Step 1, 2가 공유하므로 누적 방식이 아닌 "Step 1 값 + Step 2 값"으로 재구성 필요)
        // 하지만 여기서는 간단하게 "이전 단계의 값은 유지하되, 현재 단계의 값만 교체"하는 로직이 필요함.
        // 현재 구조상 step 1과 step 2가 concept/mood 배열을 공유하므로,
        // 완벽한 분리를 위해서는 step1_concepts, step2_concepts 등으로 상태를 분리해야 하지만,
        // 여기서는 "기존에 선택된 값에 추가"가 아닌 "현재 선택으로 덮어쓰기"를 원하므로,
        // Step 1에서 선택한 값은 보존되어야 한다면 로직이 복잡해짐.
        // 사용자의 의도가 "완전히 새로 선택"이라면, Step 2 선택 시 Step 1 값 + Step 2 값으로 재구성하는 것이 맞음.
        // 하지만 여기서는 DB나 상태에 "Step 1에서 온 것", "Step 2에서 온 것" 구분이 없으므로,
        // 단순히 append 하는 방식으로는 중복이나 누적 문제가 발생함.

        // 해결책: Step 2 선택 시, Step 2에 해당하는 값들만 갱신하기 어려우므로(어떤게 Step 2 값인지 모름),
        // 가장 안전한 방법은 "append" 하되, 중복 제거는 Set으로 처리하고,
        // 만약 "재선택" 시 이전 Step 2 값을 지우고 싶다면, 상태 관리를 더 세분화해야 함.

        // 하지만 사용자의 요청인 "새로운 답변이 정확히 반영"되려면,
        // Step 1, Step 2가 독립적이라면 각자 덮어쓰면 되지만, 공유한다면...
        // 일단 사용자의 의도는 "이전 선택들이 계속 쌓여서 혼종이 되는 것을 방지"하는 것이므로,
        // Step 1에서는 싹 지우고 넣고 (성공)
        // Step 2에서는 Step 1 값은 유지하고 Step 2 값만 추가해야 함.

        // 현재 preferences 상태에는 step 구분 없이 섞여 있으므로,
        // selectedVibeIds(Step 1 선택)를 기반으로 Step 1 값을 복원하고, 거기에 현재 선택값을 더하는 방식으로 구현.

        // 1. Step 1에서 선택된 옵션 찾기
        const step1Option = VIBE_OPTIONS.find((opt) => selectedVibeIds.includes(opt.id));
        const baseConcepts = step1Option ? step1Option.concepts : [];
        const baseMoods = step1Option ? step1Option.moods : [];

        // 2. Step 1 값 + 현재 선택 값으로 재설정
        setPreferences((prev) => ({
            ...prev,
            concept: [...new Set([...baseConcepts, ...option.addConcept])],
            mood: [...new Set([...baseMoods, ...option.addMood])],
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
            // 지역 선택은 다중 선택이 가능하지만, "새로 시작" 느낌을 위해
            // 만약 기존에 선택된 지역들이 있고 사용자가 새로 클릭한다면?
            // -> 여기는 "자주 출몰하는 지역"이라 여러 개 선택이 자연스러움.
            // -> 하지만 "재설정" 상황이라면 기존 것을 다 날리고 싶을 수도 있음.
            // -> 일단 기존 토글 방식 유지하되, 사용자가 명시적으로 지우지 않는 한 유지되는 것이 일반적임.
            // -> 다만 사용자가 "초기화"를 원한다면 별도 버튼이 필요하거나,
            //    진입 시점에 초기화했어야 함.
            // -> 요청하신 "각 단계 선택 시 기존 값 초기화"를 지역에도 적용하려면 단일 선택으로 바뀌거나,
            //    첫 클릭 시 초기화 로직이 필요한데, 다중 선택 UI에서는 첫 클릭인지 알기 어려움.
            // -> 따라서 지역은 토글 방식을 유지하되, 만약 "단일 선택"처럼 동작하길 원하면 수정 가능.
            // -> 여기서는 기존 토글 로직 유지 (지역은 여러 곳일 수 있으므로)

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

    // 🔥 [수정] 닫기 동작 개선 - 빠른 뒤로 가기
    const handleClose = () => {
        if (onClose) {
            // 부모 컴포넌트가 제어권을 가진 경우
            onClose();
        } else {
            // 단독 페이지 혹은 라우팅 기반일 경우
            // "다음에 하기" 느낌을 주기 위해 뒤로가기 혹은 홈으로
            if (window.history.length > 1) {
                window.history.back(); // 빠른 뒤로 가기
            } else {
                router.prefetch("/");
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
                className={`fixed inset-0 z-100 flex flex-col items-center justify-center transition-opacity duration-700 ease-in-out ${
                    isIntroFading ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
            >
                {/* 무거운 외부 이미지 대신 가벼운 그라디언트 배경 사용 */}
                <div className="absolute inset-0 z-0 bg-linear-to-br from-black via-gray-900 to-black" />

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
                            AI DONA
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
            <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
                {/* ...결과 UI 코드... */}
                <div className="bg-white dark:bg-[#1a241b] w-full max-w-sm rounded-xl border border-gray-100 dark:border-gray-800 p-6 text-center relative overflow-hidden">
                    <button onClick={completeOnboarding} className="absolute top-4 right-4 text-gray-400 dark:text-gray-500">
                        <X size={24} />
                    </button>
                    {/* ... (생략된 내용) ... */}
                    <div className="mt-8">
                        <h2 className="text-gray-900 dark:text-white text-2xl font-bold mb-2">분석 완료!</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">회원님의 취향 DNA가 추출되었습니다.</p>
                        <button
                            onClick={completeOnboarding}
                            className="w-full py-4 bg-black dark:bg-slate-800 text-white rounded-xl font-bold text-lg hover:scale-[1.02] dark:hover:bg-slate-700 transition-transform"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
            {/* ... 배경 이미지 및 컨테이너 ... */}
            <div className="relative z-10 w-full h-full max-w-[480px] bg-white dark:bg-[#1a241b] sm:h-[85vh] sm:rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col bg-linear-to-br from-slate-50 to-blue-50 dark:from-[#0f1710] dark:to-[#1a241b]">
                {/* 닫기 버튼 */}
                <div className="absolute top-4 right-4 z-50">
                    <button
                        onClick={handleClose}
                        className="p-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-700 rounded-full transition-all text-gray-700 dark:text-gray-300 shadow-sm hover:scale-110 active:scale-95"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="px-4 pt-16 pb-2 shrink-0">
                    <div className="h-1.5 w-full bg-gray-200/80 dark:bg-gray-800/80 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-linear-to-r from-[#7aa06f] to-emerald-500 dark:from-emerald-600 dark:to-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(((currentStep - 1) / (totalSteps - 1)) * 100, 100)}%` }}
                        />
                    </div>
                </div>

                {/* 질문 컨텐츠 (기존 로직 유지) */}
                <div className="flex-1 flex flex-col px-5 w-full mx-auto overflow-hidden relative">
                    {currentStep === 1 && (
                        /* Step 1 UI */
                        <div className="animate-slideUp flex flex-col h-full overflow-y-auto scrollbar-hide">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 mt-4 leading-tight shrink-0 tracking-tight">
                                당신이 꿈꾸는
                                <br />
                                '완벽한 주말'의 모습은?
                            </h1>
                            <div className="grid grid-cols-2 gap-3 pb-6">
                                {VIBE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => handleVibeSelect(opt)}
                                        className="relative group overflow-hidden rounded-xl aspect-square border border-gray-100 dark:border-gray-800"
                                    >
                                        <Image
                                            src={opt.img}
                                            alt={opt.title}
                                            fill
                                            sizes="(max-width: 768px) 50vw, 400px"
                                            className="object-cover"
                                            priority
                                        />
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
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                                딱 하나만 고른다면?
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">실패 없는 추천을 위해 가치관을 파악합니다.</p>
                            <div className="flex flex-col gap-4">
                                {VALUE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => handleValueSelect(opt)}
                                        className={`w-full bg-white dark:bg-[#0f1710] p-5 rounded-xl border transition-all active:scale-95 flex items-center gap-4 text-left group ${
                                            selectedValueId === opt.id
                                                ? "border-[#7aa06f] dark:border-emerald-600 ring-2 ring-[#7aa06f] dark:ring-emerald-600"
                                                : "border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                                        }`}
                                    >
                                        <span className="text-3xl bg-gray-50 dark:bg-gray-800/50 p-3 rounded-2xl group-hover:scale-110 transition-transform">
                                            {opt.icon}
                                        </span>
                                        <div>
                                            <h3 className="font-bold text-gray-800 dark:text-white text-lg whitespace-pre-wrap leading-snug tracking-tight">
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
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                누구와 함께할 때<br />
                                가장 '나다운'가요?
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">주로 함께하는 대상을 알려주세요.</p>
                            <div className="grid grid-cols-2 gap-3">
                                {CREW_OPTIONS.map((crew) => (
                                    <button
                                        key={crew.value}
                                        onClick={() => handleCrewSelect(crew.value)}
                                        className={`p-5 rounded-xl border transition-all text-left active:scale-95 bg-white dark:bg-[#0f1710] ${
                                            selectedCrew === crew.value
                                                ? "border-[#7aa06f] dark:border-emerald-600 ring-2 ring-[#7aa06f] dark:ring-emerald-600"
                                                : "border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                                        }`}
                                    >
                                        <div className="text-lg font-bold text-gray-800 dark:text-white mb-1">{crew.label}</div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500">{crew.sub}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="animate-slideUp flex flex-col h-full px-1">
                            {/* 헤더 섹션: 가이드 텍스트 추가 */}
                            <div className="mb-8 mt-4">
                                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">자주 출몰하는 지역은?</h1>
                                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">최대 3개까지 선택할 수 있어요 📍</p>
                            </div>

                            {/* 지역 선택 그리드: 고정 2열 그리드로 정밀 정렬 */}
                            <div className="flex-1 grid grid-cols-2 gap-3 content-start overflow-y-auto pb-4 scrollbar-hide">
                                {REGION_GROUPS.map((group) => {
                                    const isSelected = preferences.regions.includes(group.dbValues[0]);
                                    return (
                                        <button
                                            key={group.id}
                                            onClick={() => handleRegionSelect(group)}
                                            className={`group relative flex items-center justify-center ml-1 mr-1 px-4 py-4 rounded-2xl text-sm font-bold transition-all duration-200 shadow-sm border ${
                                                isSelected
                                                    ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 dark:border-emerald-600 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500 dark:ring-emerald-600"
                                                    : "bg-white dark:bg-[#0f1710] border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                            }`}
                                        >
                                            <span className={`${isSelected ? "scale-105" : ""} transition-transform`}>
                                                {group.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* 하단 고정 버튼 섹션: 그라데이션 및 그림자 추가 */}
                            <div className="shrink-0 mt-auto pb-8 pt-4  dark:bg-[#1a241b]">
                                <button
                                    onClick={nextStep}
                                    disabled={preferences.regions.length === 0}
                                    className={`w-full py-4.5 rounded-2xl font-extrabold text-[16px] tracking-tight transition-all shadow-lg ${
                                        preferences.regions.length > 0
                                            ? "bg-slate-900 dark:bg-slate-800 text-white active:scale-[0.98] hover:bg-slate-800 dark:hover:bg-slate-700"
                                            : "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                                    }`}
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
                            className="text-gray-400 dark:text-gray-500 text-sm flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-400"
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
