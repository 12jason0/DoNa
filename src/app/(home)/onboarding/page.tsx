"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VIBE_OPTIONS, VALUE_OPTIONS, REGION_GROUPS, CREW_OPTIONS } from "@/constants/onboardingData";
import Image from "next/image";
import { X, ArrowRight } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import type { TranslationKeys } from "@/types/i18n";

interface UserPreferences {
    concept: string[];
    mood: string[];
    regions: string[];
    companion?: string;
    value?: string;
}

// 부모 컴포넌트에서 닫기를 제어할 수 있도록 onClose prop 추가 (선택 사항)
interface AIOnboardingProps {
    onClose?: () => void;
}

const AIOnboarding = ({ onClose }: AIOnboardingProps) => {
    const { t } = useLocale();
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
            const s4 = localStorage.getItem("onboardingStep4") === "1";
            if (!s1) return 1;
            if (!s2) return 2;
            if (!s3) return 3;
            if (!s4) return 4;
            return 4;
        } catch {
            return 1;
        }
    });
    const [showIntro, setShowIntro] = useState(currentStep === 1);
    const [isIntroFading, setIsIntroFading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [showNotifPrompt, setShowNotifPrompt] = useState(false);

    const [preferences, setPreferences] = useState<UserPreferences>({
        concept: [],
        mood: [],
        regions: [],
        companion: undefined,
        value: undefined,
    });

    const [analysisKeyword, setAnalysisKeyword] = useState({ vibe: "", type: "" });
    const totalSteps = 4;
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSavingRef = useRef(false);

    const [selectedVibeIds, setSelectedVibeIds] = useState<string[]>([]);
    const [selectedCompanion, setSelectedCompanion] = useState<string | null>(null);
    const [selectedValueId, setSelectedValueId] = useState<string | null>(null);
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
                mood: [],
                regions: [],
            });
            setSelectedVibeIds([]);
            setSelectedCompanion(null);
            setSelectedValueId(null);
            // URL에서 reset 파라미터 제거
            const url = new URL(window.location.href);
            url.searchParams.delete("reset");
            router.replace(url.pathname + url.search, { scroll: false });
        }
    }, [searchParams, router]);

    // =================================================================
    // API 저장 로직
    // =================================================================
    const savePreferences = useCallback(
        async (prefsToSave: UserPreferences & { companion?: string }, silent = true) => {
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
        },
        [],
    );

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
            flags: { s1: boolean; s2: boolean; s3: boolean; s4: boolean },
        ) => {
            // 1단계: 분위기/컨셉
            const step1Answered = flags.s1 || prefs.mood.length > 0 || prefs.concept.length > 0;
            if (!step1Answered) return 1;

            // 2단계: 동행자
            const step2Answered = flags.s2 || !!prefs.companion;
            if (!step2Answered) return 2;

            // 3단계: 가치관
            const step3Answered = flags.s3;
            if (!step3Answered) return 3;

            // 4단계: 지역
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
                        "/api/users/preferences",
                    );
                    if (raw) {
                        const prefsData = (raw as any)?.preferences ?? raw;
                        const normalized: UserPreferences = {
                            concept: Array.isArray(prefsData?.concept) ? prefsData.concept : [],
                            mood: Array.isArray(prefsData?.mood) ? prefsData.mood : [],
                            regions: Array.isArray(prefsData?.regions) ? prefsData.regions : [],
                            companion: typeof prefsData?.companion === "string" ? prefsData.companion : undefined,
                            value: typeof prefsData?.value === "string" ? prefsData.value : undefined,
                        };
                        serverPrefs = normalized;
                        setPreferences(normalized);
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
            preferences.mood.length > 0 ||
            preferences.regions.length > 0 ||
            !!preferences.companion ||
            !!preferences.value;

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
            value: option.id,
        }));

        setSelectedValueId(option.id);
        setAnalysisKeyword((prev) => ({ ...prev, type: option.typeLabel }));
        localStorage.setItem("onboardingStep3", "1");
        setTimeout(() => nextStep(), 300);
    };

    const handleCompanionSelect = (value: string) => {
        setPreferences((prev) => ({ ...prev, companion: value }));
        setSelectedCompanion(value);
        localStorage.setItem("onboardingStep2", "1");
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
                localStorage.removeItem(key),
            );
        }, 1500);
    };

    const doNavigateAway = () => {
        const returnTo = searchParams?.get("returnTo") || "/";
        window.location.href = returnTo;
    };

    const completeOnboarding = () => {
        setShowResult(false);
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
            setShowNotifPrompt(true);
        } else {
            doNavigateAway();
        }
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

                <div className="relative z-10 w-full h-full max-w-[480px] mx-auto flex flex-col px-7 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[calc(5rem+env(safe-area-inset-bottom,0px))] animate-fadeIn">
                    {/* 상단 한 줄: AI DONA 배지(좌) + 닫기(우) — 모바일 앱과 동일 */}
                    <div className="flex shrink-0 items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-white/90 backdrop-blur-md">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                            AI DONA
                        </div>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white/85 transition-all hover:bg-white/20"
                            aria-label={t("common.close")}
                        >
                            <X size={22} strokeWidth={2} />
                        </button>
                    </div>

                    {/* 메인 카피 — 가운데 정렬 */}
                    <div className="flex min-h-0 flex-1 flex-col justify-center text-left">
                        <h1 className="text-4xl font-light leading-[1.15] tracking-tight text-white">
                            {t("onboarding.titleLine1")}
                            <br />
                            <span className="font-bold">{t("onboarding.titleLine2")}</span>
                        </h1>
                        <p className="mt-6 max-w-[88%] text-base font-light leading-relaxed text-white/70 whitespace-pre-line">
                            {t("onboarding.subtitle")}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleStart}
                        className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-lg active:scale-[0.98] transition-all flex items-center justify-between px-6 group shrink-0"
                    >
                        <span>{t("onboarding.startButton")}</span>
                        <ArrowRight
                            size={20}
                            className="text-emerald-100 group-hover:text-white group-hover:translate-x-1 transition-all"
                        />
                    </button>
                </div>
            </div>
        );
    }

    // 알림 권한 요청 프롬프트
    if (showNotifPrompt) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-6">
                <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1a241b] p-8 text-center shadow-2xl">
                    <div className="text-5xl mb-4">🔔</div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {t("onboarding.notifTitle")}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
                        {t("onboarding.notifSub")}
                    </p>
                    <button
                        type="button"
                        onClick={async () => {
                            await Notification.requestPermission();
                            doNavigateAway();
                        }}
                        className="w-full rounded-xl bg-emerald-600 py-4 font-bold text-white hover:bg-emerald-700 mb-3"
                    >
                        {t("onboarding.notifAccept")}
                    </button>
                    <button
                        type="button"
                        onClick={doNavigateAway}
                        className="text-sm text-gray-400 hover:text-gray-600"
                    >
                        {t("onboarding.notifSkip")}
                    </button>
                </div>
            </div>
        );
    }

    // 결과 화면
    if (showResult) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col justify-end animate-fadeIn">
                <div
                    className="absolute inset-0 bg-black/55 dark:bg-black/55 backdrop-blur-[2px]"
                    aria-hidden
                />
                <div
                    className="relative z-10 flex w-full max-w-[480px] flex-col rounded-t-[22px] border border-b-0 border-gray-100 bg-white px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl dark:border-gray-800 dark:bg-[#1a241b] sm:mx-auto"
                    style={{ animation: "slideUp 0.35s ease-out forwards" }}
                >
                    <div className="flex justify-center pb-2 pt-2">
                        <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
                    </div>
                    <button
                        type="button"
                        onClick={completeOnboarding}
                        className="absolute right-3 top-3 rounded-full p-2 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-300"
                        aria-label={t("common.close")}
                    >
                        <X size={24} />
                    </button>
                    <div className="mt-8 text-center">
                        <h2 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">
                            {t("onboarding.analysisDone")}
                        </h2>
                        <p className="mb-6 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                            {t("onboarding.dnaExtracted")}
                        </p>
                        <button
                            type="button"
                            onClick={completeOnboarding}
                            className="w-full rounded-xl bg-emerald-600 py-4 text-lg font-bold text-white transition-transform hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.99] dark:bg-emerald-600 dark:hover:bg-emerald-700"
                        >
                            {t("onboarding.viewCourses")}
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
                <div className="w-16 h-16 border-4 border-white/20 border-t-emerald-400 rounded-full animate-spin mb-6"></div>
                <h2 className="text-xl font-bold text-white animate-pulse">{t("onboarding.analyzing")}</h2>
            </div>
        );
    }

    // =================================================================
    // 메인 온보딩 UI (Step 1~4) — 하단 시트 + 딤 (모바일 앱과 동일한 패턴)
    // =================================================================
    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <button
                type="button"
                onClick={handleClose}
                className="absolute inset-0 bg-black/70 backdrop-blur-[2px] dark:bg-black/72"
                aria-label={t("common.close")}
            />
            <div
                className="relative z-10 flex h-[min(80dvh,100dvh)] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[22px] border border-b-0 border-gray-200 bg-linear-to-br from-emerald-50/50 to-white shadow-2xl dark:border-gray-800 dark:from-[#0f1710] dark:to-[#1a241b] sm:mx-auto"
                style={{ animation: "slideUp 0.35s ease-out forwards" }}
            >
                {/* 핸들 + 닫기 (앱 시트와 동일) */}
                <div className="flex shrink-0 justify-center pt-2.5 pb-1">
                    <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>
                <button
                    type="button"
                    onClick={handleClose}
                    className="absolute right-3.5 top-2.5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-sm backdrop-blur-sm transition-colors hover:bg-white dark:bg-gray-800/90 dark:text-gray-200 dark:hover:bg-gray-700"
                    aria-label={t("common.close")}
                >
                    <X size={22} />
                </button>

                {/* Progress — 닫기와 겹치지 않도록 상단 패딩 */}
                <div className="shrink-0 px-5 pb-2 pt-9">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200/90 dark:bg-gray-800/90">
                        <div
                            className="h-full rounded-full bg-linear-to-r from-[#7aa06f] to-emerald-500 transition-all duration-500 dark:from-emerald-600 dark:to-emerald-400"
                            style={{ width: `${Math.min(((currentStep - 1) / (totalSteps - 1)) * 100, 100)}%` }}
                        />
                    </div>
                </div>

                <div className="relative flex min-h-0 flex-1 flex-col px-5">
                    {currentStep === 1 && (
                        <div className="flex h-full min-h-0 flex-col overflow-y-auto scrollbar-hide">
                            <h1 className="mb-2 mt-1 shrink-0 text-[22px] font-semibold leading-tight tracking-tight text-gray-900 dark:text-white">
                                {t("onboarding.qVibe")}
                            </h1>
                            <div className="grid grid-cols-2 gap-3 pb-6">
                                {VIBE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => handleVibeSelect(opt)}
                                        className="group relative aspect-square overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800"
                                    >
                                        <Image
                                            src={opt.img}
                                            alt={t(`onboarding.vibe.${opt.id}` as TranslationKeys)}
                                            fill
                                            sizes="(max-width: 768px) 50vw, 400px"
                                            className="object-cover"
                                            priority
                                        />
                                        <span className="absolute inset-0 bg-black/35" aria-hidden />
                                        <span className="absolute bottom-3 left-3 right-2 text-left text-sm font-semibold text-white drop-shadow-md whitespace-pre-line">
                                            {t(`onboarding.vibe.${opt.id}` as TranslationKeys)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="flex h-full min-h-0 flex-col overflow-y-auto pb-4 scrollbar-hide">
                            <h1 className="mb-4 mt-1 shrink-0 text-[22px] font-semibold leading-tight tracking-tight text-gray-900 dark:text-white">
                                {t("onboarding.qCompanion")}
                            </h1>
                            <div className="grid grid-cols-2 gap-3">
                                {CREW_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => handleCompanionSelect(opt.value)}
                                        className={`flex min-h-[96px] flex-col items-start justify-center gap-1 rounded-[14px] border p-3 text-left transition-all active:scale-[0.98] ${
                                            selectedCompanion === opt.value
                                                ? "border-[#7aa06f] bg-white ring-2 ring-[#7aa06f] dark:border-emerald-600 dark:bg-[#0f1710] dark:ring-emerald-600"
                                                : "border-gray-100 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-[#0f1710] dark:hover:border-gray-700"
                                        }`}
                                    >
                                        <span className="text-base font-semibold text-gray-900 dark:text-white">
                                            {t(`onboarding.crew.${opt.id}.label` as TranslationKeys)}
                                        </span>
                                        <span className="text-xs leading-4 text-gray-500 dark:text-gray-400">
                                            {t(`onboarding.crew.${opt.id}.sub` as TranslationKeys)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="flex h-full min-h-0 flex-col overflow-y-auto pb-4 scrollbar-hide">
                            <h1 className="mb-1 mt-1 shrink-0 text-[22px] font-semibold leading-tight tracking-tight text-gray-900 dark:text-white">
                                {t("onboarding.qValue")}
                            </h1>
                            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{t("onboarding.step2Desc")}</p>
                            <div className="grid grid-cols-2 gap-3">
                                {VALUE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => handleValueSelect(opt)}
                                        className={`flex min-h-[168px] flex-col items-center rounded-[14px] border px-2.5 py-4 text-center transition-all active:scale-[0.98] ${
                                            selectedValueId === opt.id
                                                ? "border-[#7aa06f] bg-white ring-2 ring-[#7aa06f] dark:border-emerald-600 dark:bg-[#0f1710] dark:ring-emerald-600"
                                                : "border-gray-100 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-[#0f1710] dark:hover:border-gray-700"
                                        }`}
                                    >
                                        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-gray-50 text-[26px] dark:bg-gray-800/50">
                                            {opt.icon}
                                        </span>
                                        <h3 className="mt-2.5 text-sm font-semibold leading-snug tracking-tight text-gray-900 dark:text-white whitespace-pre-wrap">
                                            {t(`onboarding.value.${opt.id}` as TranslationKeys)}
                                        </h3>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="flex h-full min-h-0 flex-col px-0.5">
                            <div className="mb-4 mt-1 shrink-0">
                                <h1 className="mb-1 text-[22px] font-semibold text-gray-900 dark:text-white">
                                    {t("onboarding.step3Title")}
                                </h1>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t("onboarding.step3Desc")}</p>
                            </div>

                            <div className="min-h-0 flex-1 grid grid-cols-2 gap-3 content-start overflow-y-auto pb-4 scrollbar-hide">
                                {REGION_GROUPS.map((group) => {
                                    const isSelected = preferences.regions.includes(group.dbValues[0]);
                                    return (
                                        <button
                                            key={group.id}
                                            type="button"
                                            onClick={() => handleRegionSelect(group)}
                                            className={`relative flex min-h-[72px] items-center justify-center rounded-2xl border px-3 py-3.5 text-center text-sm font-bold shadow-sm transition-all duration-200 ${
                                                isSelected
                                                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-600"
                                                    : "border-gray-100 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-[#0f1710] dark:text-gray-400 dark:hover:border-gray-700 dark:hover:bg-gray-800/50"
                                            }`}
                                        >
                                            <span className={`${isSelected ? "scale-105" : ""} transition-transform`}>
                                                {t(`onboarding.region.${group.id}` as TranslationKeys)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="shrink-0 pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    disabled={preferences.regions.length === 0}
                                    className={`w-full rounded-2xl py-4 text-base font-extrabold tracking-tight shadow-lg transition-all ${
                                        preferences.regions.length > 0
                                            ? "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] dark:bg-emerald-600 dark:hover:bg-emerald-700"
                                            : "cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600"
                                    }`}
                                >
                                    {t("onboarding.analyzeButton")}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {currentStep > 1 && !isAnalyzing && !showResult && (
                    <div className="shrink-0 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
                        <button
                            type="button"
                            onClick={prevStep}
                            className="text-sm text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400"
                        >
                            {t("onboarding.prevStep")}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
export default AIOnboarding;
