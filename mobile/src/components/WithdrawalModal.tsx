import React, { useState } from "react";
import {
    View, Text, Modal, Pressable, TouchableOpacity, StyleSheet,
    ScrollView, TextInput, ActivityIndicator, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Purchases from "react-native-purchases";
import { logout } from "../hooks/useAuth";
import { useThemeColors } from "../hooks/useThemeColors";
import { useLocale } from "../lib/useLocale";
import { useModal } from "../lib/modalContext";
import { api } from "../lib/api";
import { MODAL_ANDROID_PROPS } from "../constants/modalAndroidProps";

export default function WithdrawalModal() {
    const { isOpen, closeModal } = useModal();
    const visible = isOpen("withdrawal");
    const t = useThemeColors();
    const { t: i18n } = useLocale();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();

    const [step, setStep] = useState(false);
    const [reason, setReason] = useState("");
    const [etcReason, setEtcReason] = useState("");
    const [agree, setAgree] = useState(false);

    function handleClose() {
        closeModal("withdrawal");
        setStep(false);
        setReason("");
        setEtcReason("");
        setAgree(false);
    }

    const deleteMutation = useMutation({
        mutationFn: (r: string) => api.post("/api/users/withdrawal", { reason: r }),
        onSuccess: async () => {
            try { await Purchases.logOut(); } catch {}
            await logout(queryClient);
            router.replace("/(auth)/login");
        },
        onError: (e: any) => Alert.alert(i18n("mypage.alertErrorTitle"), e.message || i18n("deleteUsersModal.alertError")),
    });

    function handleNextOrSubmit() {
        if (!step) {
            setStep(true);
            return;
        }
        if (!reason) {
            Alert.alert(i18n("mypage.alertInfoTitle"), i18n("deleteUsersModal.alertSelectReason"));
            return;
        }
        if (reason === "reason5" && !etcReason.trim()) {
            Alert.alert(i18n("mypage.alertInfoTitle"), i18n("deleteUsersModal.alertEnterOtherReason"));
            return;
        }
        if (!agree) {
            Alert.alert(i18n("mypage.alertInfoTitle"), i18n("deleteUsersModal.alertAgree"));
            return;
        }
        const r = reason === "reason5" ? etcReason.trim() : reason;
        deleteMutation.mutate(r);
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
            {...MODAL_ANDROID_PROPS}
        >
            <Pressable style={s.dim} onPress={handleClose}>
                <Pressable style={[s.sheet, { backgroundColor: t.isDark ? "#1a241b" : "#fff" }]} onPress={(e) => e.stopPropagation()}>
                    <View style={s.handle} />
                    <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={s.emojiCircle}>
                            <Text style={{ fontSize: 28 }}>🍃</Text>
                        </View>
                        <Text style={[s.title, { color: t.text }]}>{i18n("deleteUsersModal.title")}</Text>

                        <View style={[s.warnCard, { backgroundColor: t.isDark ? "#1e2d1f" : "#f9fafb", borderColor: t.isDark ? "#374151" : "#f3f4f6" }]}>
                            <View style={s.warnRow}>
                                <Text style={s.warnIcon}>⚠️</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.warnTitle, { color: t.text }]}>{i18n("deleteUsersModal.warn1Title")}</Text>
                                    <Text style={[s.warnDesc, { color: t.textMuted }]}>{i18n("deleteUsersModal.warn1Desc")}</Text>
                                </View>
                            </View>
                            <View style={[s.warnRow, { marginTop: 12 }]}>
                                <Text style={s.warnIcon}>⚖️</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.warnTitle, { color: t.text }]}>{i18n("deleteUsersModal.warn2Title")}</Text>
                                    <Text style={[s.warnDesc, { color: t.textMuted }]}>{i18n("deleteUsersModal.warn2Desc")}</Text>
                                    <Text style={[s.warnDesc, { color: t.textMuted }]}>• {i18n("deleteUsersModal.warn2Li1")}</Text>
                                    <Text style={[s.warnDesc, { color: t.textMuted }]}>• {i18n("deleteUsersModal.warn2Li2")}</Text>
                                    <Text style={[s.warnDesc, { color: t.textMuted, marginTop: 2 }]}>{i18n("deleteUsersModal.warn2Footer")}</Text>
                                </View>
                            </View>
                        </View>

                        {step && (
                            <View style={[s.reasonCard, { backgroundColor: t.isDark ? "#1e2d3f" : "#eff6ff", borderColor: t.isDark ? "#1e3a5f" : "#bfdbfe" }]}>
                                <Text style={[s.reasonTitle, { color: t.isDark ? "#93c5fd" : "#1e40af" }]}>{i18n("deleteUsersModal.reasonTitle")}</Text>
                                {(["reason0","reason1","reason2","reason3","reason4","reason5"] as const).map((key) => (
                                    <TouchableOpacity key={key} style={s.reasonRow} onPress={() => setReason(key)} activeOpacity={0.8}>
                                        <View style={[s.radioOuter, reason === key && s.radioOuterOn]}>
                                            {reason === key && <View style={s.radioInner} />}
                                        </View>
                                        <Text style={[s.reasonRowText, { color: t.text }]}>{i18n(`deleteUsersModal.${key}`)}</Text>
                                    </TouchableOpacity>
                                ))}
                                {reason === "reason5" && (
                                    <TextInput
                                        style={[s.etcInput, { backgroundColor: t.card, borderColor: t.isDark ? "#1e3a5f" : "#bfdbfe", color: t.text }]}
                                        placeholder={i18n("deleteUsersModal.reasonOtherPlaceholder")}
                                        placeholderTextColor={t.textMuted}
                                        value={etcReason}
                                        onChangeText={setEtcReason}
                                        multiline
                                    />
                                )}
                                <TouchableOpacity style={[s.agreeRow, { borderTopColor: t.isDark ? "#1e3a5f" : "#bfdbfe" }]} onPress={() => setAgree((v) => !v)} activeOpacity={0.8}>
                                    <View style={[s.checkbox, agree && s.checkboxOn]}>
                                        {agree && <Ionicons name="checkmark" size={12} color="#fff" />}
                                    </View>
                                    <Text style={[s.agreeText, { color: t.textMuted }]}>{i18n("deleteUsersModal.agreeLabel")}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>

                    <View style={[s.btnArea, { paddingBottom: Math.max(insets.bottom, Platform.OS === "android" ? 16 : 8) }]}>
                        <TouchableOpacity style={s.stayBtn} onPress={handleClose} activeOpacity={0.85}>
                            <Text style={s.stayBtnText}>{i18n("deleteUsersModal.stay")}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={s.dangerBtn}
                            onPress={handleNextOrSubmit}
                            disabled={deleteMutation.isPending || (step && !agree)}
                        >
                            {deleteMutation.isPending ? (
                                <ActivityIndicator size="small" color="#ef4444" />
                            ) : (
                                <Text style={[s.dangerBtnText, !step && { color: "#9ca3af" }]}>
                                    {step ? i18n("deleteUsersModal.deleteAccount") : i18n("deleteUsersModal.withdraw")}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const s = StyleSheet.create({
    dim: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    sheet: { width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, elevation: 16 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#d1d5db", alignSelf: "center", marginBottom: 16 },
    scrollContent: { padding: 24, paddingBottom: 16 },
    emojiCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#dcfce7", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 14 },
    title: { fontSize: 18, fontWeight: "600", textAlign: "center", letterSpacing: -0.3, marginBottom: 18 },
    warnCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 12 },
    warnRow: { flexDirection: "row", gap: 10 },
    warnIcon: { fontSize: 18, marginTop: 1 },
    warnTitle: { fontSize: 13, fontWeight: "500", marginBottom: 4 },
    warnDesc: { fontSize: 12, lineHeight: 17 },
    reasonCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 12 },
    reasonTitle: { fontSize: 13, fontWeight: "500", marginBottom: 10 },
    reasonRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
    radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center", marginRight: 9 },
    radioOuterOn: { borderColor: "#10b981" },
    radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10b981" },
    reasonRowText: { fontSize: 13, fontWeight: "500" },
    etcInput: { borderWidth: 1, borderRadius: 10, minHeight: 76, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8, textAlignVertical: "top", fontSize: 13 },
    agreeRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 12, borderTopWidth: 1, paddingTop: 12 },
    checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center", marginRight: 8, marginTop: 1 },
    checkboxOn: { backgroundColor: "#10b981", borderColor: "#10b981" },
    agreeText: { flex: 1, fontSize: 12, lineHeight: 17 },
    btnArea: { flexDirection: "row", gap: 10, paddingHorizontal: 24, paddingTop: 12 },
    stayBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: "#059669", alignItems: "center", justifyContent: "center" },
    stayBtnText: { color: "#fff", fontSize: 15, fontWeight: "500" },
    dangerBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    dangerBtnText: { fontSize: 15, fontWeight: "500", color: "#ef4444" },
});
