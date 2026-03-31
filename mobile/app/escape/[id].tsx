/**
 * 이스케이프 게임 플레이 화면
 * 대화 → 장소 선택 → 미션(퀴즈/포토) → 다음 챕터 → 완료
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    TextInput,
    ActivityIndicator,
    Animated,
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
// expo-image-picker — EAS build 전용, Expo Go 미지원
let ImagePicker: typeof import("expo-image-picker") | null = null;
try { ImagePicker = require("expo-image-picker"); } catch {}

import { api } from "../../src/lib/api";
import { resolveImageUrl } from "../../src/lib/imageUrl";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useAuth } from "../../src/hooks/useAuth";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type DialogueMsg = { speaker?: string; role?: string; text: string };
type MissionType = "PUZZLE_ANSWER" | "PHOTO" | string;

interface PlaceOption {
    id: number;
    name: string;
    address?: string;
    description?: string;
    imageUrl?: string;
    signature?: string;
    category?: string;
    missions?: {
        id: number;
        missionType: MissionType;
        missionPayload: { question?: string; hint?: string; answer?: string; description?: string };
    }[];
    missionId?: number;
    missionType?: MissionType;
    missionPayload?: { question?: string; hint?: string; answer?: string };
}

interface Chapter {
    id: number;
    chapter_number: number;
    title: string;
    location_name?: string;
    address?: string;
    story_text: DialogueMsg[] | string;
    mission_type?: MissionType;
    mission_payload?: { question?: string; hint?: string };
    imageUrl?: string;
    placeOptions: PlaceOption[];
}

type Phase = "loading" | "dialogue" | "place_select" | "mission" | "between" | "complete";

// ─── 대화 메시지 파싱 ─────────────────────────────────────────────────────────

function parseDialogue(raw: DialogueMsg[] | string): DialogueMsg[] {
    if (Array.isArray(raw)) return raw.filter((m) => m.text?.trim());
    if (typeof raw === "string" && raw.trim()) {
        return raw
            .split("\n\n")
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) => ({ text: t }));
    }
    return [];
}

// ─── 대화 버블 ────────────────────────────────────────────────────────────────

function DialogueBubble({ msg, dona }: { msg: DialogueMsg; dona?: string }) {
    const t = useThemeColors();
    const isUser = msg.role === "user";
    const isSystem = msg.role === "system";

    if (isSystem) {
        return (
            <View style={db.systemWrap}>
                <Text style={db.systemText}>{msg.text}</Text>
            </View>
        );
    }

    return (
        <View style={[db.row, isUser && db.rowRight]}>
            {!isUser && (
                <Image
                    source={{ uri: dona || "https://d13xx6k6chk2in.cloudfront.net/logo/donalogo_512.png" }}
                    style={db.avatar}
                />
            )}
            <View style={{ maxWidth: SCREEN_W * 0.72 }}>
                {!isUser && msg.speaker ? (
                    <Text style={[db.speaker, { color: t.textMuted }]}>{msg.speaker}</Text>
                ) : null}
                <View style={[db.bubble, isUser ? db.bubbleUser : [db.bubbleAi, { backgroundColor: t.card, borderColor: t.border }]]}>
                    <Text style={[db.bubbleText, { color: isUser ? "#fff" : t.text }]}>{msg.text}</Text>
                </View>
            </View>
        </View>
    );
}

const db = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 10 },
    rowRight: { flexDirection: "row-reverse" },
    avatar: { width: 32, height: 32, borderRadius: 16 },
    speaker: { fontSize: 11, marginBottom: 3, marginLeft: 2 },
    bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: "transparent" },
    bubbleUser: { backgroundColor: "#059669", borderColor: "#059669" },
    bubbleAi: {},
    bubbleText: { fontSize: 14, lineHeight: 21 },
    systemWrap: { alignSelf: "center", backgroundColor: "rgba(5,150,105,0.1)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, marginBottom: 10 },
    systemText: { fontSize: 12, color: "#059669", fontWeight: "500", textAlign: "center" },
});

// ─── 장소 선택 카드 ───────────────────────────────────────────────────────────

function PlaceCard({ place, onSelect }: { place: PlaceOption; onSelect: () => void }) {
    const t = useThemeColors();
    const imgUri = resolveImageUrl(place.imageUrl);

    return (
        <TouchableOpacity
            style={[pc.card, { backgroundColor: t.card, borderColor: t.border }]}
            activeOpacity={0.85}
            onPress={onSelect}
        >
            {imgUri ? (
                <Image source={{ uri: imgUri }} style={pc.img} resizeMode="cover" />
            ) : (
                <View style={[pc.img, { backgroundColor: t.isDark ? "#1f2937" : "#e5e7eb", alignItems: "center", justifyContent: "center" }]}>
                    <Ionicons name="location" size={28} color={t.textMuted} />
                </View>
            )}
            <View style={pc.body}>
                <Text style={[pc.name, { color: t.text }]} numberOfLines={1}>{place.name}</Text>
                {place.signature ? (
                    <Text style={[pc.sig, { color: "#059669" }]} numberOfLines={1}>{place.signature}</Text>
                ) : null}
                {place.address ? (
                    <Text style={[pc.addr, { color: t.textMuted }]} numberOfLines={1}>{place.address}</Text>
                ) : null}
                {place.description ? (
                    <Text style={[pc.desc, { color: t.textMuted }]} numberOfLines={2}>{place.description}</Text>
                ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.textMuted} style={{ alignSelf: "center" }} />
        </TouchableOpacity>
    );
}

const pc = StyleSheet.create({
    card: { flexDirection: "row", borderRadius: 14, overflow: "hidden", borderWidth: 1, marginBottom: 10 },
    img: { width: 80, height: 80 },
    body: { flex: 1, padding: 10, justifyContent: "center" },
    name: { fontSize: 15, fontWeight: "500", marginBottom: 2 },
    sig: { fontSize: 12, fontWeight: "500", marginBottom: 2 },
    addr: { fontSize: 11, marginBottom: 2 },
    desc: { fontSize: 12, lineHeight: 17 },
});

// ─── 메인 게임 화면 ───────────────────────────────────────────────────────────

export default function EscapePlayScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const storyId = Number(id);
    const t = useThemeColors();
    const insets = useSafeAreaInsets();
    const { isAuthenticated } = useAuth();
    const scrollRef = useRef<ScrollView>(null);

    const [phase, setPhase] = useState<Phase>("loading");
    const [chapterIdx, setChapterIdx] = useState(0);
    const [dialogueIdx, setDialogueIdx] = useState(0);
    const [parsedDialogue, setParsedDialogue] = useState<DialogueMsg[]>([]);
    const [visibleMessages, setVisibleMessages] = useState<DialogueMsg[]>([]);
    const [selectedPlace, setSelectedPlace] = useState<PlaceOption | null>(null);
    const [answer, setAnswer] = useState("");
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [missionResult, setMissionResult] = useState<"correct" | "wrong" | null>(null);
    const typingAnim = useRef(new Animated.Value(0)).current;

    // 챕터 목록 로드
    const { data: chapters = [], isLoading } = useQuery<Chapter[]>({
        queryKey: ["escape", "chapters", storyId],
        queryFn: () => api.get(`/api/escape/chapters?storyId=${storyId}`),
        enabled: !!storyId,
    });

    const currentChapter = chapters[chapterIdx] ?? null;

    // 챕터 변경 시 대화 초기화
    useEffect(() => {
        if (!currentChapter) return;
        const msgs = parseDialogue(currentChapter.story_text);
        setParsedDialogue(msgs);
        setVisibleMessages([]);
        setDialogueIdx(0);
        setSelectedPlace(null);
        setAnswer("");
        setPhotoUri(null);
        setMissionResult(null);
        if (msgs.length > 0) {
            setPhase("dialogue");
        } else if (currentChapter.placeOptions?.length > 0) {
            setPhase("place_select");
        } else {
            setPhase("mission");
        }
    }, [chapterIdx, chapters]);

    // 첫 로드
    useEffect(() => {
        if (!isLoading && chapters.length > 0) {
            setChapterIdx(0);
        }
    }, [isLoading, chapters.length]);

    // 대화 메시지 순차 표시
    useEffect(() => {
        if (phase !== "dialogue") return;
        if (dialogueIdx >= parsedDialogue.length) return;
        const msg = parsedDialogue[dialogueIdx];
        const timer = setTimeout(() => {
            setVisibleMessages((prev) => [...prev, msg]);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }, dialogueIdx === 0 ? 300 : 600);
        return () => clearTimeout(timer);
    }, [phase, dialogueIdx, parsedDialogue]);

    const advanceDialogue = useCallback(() => {
        const next = dialogueIdx + 1;
        if (next < parsedDialogue.length) {
            setDialogueIdx(next);
        } else {
            // 대화 끝 → 장소 선택 or 미션
            if (currentChapter?.placeOptions?.length > 0) {
                setPhase("place_select");
            } else {
                setPhase("mission");
            }
        }
    }, [dialogueIdx, parsedDialogue.length, currentChapter]);

    const handleSelectPlace = useCallback((place: PlaceOption) => {
        setSelectedPlace(place);
        setPhase("mission");
    }, []);

    const handleSubmitMission = useCallback(async () => {
        if (submitting) return;
        const place = selectedPlace ?? ({ missionId: currentChapter?.id, missionType: currentChapter?.mission_type, missionPayload: currentChapter?.mission_payload } as any);
        const mission = place?.missions?.[0] ?? {
            id: place?.missionId,
            missionType: place?.missionType,
            missionPayload: place?.missionPayload,
        };

        const missionType = String(mission?.missionType || "").toUpperCase();
        const correctAnswer = String(mission?.missionPayload?.answer || "").trim().toLowerCase();

        if (missionType === "PUZZLE_ANSWER" || missionType === "QUIZ") {
            if (!answer.trim()) {
                Alert.alert("답을 입력해주세요");
                return;
            }
            const isCorrect = correctAnswer
                ? answer.trim().toLowerCase().includes(correctAnswer) || correctAnswer.includes(answer.trim().toLowerCase())
                : true; // 정답이 없으면 통과
            setMissionResult(isCorrect ? "correct" : "wrong");
            if (!isCorrect) return;
        } else if (missionType === "PHOTO") {
            if (!photoUri) {
                Alert.alert("사진을 찍어주세요");
                return;
            }
        }

        setSubmitting(true);
        try {
            // 미션 결과 서버 저장 (선택적)
            if (mission?.id) {
                await api.post("/api/escape/place-missions/submit", {
                    placeId: selectedPlace?.id,
                    missionId: mission.id,
                    isCorrect: true,
                }).catch(() => {});
            }
            // 진행도 저장
            await api.post("/api/escape/progress", {
                story_id: storyId,
                current_chapter: chapterIdx + 1,
                status: chapterIdx + 1 >= chapters.length ? "completed" : "in_progress",
            }).catch(() => {});
        } finally {
            setSubmitting(false);
        }

        // 다음 챕터 or 완료
        if (chapterIdx + 1 >= chapters.length) {
            // 완료
            await api.post("/api/escape/complete", { storyId }).catch(() => {});
            setPhase("complete");
        } else {
            setPhase("between");
        }
    }, [submitting, answer, photoUri, selectedPlace, currentChapter, chapterIdx, chapters.length, storyId]);

    const handleNextChapter = useCallback(() => {
        setChapterIdx((prev) => prev + 1);
    }, []);

    const handlePickPhoto = useCallback(async () => {
        if (!ImagePicker) {
            Alert.alert("미지원", "카메라 기능은 정식 앱에서 사용 가능합니다.");
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
            setPhotoUri(result.assets[0].uri);
        }
    }, []);

    // ─── 렌더링 ─────────────────────────────────────────────────────────────

    if (isLoading || phase === "loading") {
        return (
            <SafeAreaView style={[s.root, { backgroundColor: t.background }]} edges={["top"]}>
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator color="#059669" size="large" />
                    <Text style={{ color: t.textMuted, marginTop: 12 }}>스토리 불러오는 중...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // ─── 완료 화면 ──────────────────────────────────────────────────────────
    if (phase === "complete") {
        return (
            <SafeAreaView style={[s.root, { backgroundColor: t.background }]} edges={["top", "bottom"]}>
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
                    <Text style={{ fontSize: 64, marginBottom: 16 }}>🎉</Text>
                    <Text style={[s.completeTitle, { color: t.text }]}>미션 완료!</Text>
                    <Text style={[s.completeSub, { color: t.textMuted }]}>
                        모든 미션을 성공적으로 완료했어요.{"\n"}수고하셨습니다!
                    </Text>
                    <TouchableOpacity
                        style={[s.completeBtn, { marginTop: 32 }]}
                        onPress={() => router.replace("/escape" as any)}
                    >
                        <Text style={s.completeBtnText}>목록으로 돌아가기</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ─── 챕터 사이 화면 ─────────────────────────────────────────────────────
    if (phase === "between") {
        return (
            <SafeAreaView style={[s.root, { backgroundColor: t.background }]} edges={["top", "bottom"]}>
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
                    <View style={s.betweenIconWrap}>
                        <Ionicons name="checkmark-circle" size={56} color="#059669" />
                    </View>
                    <Text style={[s.betweenTitle, { color: t.text }]}>챕터 {chapterIdx + 1} 완료!</Text>
                    <Text style={[s.betweenSub, { color: t.textMuted }]}>
                        다음 목적지로 이동해주세요.
                    </Text>
                    {chapters[chapterIdx + 1] && (
                        <View style={[s.nextChapterCard, { backgroundColor: t.card, borderColor: t.border }]}>
                            <Text style={[{ fontSize: 12, color: t.textMuted }]}>다음 챕터</Text>
                            <Text style={[{ fontSize: 16, fontWeight: "500", color: t.text, marginTop: 4 }]}>
                                {chapters[chapterIdx + 1].title}
                            </Text>
                            {chapters[chapterIdx + 1].location_name && (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                                    <Ionicons name="location-outline" size={13} color="#059669" />
                                    <Text style={{ fontSize: 12, color: "#059669" }}>{chapters[chapterIdx + 1].location_name}</Text>
                                </View>
                            )}
                        </View>
                    )}
                    <TouchableOpacity style={s.nextBtn} onPress={handleNextChapter}>
                        <Text style={s.nextBtnText}>다음 챕터 시작하기 →</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ─── 진행 바 ────────────────────────────────────────────────────────────
    const progress = chapters.length > 0 ? (chapterIdx / chapters.length) : 0;

    return (
        <SafeAreaView style={[s.root, { backgroundColor: t.background }]} edges={["top"]}>
            {/* 헤더 */}
            <View style={[s.header, { borderBottomColor: t.border }]}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={22} color={t.text} />
                </TouchableOpacity>
                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                    <View style={[s.progressBar, { backgroundColor: t.isDark ? "#1f2937" : "#e5e7eb" }]}>
                        <Animated.View style={[s.progressFill, { width: `${progress * 100}%` }]} />
                    </View>
                    <Text style={[s.progressLabel, { color: t.textMuted }]}>
                        챕터 {chapterIdx + 1} / {chapters.length}
                    </Text>
                </View>
                <Text style={[s.chapterTag, { color: "#059669" }]}>
                    {currentChapter?.title ?? ""}
                </Text>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                {/* 대화 화면 */}
                {phase === "dialogue" && (
                    <>
                        <ScrollView
                            ref={scrollRef}
                            style={{ flex: 1 }}
                            contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {visibleMessages.map((msg, i) => (
                                <DialogueBubble key={i} msg={msg} />
                            ))}
                        </ScrollView>
                        <View style={[s.dialogueBar, { borderTopColor: t.border, backgroundColor: t.card, paddingBottom: insets.bottom + 8 }]}>
                            <TouchableOpacity style={s.tapNextBtn} onPress={advanceDialogue}>
                                <Text style={s.tapNextText}>
                                    {dialogueIdx + 1 >= parsedDialogue.length ? "장소 선택하기" : "다음 →"}
                                </Text>
                                <Ionicons name="arrow-forward" size={16} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </>
                )}

                {/* 장소 선택 */}
                {phase === "place_select" && (
                    <ScrollView
                        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
                        showsVerticalScrollIndicator={false}
                    >
                        <Text style={[s.sectionTitle, { color: t.text }]}>장소를 선택해주세요</Text>
                        <Text style={[s.sectionSub, { color: t.textMuted }]}>방문할 장소를 골라 미션을 수행하세요</Text>
                        {currentChapter?.placeOptions?.map((place) => (
                            <PlaceCard key={place.id} place={place} onSelect={() => handleSelectPlace(place)} />
                        ))}
                    </ScrollView>
                )}

                {/* 미션 */}
                {phase === "mission" && (() => {
                    const place = selectedPlace;
                    const mission = place?.missions?.[0] ?? {
                        missionType: place?.missionType ?? currentChapter?.mission_type,
                        missionPayload: place?.missionPayload ?? currentChapter?.mission_payload,
                    };
                    const missionType = String(mission?.missionType || "").toUpperCase();
                    const payload = mission?.missionPayload ?? {};

                    return (
                        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
                            {/* 선택한 장소 */}
                            {place && (
                                <View style={[s.placeSummary, { backgroundColor: t.isDark ? "#0d2818" : "#ecfdf5", borderColor: t.isDark ? "#065f46" : "#a7f3d0" }]}>
                                    <Ionicons name="location" size={16} color="#059669" />
                                    <Text style={[s.placeSummaryText, { color: t.isDark ? "#6ee7b7" : "#047857" }]}>
                                        {place.name}
                                    </Text>
                                </View>
                            )}

                            <Text style={[s.missionTitle, { color: t.text }]}>미션</Text>

                            {(missionType === "PUZZLE_ANSWER" || missionType === "QUIZ") && (
                                <>
                                    <Text style={[s.missionQ, { color: t.text }]}>{payload.question ?? "미션을 완료해주세요"}</Text>
                                    {payload.hint && (
                                        <View style={[s.hintBox, { backgroundColor: t.isDark ? "#1c2e1f" : "#fef3c7" }]}>
                                            <Ionicons name="bulb-outline" size={14} color="#f59e0b" />
                                            <Text style={{ fontSize: 13, color: "#b45309", flex: 1 }}>{payload.hint}</Text>
                                        </View>
                                    )}
                                    {missionResult === "wrong" && (
                                        <View style={s.wrongBox}>
                                            <Ionicons name="close-circle" size={16} color="#dc2626" />
                                            <Text style={{ color: "#dc2626", fontSize: 13 }}>틀렸어요. 다시 시도해보세요!</Text>
                                        </View>
                                    )}
                                    <TextInput
                                        style={[s.answerInput, { color: t.text, backgroundColor: t.isDark ? "#1f2937" : "#f9fafb", borderColor: missionResult === "wrong" ? "#dc2626" : t.border }]}
                                        placeholder="답을 입력하세요..."
                                        placeholderTextColor={t.textMuted}
                                        value={answer}
                                        onChangeText={(v) => { setAnswer(v); setMissionResult(null); }}
                                        returnKeyType="done"
                                    />
                                </>
                            )}

                            {missionType === "PHOTO" && (
                                <>
                                    <Text style={[s.missionQ, { color: t.text }]}>{payload.question ?? payload.description ?? "인증 사진을 찍어주세요"}</Text>
                                    <TouchableOpacity style={[s.photoPicker, { backgroundColor: t.isDark ? "#1f2937" : "#f9fafb", borderColor: t.border }]} onPress={handlePickPhoto}>
                                        {photoUri ? (
                                            <Image source={{ uri: photoUri }} style={{ width: "100%", height: "100%", borderRadius: 12 }} resizeMode="cover" />
                                        ) : (
                                            <View style={{ alignItems: "center", gap: 8 }}>
                                                <Ionicons name="camera" size={32} color={t.textMuted} />
                                                <Text style={{ color: t.textMuted, fontSize: 14 }}>탭하여 사진 찍기</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                </>
                            )}

                            {(!missionType || missionType === "NONE" || missionType === "LOCATION") && (
                                <View style={{ alignItems: "center", paddingVertical: 20 }}>
                                    <Ionicons name="location" size={40} color="#059669" />
                                    <Text style={[{ fontSize: 15, color: t.textMuted, marginTop: 12, textAlign: "center" }]}>
                                        {payload.description ?? "해당 장소에 도착했다면 완료해주세요"}
                                    </Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                                onPress={handleSubmitMission}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={s.submitBtnText}>
                                        {chapterIdx + 1 >= chapters.length ? "미션 완료!" : "다음 챕터로 →"}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    );
                })()}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, gap: 4 },
    progressBar: { height: 4, borderRadius: 2, overflow: "hidden", marginBottom: 2 },
    progressFill: { height: "100%", backgroundColor: "#059669", borderRadius: 2 },
    progressLabel: { fontSize: 11 },
    chapterTag: { fontSize: 12, fontWeight: "500", maxWidth: 100 },
    // 대화
    dialogueBar: { padding: 16, borderTopWidth: 1 },
    tapNextBtn: { backgroundColor: "#059669", borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    tapNextText: { fontSize: 15, fontWeight: "500", color: "#fff" },
    // 장소
    sectionTitle: { fontSize: 18, fontWeight: "600", letterSpacing: -0.4, marginBottom: 4 },
    sectionSub: { fontSize: 13, marginBottom: 16 },
    // 미션
    placeSummary: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
    placeSummaryText: { fontSize: 14, fontWeight: "500" },
    missionTitle: { fontSize: 13, fontWeight: "500", color: "#059669", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
    missionQ: { fontSize: 17, fontWeight: "500", lineHeight: 25, marginBottom: 14 },
    hintBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, marginBottom: 12 },
    wrongBox: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
    answerInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 16 },
    photoPicker: { width: "100%", height: 200, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 16, borderStyle: "dashed" },
    submitBtn: { backgroundColor: "#059669", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8 },
    submitBtnText: { fontSize: 16, fontWeight: "500", color: "#fff" },
    // 챕터 사이
    betweenIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: "#ecfdf5", alignItems: "center", justifyContent: "center", marginBottom: 20 },
    betweenTitle: { fontSize: 24, fontWeight: "600", marginBottom: 8 },
    betweenSub: { fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 24 },
    nextChapterCard: { width: "100%", padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 24 },
    nextBtn: { backgroundColor: "#059669", borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32, alignItems: "center" },
    nextBtnText: { fontSize: 16, fontWeight: "500", color: "#fff" },
    // 완료
    completeTitle: { fontSize: 28, fontWeight: "600", marginBottom: 10 },
    completeSub: { fontSize: 15, textAlign: "center", lineHeight: 23 },
    completeBtn: { backgroundColor: "#059669", borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32 },
    completeBtnText: { fontSize: 16, fontWeight: "500", color: "#fff" },
});
