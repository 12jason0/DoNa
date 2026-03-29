/**
 * 나만의 추억 기록하기 화면 (웹 UI 동일 버전)
 * 인트로(블러 배경 + 카드) → 사진 업로드 → 태그+설명+저장 → 성공 모달
 */
import React, { useState, useCallback, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
    ImageBackground,
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useQueryClient } from "@tanstack/react-query";

import { api, endpoints } from "../../../src/lib/api";
import { useAuth } from "../../../src/hooks/useAuth";
import { useThemeColors } from "../../../src/hooks/useThemeColors";
import { Colors } from "../../../src/constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MAX_PHOTOS = 10;
const MAX_DESC = 1000;
const SUGGESTED_TAGS = ["낭만적인", "감성", "조용한", "인생샷", "숨겨진", "데이트", "사진", "카페", "맛집"];

type Course = {
    id: string;
    title: string;
    imageUrl?: string;
    region?: string;
    coursePlaces?: { order_index: number; place: { id: number; name?: string; imageUrl?: string } }[];
};

async function uploadImageViaPresign(uri: string, courseId: string): Promise<string> {
    const filename = uri.split("/").pop() ?? "photo.jpg";
    const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
    const contentType = ext === "png" ? "image/png" : "image/jpeg";

    const presignRes = await api.post<{ success: boolean; uploads: { uploadUrl: string; publicUrl: string }[] }>(
        "/api/upload/presign",
        { type: "memory", courseId: String(courseId), files: [{ filename, contentType, size: 0 }] },
    );
    if (!presignRes.success || !presignRes.uploads?.[0]) throw new Error("업로드 URL을 받지 못했습니다.");

    const { uploadUrl, publicUrl } = presignRes.uploads[0];
    const blobRes = await fetch(uri);
    const blob = await blobRes.blob();
    const putRes = await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": contentType } });
    if (!putRes.ok) throw new Error("이미지 업로드에 실패했습니다.");
    return publicUrl;
}

