import React, { useState, useMemo, useEffect } from "react";
import {
    View, Text, Modal, Pressable, TouchableOpacity, StyleSheet,
    ScrollView, TextInput, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useThemeColors } from "../hooks/useThemeColors";
import { useLocale } from "../lib/useLocale";
import { useModal } from "../lib/modalContext";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { MODAL_ANDROID_PROPS } from "../constants/modalAndroidProps";

export default function ProfileEditModal() {
    const { isOpen, closeModal } = useModal();
    const visible = isOpen("profileEdit");
    const t = useThemeColors();
    const { t: i18n } = useLocale();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const [form, setForm] = useState({ nickname: "", mbti: "", ageRange: "", gender: "" });
    const [editError, setEditError] = useState("");

    // 모달이 열릴 때 현재 프로필로 초기화
    useEffect(() => {
        if (visible && user) {
            setForm({
                nickname: (user as any).nickname ?? "",
                mbti: (user as any).mbti ?? "",
                ageRange: (user as any).ageRange ?? "",
                gender: (user as any).gender ?? "",
            });
            setEditError("");
        }
    }, [visible, user]);

    const MBTI_LIST = ["INTJ","INTP","ENTJ","ENTP","INFJ","INFP","ENFJ","ENFP","ISTJ","ISFJ","ESTJ","ESFJ","ISTP","ISFP","ESTP","ESFP"] as const;

    const AGE_RANGE_OPTIONS = useMemo(() => [
        { value: "10대", label: i18n("mypage.age10s") },
        { value: "20대", label: i18n("mypage.age20s") },
        { value: "30대", label: i18n("mypage.age30s") },
        { value: "40대", label: i18n("mypage.age40s") },
        { value: "50대 이상", label: i18n("mypage.age50s") },
    ] as const, [i18n]);

    const GENDERS = useMemo(() => [
        { label: i18n("mypage.genderMale"), value: "M" },
        { label: i18n("mypage.genderFemale"), value: "F" },
    ] as const, [i18n]);

    const editMutation = useMutation({
        mutationFn: (data: typeof form) => api.patch("/api/users/profile", data),
        onSuccess: () => {
            closeModal("profileEdit");
            queryClient.invalidateQueries({ queryKey: ["users", "profile"] });
        },
        onError: (e: any) => setEditError(e.message || i18n("mypage.profileEditFailed")),
    });

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={() => closeModal("profileEdit")}
            {...MODAL_ANDROID_PROPS}
        >
            <Pressable style={s.backdrop} onPress={() => closeModal("profileEdit")}>
                <Pressable style={[s.sheet, { backgroundColor: t.isDark ? "#1a241b" : "#fff" }]} onPress={(e) => e.stopPropagation()}>
                    <View style={s.handleWrap}>
                        <View style={[s.handleBar, { backgroundColor: t.isDark ? "#4b5563" : "#d1d5db" }]} />
                    </View>
                    <View style={s.headerRow}>
                        <Text style={[s.title, { color: t.text }]}>{i18n("mypage.profileTab.editModalTitle")}</Text>
                        <TouchableOpacity onPress={() => closeModal("profileEdit")} hitSlop={12}>
                            <Ionicons name="close" size={22} color={t.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        contentContainerStyle={[s.scrollContent, { paddingBottom: Math.max(40, insets.bottom + 16) }]}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {!!editError && (
                            <View style={s.errorBox}>
                                <Text style={s.errorText}>{editError}</Text>
                            </View>
                        )}

                        {/* 닉네임 */}
                        <View style={s.field}>
                            <Text style={[s.label, { color: t.textMuted }]}>{i18n("mypage.nickname")}</Text>
                            <TextInput
                                style={[s.input, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
                                value={form.nickname}
                                onChangeText={(v) => setForm((p) => ({ ...p, nickname: v }))}
                                placeholder={i18n("mypage.profileTab.nicknamePlaceholderShort")}
                                placeholderTextColor={t.textMuted}
                            />
                        </View>

                        {/* MBTI */}
                        <View style={s.field}>
                            <Text style={[s.label, { color: t.textMuted }]}>{i18n("mypage.mbtiLabel")}</Text>
                            <View style={s.chipsWrap}>
                                {MBTI_LIST.map((m) => {
                                    const sel = form.mbti === m;
                                    return (
                                        <TouchableOpacity
                                            key={m}
                                            onPress={() => setForm((p) => ({ ...p, mbti: sel ? "" : m }))}
                                            style={[s.chip, sel ? { backgroundColor: "#111827", borderColor: "#111827" } : { backgroundColor: t.surface, borderColor: t.border }]}
                                        >
                                            <Text style={[s.chipText, { color: sel ? "#fff" : t.text }]}>{m}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* 연령대 */}
                        <View style={s.field}>
                            <Text style={[s.label, { color: t.textMuted }]}>{i18n("mypage.ageRange")}</Text>
                            <View style={s.chipsWrap}>
                                {AGE_RANGE_OPTIONS.map(({ value: a, label }) => {
                                    const sel = form.ageRange === a;
                                    return (
                                        <TouchableOpacity
                                            key={a}
                                            onPress={() => setForm((p) => ({ ...p, ageRange: sel ? "" : a }))}
                                            style={[s.chip, sel ? { backgroundColor: "#111827", borderColor: "#111827" } : { backgroundColor: t.surface, borderColor: t.border }]}
                                        >
                                            <Text style={[s.chipText, { color: sel ? "#fff" : t.text }]}>{label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* 성별 */}
                        <View style={s.field}>
                            <Text style={[s.label, { color: t.textMuted }]}>{i18n("mypage.gender")}</Text>
                            <View style={s.chipsWrap}>
                                {GENDERS.map(({ label, value }) => {
                                    const sel = form.gender === value;
                                    return (
                                        <TouchableOpacity
                                            key={value}
                                            onPress={() => setForm((p) => ({ ...p, gender: sel ? "" : value }))}
                                            style={[s.chip, sel ? { backgroundColor: "#111827", borderColor: "#111827" } : { backgroundColor: t.surface, borderColor: t.border }]}
                                        >
                                            <Text style={[s.chipText, { color: sel ? "#fff" : t.text }]}>{label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <View style={s.btnRow}>
                            <TouchableOpacity style={[s.cancelBtn, { borderColor: t.border }]} onPress={() => closeModal("profileEdit")}>
                                <Text style={[{ fontSize: 15, fontWeight: "500" }, { color: t.text }]}>{i18n("common.cancel")}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.saveBtn, editMutation.isPending && { opacity: 0.5 }]}
                                onPress={() => editMutation.mutate(form)}
                                disabled={editMutation.isPending}
                            >
                                {editMutation.isPending
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={{ fontSize: 15, fontWeight: "500", color: "#fff" }}>{i18n("common.save")}</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const s = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "82%" },
    handleWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 2 },
    handleBar: { width: 40, height: 4, borderRadius: 2 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 16 },
    title: { fontSize: 22, fontWeight: "600", letterSpacing: -0.4 },
    scrollContent: { paddingHorizontal: 24 },
    errorBox: { backgroundColor: "#fef2f2", borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#fecaca" },
    errorText: { fontSize: 13, color: "#dc2626" },
    field: { marginBottom: 20 },
    label: { fontSize: 13, fontWeight: "500", marginBottom: 10 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
    chipText: { fontSize: 13, fontWeight: "500" },
    btnRow: { flexDirection: "row", gap: 12, marginTop: 8 },
    cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
    saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#111827", alignItems: "center" },
});
