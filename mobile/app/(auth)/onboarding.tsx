/**
 * 취향 온보딩 — 웹 src/app/(home)/onboarding/page.tsx 와 동일 UX
 * 인트로 → 4단계 질문 → 분석 오버레이 → 완료 모달
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    ActivityIndicator,
    Dimensions,
    Modal,
    Pressable,
    Animated,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import { api, endpoints } from "../../src/lib/api";
import { storage } from "../../src/lib/mmkv";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useLocale } from "../../src/lib/useLocale";
import { AUTH_QUERY_KEY } from "../../src/hooks/useAuth";
import {
    VIBE_OPTIONS,
    VALUE_OPTIONS,
    CREW_OPTIONS,
    REGION_GROUPS,
    type VibeOption,
    type ValueOption,
} from "../../src/constants/onboardingData";

const SW = Dimensions.get("window").width;
const SH = Dimensions.get("window").height;
/** 질문 시트 좌우 패딩 */
const SHEET_H_PAD = 20;
const GRID_GAP = 12;
/** 시트 내부 그리드 한 줄 너비 */
const SHEET_INNER_W = SW - SHEET_H_PAD * 2;
/** 2열 그리드 셀 너비 (동일 간격) */
const COL_W = (SHEET_INNER_W - GRID_GAP) / 2;
/** 1단계 분위기: 정사각형 2×2 */
const VIBE_CELL = COL_W;

type Prefs = {
    concept: string[];
    mood: string[];
    regions: string[];
    companion?: string;
    value?: string;
};

const STEP_KEYS = ["onboardingStep1", "onboardingStep2", "onboardingStep3", "onboardingStep4"] as const;

function stepDone(n: 1 | 2 | 3 | 4) {
    return storage.getString(`onboardingStep${n}`) === "1";
}
function setStepDone(n: 1 | 2 | 3 | 4) {
    storage.set(`onboardingStep${n}`, "1");
}
function clearOnboardingProgress() {
    STEP_KEYS.forEach((k) => storage.delete(k));
}

function mergeConceptMood(
    baseConcepts: string[],
    baseMoods: string[],
    addConcept: string | readonly string[],
    addMood: string | readonly string[],
) {
    const ac = typeof addConcept === "string" ? [addConcept] : [...addConcept];
    const am = typeof addMood === "string" ? [addMood] : [...addMood];
    return {
        concept: [...new Set([...baseConcepts, ...ac])],
        mood: [...new Set([...baseMoods, ...am])],
    };
}