export default function CourseStartMemoryScreen() {
    const t = useThemeColors();
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [course, setCourse] = useState<Course | null>(null);

    // 인트로 / 페이지 상태
    const [showIntro, setShowIntro] = useState(true);
    const [pageIndex, setPageIndex] = useState(0);

    // 사진 상태 (localUris: 미리보기, uploadedUrls: 업로드 완료 URL)
    const [localUris, setLocalUris] = useState<string[]>([]);
    const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    // 폼 상태
    const [rating, setRating] = useState(5);
    const [description, setDescription] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>(["DoNa"]);
    const [tagInput, setTagInput] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // 코스 데이터 로드
    useEffect(() => {
        if (!id) return;
        api.get<Course>(endpoints.courseStart(id))
            .then(setCourse)
            .catch(() => {});
    }, [id]);

    const bgImageUrl = course?.imageUrl ?? course?.coursePlaces?.[0]?.place?.imageUrl;
    const userName = user?.name ?? user?.nickname ?? (user?.email ? user.email.split("@")[0] : null);

    const formattedDate = new Date()
        .toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" })
        .replace(/\s/g, "");
    const fullDate = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

    const headingText = userName && course?.region
        ? `${userName}의 ${course.region} 데이트`
        : userName
        ? `${userName}의 데이트`
        : course?.region
        ? `${course.region} 데이트`
        : "우리의 데이트";

    // 사진 선택 + 즉시 업로드
    const handlePickPhotos = useCallback(async () => {
        let ImagePicker: typeof import("expo-image-picker");
        try {
            ImagePicker = require("expo-image-picker");
        } catch {
            Alert.alert("알림", "이미지 선택은 앱 빌드에서만 사용 가능합니다.");
            return;
        }
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert("권한 필요", "사진 접근 권한이 필요합니다.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8,
            selectionLimit: MAX_PHOTOS - localUris.length,
        });
        if (result.canceled) return;

        const newUris = result.assets.map((a) => a.uri);
        setLocalUris((prev) => [...prev, ...newUris].slice(0, MAX_PHOTOS));

        if (!id) return;
        setUploading(true);
        try {
            const newUrls = await Promise.all(newUris.map((uri) => uploadImageViaPresign(uri, id)));
            setUploadedUrls((prev) => [...prev, ...newUrls].slice(0, MAX_PHOTOS));
        } catch (e: any) {
            Alert.alert("업로드 실패", e?.message ?? "이미지 업로드에 실패했습니다.");
        } finally {
            setUploading(false);
        }
    }, [localUris, id]);

    const removePhoto = useCallback((index: number) => {
        setLocalUris((prev) => prev.filter((_, i) => i !== index));
        setUploadedUrls((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const toggleTag = useCallback((tag: string) => {
        if (tag === "DoNa") return;
        setSelectedTags((prev) => {
            const userTags = prev.filter((t2) => t2 !== "DoNa");
            const next = userTags.includes(tag) ? userTags.filter((t2) => t2 !== tag) : [...userTags, tag];
            return ["DoNa", ...next];
        });
    }, []);

    const addCustomTag = useCallback(() => {
        const tag = tagInput.trim().replace(/^#/, "");
        if (!tag || tag.length > 10) return;
        setSelectedTags((prev) => {
            const userTags = prev.filter((t2) => t2 !== "DoNa");
            if (userTags.includes(tag)) return prev;
            return ["DoNa", ...userTags, tag];
        });
        setTagInput("");
    }, [tagInput]);

    const removeTag = useCallback((tag: string) => {
        if (tag === "DoNa") return;
        setSelectedTags((prev) => prev.filter((t2) => t2 !== tag));
    }, []);

    const handleNext = useCallback(() => {
        if (localUris.length < 1) {
            Alert.alert("알림", "최소 1장 이상의 사진을 추가해주세요.");
            return;
        }
        if (uploading) {
            Alert.alert("알림", "사진 업로드 중입니다. 잠시 기다려주세요.");
            return;
        }
        setPageIndex(1);
    }, [localUris, uploading]);

    const handleSubmit = useCallback(async () => {
        if (!id) return;
        if (uploadedUrls.length < 1) {
            Alert.alert("알림", "사진 업로드를 기다려주세요.");
            return;
        }
        setSubmitting(true);
        try {
            await api.post("/api/reviews", {
                courseId: Number(id),
                rating,
                content: description,
                imageUrls: uploadedUrls,
                isPublic: false,
                tags: selectedTags,
                placeData: { "0": { photos: uploadedUrls, tags: selectedTags } },
            });
            // 홈 + 마이페이지 추억 목록 즉시 갱신
            queryClient.invalidateQueries({ queryKey: ["users", "personal-stories"] });
            setShowSuccessModal(true);
        } catch (e: any) {
            const msg = e?.message ?? "";
            if (msg.includes("MEMORY_LIMIT") || msg.includes("한도") || msg.includes("업그레이드")) {
                Alert.alert(
                    "저장 한도 초과",
                    "나만의 추억 저장 한도에 도달했어요. 구독을 업그레이드하면 더 저장할 수 있어요.",
                    [
                        { text: "닫기", style: "cancel" },
                        { text: "구독 보기", onPress: () => router.push("/shop" as any) },
                    ],
                );
            } else {
                Alert.alert("저장 실패", msg || "추억 저장 중 오류가 발생했습니다.");
            }
        } finally {
            setSubmitting(false);
        }
    }, [id, rating, description, uploadedUrls, selectedTags]);

    // ─── 성공 모달 ────────────────────────────────────────────────────────────
    if (showSuccessModal) {
        return (
            <Modal visible transparent animationType="fade">
                <View style={s.modalOverlay}>
                    <View style={[s.successCard, { backgroundColor: t.card }]}>
                        <Text style={s.successEmoji}>📸</Text>
                        <Text style={[s.successTitle, { color: t.text }]}>추억이 저장됐어요!</Text>
                        <Text style={[s.successSub, { color: t.textMuted }]}>마이페이지에서 다시 볼 수 있어요</Text>
                        <TouchableOpacity
                            style={[s.successBtn, { backgroundColor: Colors.brandGreen }]}
                            onPress={() => router.push("/(tabs)" as any)}
                        >
                            <Text style={s.successBtnText}>홈으로 돌아가기</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    }

    // ─── 인트로 화면 ──────────────────────────────────────────────────────────
    if (showIntro) {
        return (
            <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => setShowIntro(false)}
            >
                {bgImageUrl ? (
                    <ImageBackground
                        source={{ uri: bgImageUrl }}
                        style={StyleSheet.absoluteFill}
                        blurRadius={20}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[StyleSheet.absoluteFill, s.gradientFallback]} />
                )}
                <View style={[StyleSheet.absoluteFill, s.dimOverlay]} />

                <View style={[s.introCardWrap, { paddingBottom: insets.bottom + 56 }]}>
                    <View style={s.introCard}>
                        <Text style={s.introTitle}>{headingText}</Text>
                        <Text style={s.introDate}>❤️ {formattedDate}</Text>
                        <Text style={s.introHint}>화면을 터치하여 시작하기</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    }

    // ─── 메인 화면 ────────────────────────────────────────────────────────────
    return (
        <View style={StyleSheet.absoluteFill}>
            {/* 블러 배경 */}
            {bgImageUrl ? (
                <ImageBackground
                    source={{ uri: bgImageUrl }}
                    style={StyleSheet.absoluteFill}
                    blurRadius={8}
                    resizeMode="cover"
                />
            ) : (
                <View style={[StyleSheet.absoluteFill, s.gradientFallback]} />
            )}
            <View style={[StyleSheet.absoluteFill, s.dimOverlayLight]} />

            {/* 닫기 버튼 */}
            <View style={[s.closeWrap, { top: insets.top + 8 }]}>
                <TouchableOpacity
                    style={s.closeBtn}
                    onPress={() => router.back()}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Text style={s.closeBtnText}>✕</Text>
                </TouchableOpacity>
            </View>

            {/* 하단 시트 */}
            <View
                style={[
                    s.bottomSheet,
                    {
                        bottom: insets.bottom,
                        backgroundColor: t.card,
                        borderColor: t.border,
                    },
                ]}
            >
                {/* 시트 헤더 */}
                <View style={[s.sheetHeader, { borderBottomColor: t.border }]}>
                    <Text style={[s.sheetTitle, { color: t.text }]}>{headingText}</Text>
                    {course?.title && (
                        <Text style={[s.sheetCourseName, { color: t.textMuted }]}>{course.title}</Text>
                    )}
                    <Text style={[s.sheetDate, { color: t.textSubtle }]}>❤️ {fullDate}</Text>
                    <View style={s.pageIndicator}>
                        <View style={[s.pageDot, pageIndex === 0 && s.pageDotActive]} />
                        <View style={[s.pageDot, pageIndex === 1 && s.pageDotActive]} />
                    </View>
                </View>

                {/* 스크롤 콘텐츠 */}
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={s.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {pageIndex === 0 ? (
                        /* 페이지 0: 사진 업로드 */
                        <View>
                            <Text style={[s.label, { color: t.text }]}>📸 우리의 순간들</Text>
                            {uploading && (
                                <View style={s.uploadingRow}>
                                    <ActivityIndicator size="small" color={Colors.brandGreen} />
                                    <Text style={[s.uploadingText, { color: t.textMuted }]}>  업로드 중...</Text>
                                </View>
                            )}
                            <View style={s.photoGrid}>
                                {localUris.map((uri, i) => (
                                    <View key={i} style={s.photoItem}>
                                        <Image source={{ uri }} style={s.photoImg} resizeMode="cover" />
                                        <TouchableOpacity style={s.photoRemove} onPress={() => removePhoto(i)}>
                                            <Ionicons name="close-circle" size={22} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {localUris.length < MAX_PHOTOS && (
                                    <TouchableOpacity
                                        style={[s.photoAdd, { borderColor: t.border, backgroundColor: t.surface }]}
                                        onPress={handlePickPhotos}
                                    >
                                        <Ionicons name="add" size={32} color={t.textMuted} />
                                        <Text style={[s.photoAddText, { color: t.textMuted }]}>
                                            {localUris.length}/{MAX_PHOTOS}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    ) : (
                        /* 페이지 1: 태그 + 별점 + 설명 */
                        <View>
                            <Text style={[s.sectionTitle, { color: t.text }]}>오늘 데이트 어땠어요?</Text>
                            <View style={s.ratingRow}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <TouchableOpacity
                                        key={star}
                                        onPress={() => setRating(star)}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Text
                                            style={[
                                                s.ratingStar,
                                                { color: star <= rating ? "#f59e0b" : t.isDark ? "#374151" : "#e5e7eb" },
                                            ]}
                                        >
                                            ★
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                                <Text style={[s.ratingCount, { color: t.textMuted }]}>{rating} / 5</Text>
                            </View>

                            <Text style={[s.label, { color: t.text }]}>태그 선택</Text>
                            <View style={s.tagsWrap}>
                                {SUGGESTED_TAGS.map((tag) => {
                                    const active = selectedTags.includes(tag);
                                    return (
                                        <TouchableOpacity
                                            key={tag}
                                            style={[s.tag, active && s.tagActive]}
                                            onPress={() => toggleTag(tag)}
                                        >
                                            <Text style={[s.tagText, active && s.tagTextActive]}>#{tag}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {selectedTags.length > 0 && (
                                <View style={s.selectedTagsWrap}>
                                    {selectedTags.map((tag) => (
                                        <TouchableOpacity key={tag} style={s.selectedTag} onPress={() => removeTag(tag)}>
                                            <Text style={s.selectedTagText}>#{tag}</Text>
                                            {tag !== "DoNa" && (
                                                <Ionicons name="close" size={12} color="#059669" style={{ marginLeft: 3 }} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            <View style={[s.tagInputRow, { borderColor: t.border, backgroundColor: t.surface }]}>
                                <TextInput
                                    value={tagInput}
                                    onChangeText={setTagInput}
                                    placeholder="태그 직접 입력 (최대 10자)"
                                    placeholderTextColor={t.textSubtle}
                                    style={[s.tagInputField, { color: t.text }]}
                                    maxLength={10}
                                    returnKeyType="done"
                                    onSubmitEditing={addCustomTag}
                                />
                                <TouchableOpacity onPress={addCustomTag} style={s.tagInputBtn}>
                                    <Text style={s.tagInputBtnText}>추가</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={[s.label, { color: t.text }]}>한 줄 추억</Text>
                            <TextInput
                                value={description}
                                onChangeText={setDescription}
                                placeholder="오늘 데이트를 한 줄로 기록해요 (선택)"
                                placeholderTextColor={t.textSubtle}
                                multiline
                                maxLength={MAX_DESC}
                                style={[s.descInput, { color: t.text, borderColor: t.border, backgroundColor: t.surface }]}
                                textAlignVertical="top"
                            />
                            <Text style={[s.charCount, { color: t.textSubtle }]}>
                                {description.length} / {MAX_DESC}
                            </Text>
                        </View>
                    )}
                </ScrollView>

                {/* 하단 버튼 */}
                <View style={[s.footer, { borderTopColor: t.border }]}>
                    {pageIndex === 0 ? (
                        <TouchableOpacity
                            style={[s.primaryBtn, (localUris.length === 0 || uploading) && s.btnDisabled]}
                            onPress={handleNext}
                            disabled={localUris.length === 0 || uploading}
                        >
                            {uploading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={s.primaryBtnText}>다음 →</Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View style={s.footerRow}>
                            <TouchableOpacity
                                style={s.backBtn}
                                onPress={() => setPageIndex(0)}
                            >
                                <Ionicons name="chevron-back" size={20} color={t.text} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.primaryBtn, s.primaryBtnFlex, submitting && s.btnDisabled]}
                                onPress={handleSubmit}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={s.primaryBtnText}>추억 저장하기 ✨</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    gradientFallback: { backgroundColor: "#e0e7ff" },
    dimOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
    dimOverlayLight: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.2)" },

    // 닫기
    closeWrap: { position: "absolute", right: 16, zIndex: 20 },
    closeBtn: {
        width: 32, height: 32,
        alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.85)",
        borderRadius: 16,
    },
    closeBtnText: { fontSize: 14, color: "#374151", fontWeight: "600" },

    // 인트로
    introCardWrap: { flex: 1, justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 24 },
    introCard: {
        borderRadius: 24, padding: 32, width: "100%", alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.92)",
        shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
    },
    introTitle: { fontSize: 22, fontWeight: "800", color: "#111827", textAlign: "center", marginBottom: 8, letterSpacing: -0.3 },
    introDate: { fontSize: 16, color: "#4b5563", marginTop: 4 },
    introHint: { fontSize: 13, color: "#9ca3af", marginTop: 24 },

    // 하단 시트
    bottomSheet: {
        position: "absolute",
        left: 0, right: 0,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        borderWidth: StyleSheet.hairlineWidth,
        maxHeight: SCREEN_HEIGHT * 0.65,
        minHeight: SCREEN_HEIGHT * 0.5,
        shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: -5 },
        elevation: 12,
        overflow: "hidden",
        flex: 0,
    },
    sheetHeader: {
        paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sheetTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3, marginBottom: 2 },
    sheetCourseName: { fontSize: 12, marginBottom: 4 },
    sheetDate: { fontSize: 13 },
    pageIndicator: { flexDirection: "row", gap: 6, marginTop: 10 },
    pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#d1d5db" },
    pageDotActive: { width: 20, backgroundColor: Colors.brandGreen },

    scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },

    // 사진
    label: { fontSize: 13, fontWeight: "700", marginBottom: 10 },
    uploadingRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    uploadingText: { fontSize: 12 },
    photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    photoItem: { width: "31%", aspectRatio: 1, position: "relative" },
    photoImg: { width: "100%", height: "100%", borderRadius: 10 },
    photoRemove: {
        position: "absolute", top: 4, right: 4,
        backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 12,
    },
    photoAdd: {
        width: "31%", aspectRatio: 1, borderRadius: 10,
        borderWidth: 1.5, borderStyle: "dashed",
        alignItems: "center", justifyContent: "center", gap: 4,
    },
    photoAddText: { fontSize: 11, fontWeight: "600" },

    // 별점 & 태그
    sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12, letterSpacing: -0.3 },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
    ratingStar: { fontSize: 28 },
    ratingCount: { fontSize: 13, fontWeight: "600", marginLeft: 4 },
    tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
    tag: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#e5e7eb" },
    tagActive: { backgroundColor: "#d1fae5", borderColor: "#6ee7b7" },
    tagText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
    tagTextActive: { color: "#059669" },
    selectedTagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
    selectedTag: {
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
        backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0",
    },
    selectedTagText: { fontSize: 12, fontWeight: "700", color: "#059669" },
    tagInputRow: {
        flexDirection: "row", alignItems: "center",
        borderWidth: 1, borderRadius: 10, paddingLeft: 12, paddingRight: 4, marginBottom: 16, height: 44,
    },
    tagInputField: { flex: 1, fontSize: 14 },
    tagInputBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.brandGreen, borderRadius: 8 },
    tagInputBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    descInput: { borderWidth: 1, borderRadius: 12, minHeight: 100, padding: 12, fontSize: 14, marginBottom: 4 },
    charCount: { fontSize: 12, textAlign: "right", marginBottom: 16 },

    // 버튼
    footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth },
    footerRow: { flexDirection: "row", gap: 10, alignItems: "center" },
    backBtn: {
        width: 44, height: 44, borderRadius: 12,
        alignItems: "center", justifyContent: "center",
        backgroundColor: "#f3f4f6",
    },
    primaryBtn: { backgroundColor: Colors.brandGreen, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    primaryBtnFlex: { flex: 1 },
    primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    btnDisabled: { opacity: 0.5 },

    // 성공 모달
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
    successCard: { borderRadius: 24, padding: 32, width: "100%", alignItems: "center" },
    successEmoji: { fontSize: 56, marginBottom: 16 },
    successTitle: { fontSize: 22, fontWeight: "800", marginBottom: 8, letterSpacing: -0.3 },
    successSub: { fontSize: 14, marginBottom: 28, textAlign: "center" },
    successBtn: { borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
    successBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
