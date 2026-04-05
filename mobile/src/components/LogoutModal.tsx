import React from "react";
import { View, Text, Modal, Pressable, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Purchases from "react-native-purchases";
import { logout } from "../hooks/useAuth";
import { useThemeColors } from "../hooks/useThemeColors";
import { useLocale } from "../lib/useLocale";
import { useModal } from "../lib/modalContext";
import { MODAL_ANDROID_PROPS } from "../constants/modalAndroidProps";

export default function LogoutModal() {
    const { isOpen, closeModal } = useModal();
    const visible = isOpen("logout");
    const t = useThemeColors();
    const { t: i18n } = useLocale();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();

    async function handleConfirm() {
        closeModal("logout");
        try {
            const isAnon = await Purchases.isAnonymous();
            if (!isAnon) await Purchases.logOut();
        } catch {}
        await logout(queryClient);
        router.replace("/(auth)/login");
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={() => closeModal("logout")}
            {...MODAL_ANDROID_PROPS}
        >
            <Pressable style={s.dim} onPress={() => closeModal("logout")}>
                <Pressable style={s.wrap} onPress={(e) => e.stopPropagation()}>
                    <View style={[s.sheet, {
                        backgroundColor: t.isDark ? "#1a241b" : "#fff",
                        borderTopColor: t.isDark ? "#1f2937" : "#f3f4f6",
                        paddingBottom: Math.max(insets.bottom, 24),
                    }]}>
                        <View style={s.iconWrap}>
                            <Ionicons name="log-out-outline" size={52} color={t.isDark ? "#6b7280" : "#9ca3af"} />
                        </View>
                        <Text style={[s.title, { color: t.text }]}>{i18n("logoutModal.title")}</Text>
                        <Text style={[s.subtitle, { color: t.textMuted }]}>{i18n("logoutModal.subtitle")}</Text>
                        <View style={s.btnRow}>
                            <TouchableOpacity
                                style={[s.btnGray, { backgroundColor: t.isDark ? "#374151" : "#f3f4f6" }]}
                                onPress={() => closeModal("logout")}
                                activeOpacity={0.8}
                            >
                                <Text style={[s.btnGrayText, { color: t.isDark ? "#d1d5db" : "#374151" }]}>
                                    {i18n("logoutModal.stay")}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.btnDark, { backgroundColor: t.isDark ? "#1e293b" : "#0f172a" }]}
                                onPress={handleConfirm}
                                activeOpacity={0.85}
                            >
                                <Text style={s.btnDarkText}>{i18n("logoutModal.logout")}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const s = StyleSheet.create({
    dim: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    wrap: { width: "100%" },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 32,
        paddingHorizontal: 24,
        borderTopWidth: 1,
    },
    iconWrap: { alignItems: "center", marginBottom: 16 },
    title: { fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 6, letterSpacing: -0.3 },
    subtitle: { fontSize: 13, textAlign: "center", lineHeight: 19, marginBottom: 24 },
    btnRow: { flexDirection: "row", gap: 10 },
    btnGray: { flex: 1, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    btnGrayText: { fontSize: 15, fontWeight: "500" },
    btnDark: { flex: 1, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    btnDarkText: { color: "#fff", fontSize: 15, fontWeight: "500" },
});