export default function OnboardingScreen() {
    const theme = useThemeColors();
    const { t: tr } = useLocale();
    const queryClient = useQueryClient();
    const params = useLocalSearchParams<{ reset?: string }>();

    const [initReady, setInitReady] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [showIntro, setShowIntro] = useState(true);
    const introOpacity = useRef(new Animated.Value(1)).current;
    const sheetTranslateY = useRef(new Animated.Value(SH)).current;
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showResult, setShowResult] = useState(false);

    const [preferences, setPreferences] = useState<Prefs>({
        concept: [],
        mood: [],
        regions: [],
        companion: undefined,
        value: undefined,
    });
    const [selectedVibeIds, setSelectedVibeIds] = useState<string[]>([]);
    const [selectedCompanion, setSelectedCompanion] = useState<string | null>(null);
    const [selectedValueId, setSelectedValueId] = useState<string | null>(null);

    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSavingRef = useRef(false);

    const totalSteps = 4;

    const savePreferences = useCallback(async (prefsToSave: Prefs, silent = true) => {
        if (isSavingRef.current) return;
        try {
            isSavingRef.current = true;
            await api.post(endpoints.preferences, { preferences: prefsToSave });
            if (!silent) queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: ["preferences"] });
            queryClient.invalidateQueries({ queryKey: ["users", "preferences"] });
        } catch (e) {
            console.warn("Onboarding save failed", e);
        } finally {
            isSavingRef.current = false;
        }
    }, [queryClient]);

    const computeFirstUnansweredStep = useCallback((prefs: Prefs, flags: { s1: boolean; s2: boolean; s3: boolean; s4: boolean }) => {
        const step1Answered = flags.s1 || prefs.mood.length > 0 || prefs.concept.length > 0;
        if (!step1Answered) return 1;
        const step2Answered = flags.s2 || !!prefs.companion;
        if (!step2Answered) return 2;
        const step3Answered = flags.s3 || !!prefs.value;
        if (!step3Answered) return 3;
        return 4;
    }, []);

    // reset=true (쿼리) 시 로컬 진행 초기화
    useEffect(() => {
        if (params.reset !== "true") return;
        clearOnboardingProgress();
        storage.delete("onboardingComplete");
        setPreferences({ concept: [], mood: [], regions: [], companion: undefined, value: undefined });
        setSelectedVibeIds([]);
        setSelectedCompanion(null);
        setSelectedValueId(null);
        setCurrentStep(1);
        setShowIntro(true);
        setInitReady(true);
    }, [params.reset]);

    // 초기: 서버 취향 + MMKV 진행
    useEffect(() => {
        if (params.reset === "true") return;

        let cancelled = false;

        (async () => {
            let serverPrefs: Prefs | null = null;
            try {
                const raw = await api.get<{ preferences?: Prefs } | Prefs>(endpoints.preferences);
                if (cancelled) return;
                const prefsData = (raw as { preferences?: Prefs })?.preferences ?? raw;
                if (prefsData && typeof prefsData === "object") {
                    serverPrefs = {
                        concept: Array.isArray((prefsData as Prefs).concept) ? (prefsData as Prefs).concept : [],
                        mood: Array.isArray((prefsData as Prefs).mood) ? (prefsData as Prefs).mood : [],
                        regions: Array.isArray((prefsData as Prefs).regions) ? (prefsData as Prefs).regions : [],
                        companion: typeof (prefsData as Prefs).companion === "string" ? (prefsData as Prefs).companion : undefined,
                        value: typeof (prefsData as Prefs).value === "string" ? (prefsData as Prefs).value : undefined,
                    };
                    setPreferences(serverPrefs);
                    if (serverPrefs.companion) setSelectedCompanion(serverPrefs.companion);
                    if (serverPrefs.value) setSelectedValueId(serverPrefs.value);
                    const vibe = VIBE_OPTIONS.find(
                        (o) =>
                            o.concepts.every((c) => serverPrefs!.concept.includes(c)) &&
                            o.moods.every((m) => serverPrefs!.mood.includes(m)),
                    );
                    if (vibe) setSelectedVibeIds([vibe.id]);
                }
            } catch {
                /* ignore */
            }

            const s1 = stepDone(1);
            const s2 = stepDone(2);
            const s3 = stepDone(3);
            const s4 = stepDone(4);
            const basePrefs = serverPrefs ?? {
                concept: [],
                mood: [],
                regions: [],
                companion: undefined,
                value: undefined,
            };
            const next = computeFirstUnansweredStep(basePrefs, { s1, s2, s3, s4 });

            if (!cancelled) {
                setCurrentStep(1);
                setShowIntro(true);
                setInitReady(true);
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- 초기 1회
    }, [params.reset, computeFirstUnansweredStep]);

    // 자동 저장 (디바운스)
    useEffect(() => {
        const hasAny =
            preferences.concept.length > 0 ||
            preferences.mood.length > 0 ||
            preferences.regions.length > 0 ||
            !!preferences.companion ||
            !!preferences.value;
        if (!hasAny) return;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            savePreferences(preferences, true);
        }, 1000);
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [preferences, savePreferences]);

    const handleVibeSelect = (option: VibeOption) => {
        setPreferences((prev) => ({
            ...prev,
            concept: [...option.concepts],
            mood: [...option.moods],
        }));
        setSelectedVibeIds([option.id]);
        setStepDone(1);
        setTimeout(() => setCurrentStep(2), 300);
    };

    const handleCompanionSelect = (value: string) => {
        setPreferences((prev) => ({ ...prev, companion: value }));
        setSelectedCompanion(value);
        setStepDone(2);
        setTimeout(() => setCurrentStep(3), 300);
    };

    const handleValueSelect = (option: ValueOption) => {
        const step1Option = VIBE_OPTIONS.find((opt) => selectedVibeIds.includes(opt.id));
        const baseConcepts = step1Option ? [...step1Option.concepts] : [...preferences.concept];
        const baseMoods = step1Option ? [...step1Option.moods] : [...preferences.mood];
        const merged = mergeConceptMood(baseConcepts, baseMoods, option.addConcept, option.addMood);
        setPreferences((prev) => ({
            ...prev,
            concept: merged.concept,
            mood: merged.mood,
            value: option.id,
        }));
        setSelectedValueId(option.id);
        setStepDone(3);
        setTimeout(() => setCurrentStep(4), 300);
    };

    const handleRegionSelect = (group: (typeof REGION_GROUPS)[number]) => {
        setPreferences((prev) => {
            const current = prev.regions || [];
            const first = group.dbValues[0];
            const isSelected = current.includes(first);
            let newRegions = [...current];
            if (isSelected) {
                newRegions = newRegions.filter((r) => !(group.dbValues as readonly string[]).includes(r));
            } else {
                newRegions = [...new Set([...newRegions, ...(group.dbValues as readonly string[])])];
            }
            return { ...prev, regions: newRegions };
        });
        setStepDone(4);
    };

    const handleFinalize = async () => {
        setIsAnalyzing(true);
        await new Promise((r) => setTimeout(r, 1500));
        await savePreferences(preferences, false);
        setIsAnalyzing(false);
        setShowResult(true);
        storage.set("onboardingComplete", "1");
        clearOnboardingProgress();
    };

    const completeOnboarding = () => {
        setShowResult(false);
        router.back();
    };

    const handleClose = () => {
        // 수정 여부와 관계없이 현재 상태를 저장해 기존 데이터 보존
        const hasAny =
            preferences.concept.length > 0 ||
            preferences.mood.length > 0 ||
            preferences.regions.length > 0 ||
            !!preferences.companion ||
            !!preferences.value;
        if (hasAny) savePreferences(preferences, true);
        router.back();
    };

    const handleStart = () => {
        Animated.timing(introOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
        }).start(() => {
            setShowIntro(false);
            introOpacity.setValue(1);
        });
    };

    useEffect(() => {
        if (!showIntro && initReady) {
            sheetTranslateY.setValue(SH * 0.55);
            Animated.spring(sheetTranslateY, {
                toValue: 0,
                tension: 68,
                friction: 12,
                useNativeDriver: true,
            }).start();
        }
    }, [showIntro, initReady, sheetTranslateY]);

    const prevStep = () => {
        if (currentStep > 1) setCurrentStep((s) => s - 1);
    };

    const progressPct = Math.min(((currentStep - 1) / (totalSteps - 1)) * 100, 100);

    const cardBg = theme.isDark ? "#1a241b" : "#ffffff";
    const cardBorder = theme.isDark ? "#2d3748" : "#f3f4f6";
    const textMain = theme.text;
    const textMuted = theme.textMuted;
    const stepCardBg = theme.isDark ? "#0f1710" : "#ffffff";

    if (!initReady) {
        return (
            <View style={[styles.boot, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
                <ActivityIndicator size="large" color="#34d399" />
            </View>
        );
    }

    return (
        <View style={[styles.root, { backgroundColor: showIntro ? "#030712" : "#000" }]}>
            {showIntro ? (
                <View style={styles.introRoot}>
                    <View style={styles.introBg} />
                    <Animated.View style={[styles.introInner, { opacity: introOpacity }]}>
                        <SafeAreaView style={styles.introSafe} edges={["top", "bottom"]}>
                            {/* 상단 한 줄: 배지(좌) + 닫기(우) — 웹 인트로와 동일한 우선순위 */}
                            <View style={styles.introHeaderRow}>
                                <View style={styles.introBadge}>
                                    <View style={styles.introPulse} />
                                    <Text style={styles.introBadgeText}>AI DONA</Text>
                                </View>
                                <Pressable
                                    onPress={handleClose}
                                    style={({ pressed }) => [styles.introCloseBtn, pressed && { opacity: 0.85 }]}
                                    android_ripple={{ color: "rgba(255,255,255,0.2)", borderless: true }}
                                >
                                    <Ionicons name="close" size={22} color="rgba(255,255,255,0.85)" />
                                </Pressable>
                            </View>

                            <View style={styles.introMiddle}>
                                <Text style={styles.introTitle}>
                                    {tr("onboarding.titleLine1")}
                                    {"\n"}
                                    <Text style={styles.introTitleBold}>{tr("onboarding.titleLine2")}</Text>
                                </Text>
                                <Text style={styles.introSub}>{tr("onboarding.subtitle")}</Text>
                            </View>

                            <Pressable
                                onPress={handleStart}
                                style={({ pressed }) => [styles.introStartBtn, pressed && { opacity: 0.92 }]}
                                android_ripple={{ color: "rgba(255,255,255,0.15)" }}
                            >
                                <Text style={styles.introStartText}>{tr("onboarding.startButton")}</Text>
                                <Ionicons name="arrow-forward" size={22} color="rgba(255,255,255,0.95)" />
                            </Pressable>
                        </SafeAreaView>
                    </Animated.View>
                </View>
            ) : null}

            <Modal
                visible={!showIntro}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={handleClose}
            >
                <View style={styles.modalRoot}>
                    <Pressable
                        style={[styles.modalDim, { backgroundColor: theme.isDark ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.45)" }]}
                        onPress={handleClose}
                    />
                    <Animated.View
                        style={[
                            styles.questionSheet,
                            {
                                backgroundColor: cardBg,
                                borderColor: cardBorder,
                                transform: [{ translateY: sheetTranslateY }],
                            },
                        ]}
                    >
                        <SafeAreaView edges={["bottom"]} style={styles.sheetSafe}>
                            <View style={styles.sheetHandleZone}>
                                <View style={[styles.sheetHandle, { backgroundColor: theme.isDark ? "#4b5563" : "#d1d5db" }]} />
                            </View>

                            <Pressable
                                onPress={handleClose}
                                style={({ pressed }) => [
                                    styles.cardClose,
                                    {
                                        opacity: pressed ? 0.7 : 1,
                                        backgroundColor: theme.isDark ? "rgba(31,41,55,0.92)" : "rgba(255,255,255,0.9)",
                                    },
                                ]}
                                hitSlop={12}
                            >
                                <Ionicons name="close" size={22} color={textMain} />
                            </Pressable>

                            <View style={styles.progressOuter}>
                                <View style={[styles.progressTrack, { backgroundColor: theme.isDark ? "#374151" : "#e5e7eb" }]}>
                                    <View
                                        style={[
                                            styles.progressFill,
                                            {
                                                width: `${progressPct}%`,
                                                backgroundColor: theme.isDark ? "#34d399" : "#10b981",
                                            },
                                        ]}
                                    />
                                </View>
                            </View>

                            <ScrollView
                                style={styles.cardScroll}
                                contentContainerStyle={[
                                    styles.cardScrollContent,
                                    { paddingHorizontal: SHEET_H_PAD, flexGrow: 1 },
                                ]}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                            >
                                {currentStep === 1 && (
                                    <View>
                                        <Text style={[styles.qTitle, { color: textMain }]}>{tr("onboarding.qVibe")}</Text>
                                        <View style={styles.grid2x2}>
                                            {VIBE_OPTIONS.map((opt) => (
                                                <Pressable
                                                    key={opt.id}
                                                    onPress={() => handleVibeSelect(opt)}
                                                    style={({ pressed }) => [
                                                        styles.vibeCell,
                                                        { width: VIBE_CELL, height: VIBE_CELL },
                                                        pressed && { opacity: 0.92 },
                                                    ]}
                                                    android_ripple={{ color: "rgba(0,0,0,0.08)" }}
                                                >
                                                    <Image source={{ uri: opt.img }} style={StyleSheet.absoluteFillObject} />
                                                    <View style={styles.vibeDim} />
                                                    <Text style={styles.vibeLabel}>
                                                        {tr(`onboarding.vibe.${opt.id}` as "onboarding.vibe.healing")}
                                                    </Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    </View>
                                )}

                                {currentStep === 2 && (
                                    <View>
                                        <Text style={[styles.qTitle, { color: textMain, marginBottom: 16 }]}>
                                            {tr("onboarding.qCompanion")}
                                        </Text>
                                        <View style={styles.grid2x2}>
                                            {CREW_OPTIONS.map((opt) => {
                                                const sel = selectedCompanion === opt.value;
                                                return (
                                                    <Pressable
                                                        key={opt.value}
                                                        onPress={() => handleCompanionSelect(opt.value)}
                                                        style={[
                                                            styles.crewCell,
                                                            {
                                                                width: COL_W,
                                                                backgroundColor: stepCardBg,
                                                                borderColor: sel ? "#7aa06f" : theme.border,
                                                                borderWidth: sel ? 2 : 1,
                                                            },
                                                        ]}
                                                    >
                                                        <Text style={[styles.crewLabel, { color: textMain }]}>
                                                            {tr(`onboarding.crew.${opt.id}.label`)}
                                                        </Text>
                                                        <Text style={[styles.crewSub, { color: textMuted }]} numberOfLines={2}>
                                                            {tr(`onboarding.crew.${opt.id}.sub`)}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    </View>
                                )}

                                {currentStep === 3 && (
                                    <View>
                                        <Text style={[styles.qTitle, { color: textMain }]}>{tr("onboarding.qValue")}</Text>
                                        <Text style={[styles.qDesc, { color: textMuted }]}>{tr("onboarding.step2Desc")}</Text>
                                        <View style={styles.valueRow}>
                                            {VALUE_OPTIONS.map((opt) => {
                                                const sel = selectedValueId === opt.id;
                                                return (
                                                    <Pressable
                                                        key={opt.id}
                                                        onPress={() => handleValueSelect(opt)}
                                                        style={[
                                                            styles.valueCol,
                                                            {
                                                                backgroundColor: stepCardBg,
                                                                borderColor: sel ? "#7aa06f" : theme.border,
                                                                borderWidth: sel ? 2 : 1,
                                                            },
                                                        ]}
                                                    >
                                                        <View style={[styles.valueIconBox, { backgroundColor: theme.surface }]}>
                                                            <Text style={styles.valueEmoji}>{opt.icon}</Text>
                                                        </View>
                                                        <Text style={[styles.valueTitleCol, { color: textMain }]}>
                                                            {tr(`onboarding.value.${opt.id}` as "onboarding.value.visual")}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    </View>
                                )}

                                {currentStep === 4 && (
                                    <View>
                                        <Text style={[styles.qTitle, { color: textMain }]}>{tr("onboarding.step3Title")}</Text>
                                        <Text style={[styles.qDesc, { color: textMuted, marginBottom: 16 }]}>
                                            {tr("onboarding.step3Desc")}
                                        </Text>
                                        <View style={styles.grid2x2}>
                                            {REGION_GROUPS.map((group) => {
                                                const isSelected = preferences.regions.includes(group.dbValues[0]);
                                                return (
                                                    <Pressable
                                                        key={group.id}
                                                        onPress={() => handleRegionSelect(group)}
                                                        style={[
                                                            styles.regionCell,
                                                            { width: COL_W },
                                                            {
                                                                backgroundColor: isSelected
                                                                    ? theme.isDark
                                                                        ? "rgba(16,185,129,0.2)"
                                                                        : "#ecfdf5"
                                                                    : stepCardBg,
                                                                borderColor: isSelected ? "#10b981" : theme.border,
                                                            },
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.regionCellText,
                                                                { color: isSelected ? "#059669" : textMuted },
                                                            ]}
                                                        >
                                                            {tr(`onboarding.region.${group.id}` as "onboarding.region.SEONGSU")}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>

                                        <TouchableOpacity
                                            style={[
                                                styles.analyzeBtn,
                                                preferences.regions.length === 0 && {
                                                    backgroundColor: theme.isDark ? "#374151" : "#e5e7eb",
                                                },
                                            ]}
                                            onPress={handleFinalize}
                                            disabled={preferences.regions.length === 0}
                                            activeOpacity={0.9}
                                        >
                                            <Text
                                                style={[
                                                    styles.analyzeBtnText,
                                                    preferences.regions.length === 0 && {
                                                        color: theme.isDark ? "#6b7280" : "#9ca3af",
                                                    },
                                                ]}
                                            >
                                                {tr("onboarding.analyzeButton")}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </ScrollView>

                            {currentStep > 1 && (
                                <Pressable onPress={prevStep} style={styles.prevRow} hitSlop={8}>
                                    <Text style={[styles.prevText, { color: textMuted }]}>{tr("onboarding.prevStep")}</Text>
                                </Pressable>
                            )}
                        </SafeAreaView>
                    </Animated.View>
                </View>
            </Modal>

            <Modal visible={isAnalyzing} transparent animationType="slide" onRequestClose={() => {}}>
                <View style={styles.analyzeOverlay}>
                    <ActivityIndicator size="large" color="#34d399" style={{ marginBottom: 20 }} />
                    <Text style={styles.analyzeTitle}>{tr("onboarding.analyzing")}</Text>
                </View>
            </Modal>

            <Modal visible={showResult} transparent animationType="slide" onRequestClose={completeOnboarding}>
                <View style={[styles.resultOverlay, { justifyContent: "flex-end", paddingBottom: 0 }]}>
                    <View style={[styles.resultSheet, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                        <View style={[styles.sheetHandleZone, { paddingTop: 10 }]}>
                            <View style={[styles.sheetHandle, { backgroundColor: theme.isDark ? "#4b5563" : "#d1d5db" }]} />
                        </View>
                        <Pressable onPress={completeOnboarding} style={styles.resultX} hitSlop={12}>
                            <Ionicons name="close" size={24} color={textMuted} />
                        </Pressable>
                        <Text style={[styles.resultTitle, { color: textMain }]}>{tr("onboarding.analysisDone")}</Text>
                        <Text style={[styles.resultSub, { color: textMuted }]}>{tr("onboarding.dnaExtracted")}</Text>
                        <TouchableOpacity style={styles.resultCta} onPress={completeOnboarding} activeOpacity={0.9}>
                            <Text style={styles.resultCtaText}>{tr("onboarding.viewCourses")}</Text>
                        </TouchableOpacity>
                        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: cardBg }} />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    boot: { flex: 1, alignItems: "center", justifyContent: "center" },
    root: { flex: 1 },

    introRoot: { ...StyleSheet.absoluteFillObject, backgroundColor: "#030712" },
    introBg: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "#0f172a",
    },
    introInner: { flex: 1 },
    introSafe: {
        flex: 1,
        paddingHorizontal: 28,
        paddingBottom: Platform.OS === "ios" ? 28 : 20,
        justifyContent: "space-between",
    },
    introMiddle: { flex: 1, justifyContent: "center", minHeight: 0 },
    introHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        alignSelf: "stretch",
        marginBottom: 8,
    },
    introBadge: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.25)",
        backgroundColor: "rgba(255,255,255,0.08)",
        marginBottom: 0,
    },
    introPulse: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#34d399",
    },
    introBadgeText: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "500", letterSpacing: 1.2 },
    introTitle: {
        color: "#fff",
        fontSize: 34,
        fontWeight: "300",
        lineHeight: 42,
        letterSpacing: -0.5,
        marginBottom: 16,
    },
    introTitleBold: { fontWeight: "600" },
    introSub: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 16,
        lineHeight: 24,
        fontWeight: "300",
        maxWidth: "88%",
    },
    introCloseBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
        justifyContent: "center",
    },
    introStartBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#10b981",
        paddingVertical: 18,
        paddingHorizontal: 22,
        borderRadius: 16,
        marginBottom: 8,
    },
    introStartText: { color: "#fff", fontSize: 18, fontWeight: "600" },

    modalRoot: { flex: 1, justifyContent: "flex-end" },
    modalDim: { ...StyleSheet.absoluteFillObject },
    questionSheet: {
        width: "100%",
        height: SH * 0.8,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderWidth: 1,
        borderBottomWidth: 0,
        overflow: "hidden",
    },
    sheetSafe: { flex: 1, width: "100%" },
    sheetHandleZone: { alignItems: "center", paddingTop: 10, paddingBottom: 2 },
    sheetHandle: { width: 40, height: 4, borderRadius: 2 },

    cardClose: {
        position: "absolute",
        top: 10,
        right: 14,
        zIndex: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    progressOuter: { paddingHorizontal: SHEET_H_PAD, paddingTop: 36, paddingBottom: 8 },
    progressTrack: { height: 6, borderRadius: 999, overflow: "hidden" },
    progressFill: { height: 6, borderRadius: 999 },
    cardScroll: { flex: 1, minHeight: 0 },
    cardScrollContent: { paddingBottom: 24 },

    qTitle: { fontSize: 22, fontWeight: "600", marginTop: 4, marginBottom: 8, letterSpacing: -0.3 },
    qDesc: { fontSize: 14, marginBottom: 12, lineHeight: 20 },

    grid2x2: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: GRID_GAP,
        width: SHEET_INNER_W,
        alignSelf: "center",
    },
    vibeCell: {
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.06)",
    },
    vibeDim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.35)",
    },
    vibeLabel: {
        position: "absolute",
        left: 12,
        bottom: 14,
        right: 8,
        color: "#fff",
        fontSize: 13,
        fontWeight: "600",
        textShadowColor: "rgba(0,0,0,0.45)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },

    crewCell: {
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 14,
        minHeight: 96,
        justifyContent: "center",
    },
    crewLabel: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
    crewSub: { fontSize: 12, lineHeight: 16 },

    valueRow: {
        flexDirection: "row",
        gap: GRID_GAP,
        marginTop: 4,
        alignSelf: "stretch",
    },
    valueCol: {
        flex: 1,
        minWidth: 0,
        paddingVertical: 16,
        paddingHorizontal: 10,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "flex-start",
        minHeight: 168,
    },
    valueIconBox: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    valueEmoji: { fontSize: 26 },
    valueTitleCol: { fontSize: 14, fontWeight: "600", lineHeight: 20, textAlign: "center", marginTop: 10 },

    regionCell: {
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 72,
    },
    regionCellText: { fontSize: 13, fontWeight: "600", textAlign: "center" },

    analyzeBtn: {
        backgroundColor: "#059669",
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: "center",
        marginTop: 8,
        marginBottom: 8,
    },
    analyzeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

    prevRow: { paddingHorizontal: 20, paddingVertical: 12, paddingBottom: 16 },
    prevText: { fontSize: 14 },

    analyzeOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.75)",
        alignItems: "center",
        justifyContent: "center",
    },
    analyzeTitle: { color: "#fff", fontSize: 18, fontWeight: "600" },

    resultOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.55)",
        justifyContent: "flex-end",
    },
    resultSheet: {
        width: "100%",
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderWidth: 1,
        borderBottomWidth: 0,
        paddingHorizontal: 22,
        paddingBottom: 8,
        alignItems: "center",
    },
    resultX: { position: "absolute", top: 12, right: 12 },
    resultTitle: { fontSize: 22, fontWeight: "600", marginTop: 16, marginBottom: 8 },
    resultSub: { fontSize: 14, textAlign: "center", marginBottom: 22, lineHeight: 20 },
    resultCta: {
        width: "100%",
        backgroundColor: "#059669",
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    resultCtaText: { color: "#fff", fontSize: 17, fontWeight: "600" },
});
