import React from "react";
import { View, Text, Modal, Pressable, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useThemeColors } from "../hooks/useThemeColors";
import { useLocale } from "../lib/useLocale";
import { useModal } from "../lib/modalContext";
import { MODAL_ANDROID_PROPS } from "../constants/modalAndroidProps";

export default function MemoryLimitModal() {
    const { isOpen, closeModal } = useModal();
    const visible = isOpen("memoryLimit");
    const t = useThemeColors();
    const { t: i18n } = useLocale();
    const insets = useSafeAreaInsets();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={() => closeModal("memoryLimit")}
            {...MODAL_ANDROID_PROPS}
        >
            <Pressable style={s.overlay} onPress={() => closeModal("memoryLimit")}>
                <Pressable
                    style={[s.sheet, { backgroundColor: t.card, paddingBottom: Math.max(44, insets.bottom + 12) }]}
                    onPress={(e) => e.stopPropagation()}
                >
                    <TouchableOpacity
                        style={[s.closeBtn, { backgroundColor: t.surface }]}
                        onPress={() => closeModal("memoryLimit")}
                    >
                        <Ionicons name="close" size={16} color={t.textMuted} />
                    </TouchableOpacity>

                    <View style={s.iconWrap}>
                        <View style={[s.iconPulse, { backgroundColor: "#7c3aed" }]} />
                        <View style={[s.iconBox, { backgroundColor: "#7c3aed", shadowColor: "#7c3aed" }]}>
                            <Ionicons name="lock-closed" size={30} color="#fff" />
                        </View>
                    </View>

                    <Text style={[s.title, { color: t.text }]}>
                        {i18n("mobile.courseScreen.memoryLimitTitleLine1")}
                        {"\n"}
                        <Text style={{ color: "#7c3aed" }}>{i18n("mobile.courseScreen.memoryLimitHighlight")}</Text>
                    </Text>
                    <Text style={[s.sub, { color: t.textMuted }]}>{i18n("mobile.courseScreen.memoryLimitSub")}</Text>

                    <View style={[s.benefitBox, { backgroundColor: t.surface, borderColor: t.border }]}>
                        <Text style={[s.benefitLabel, { color: t.textMuted }]}>{i18n("mobile.courseScreen.subBenefitsTitle")}</Text>
                        {[
                            i18n("mobile.courseScreen.benefitUnlimitedMemories"),
                            i18n("mobile.courseScreen.benefitPremiumCourses"),
                            i18n("mobile.courseScreen.benefitNoAds"),
                        ].map((b, i) => (
                            <View key={i} style={s.benefitRow}>
                                <View style={[s.checkCircle, { backgroundColor: "#ede9fe" }]}>
                                    <Ionicons name="checkmark" size={10} color="#7c3aed" />
                                </View>
                                <Text style={[s.benefitText, { color: t.text }]}>{b}</Text>
                            </View>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={[s.ctaBtn, { backgroundColor: "#7c3aed", shadowColor: "#7c3aed" }]}
                        onPress={() => { closeModal("memoryLimit"); router.push("/shop" as any); }}
                    >
                        <Text style={s.ctaText}>{i18n("mobile.courseScreen.subscribeSaveMore")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.cancelBtn} onPress={() => closeModal("memoryLimit")}>
                        <Text style={s.cancelBtnText}>{i18n("courseStart.close")}</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, position: "relative" },
    closeBtn: { position: "absolute", top: 20, right: 20, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", zIndex: 10 },
    iconWrap: { alignItems: "center", marginBottom: 20, marginTop: 16 },
    iconPulse: { position: "absolute", width: 96, height: 96, borderRadius: 24, opacity: 0.12, transform: [{ rotate: "12deg" }] },
    iconBox: { width: 80, height: 80, borderRadius: 20, alignItems: "center", justifyContent: "center", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, position: "relative" },
    title: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 8, letterSpacing: -0.5, lineHeight: 30 },
    sub: { fontSize: 14, textAlign: "center", marginBottom: 20, lineHeight: 20 },
    benefitBox: { borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1 },
    benefitLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 },
    benefitRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    checkCircle: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    benefitText: { fontSize: 14, fontWeight: "500" },
    ctaBtn: { borderRadius: 999, paddingVertical: 14, alignItems: "center", justifyContent: "center", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
    ctaText: { color: "#fff", fontSize: 15, fontWeight: "500" },
    cancelBtn: { paddingVertical: 12, alignItems: "center" },
    cancelBtnText: { color: "#9ca3af", fontSize: 13 },
});
