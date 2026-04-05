/**
 * 장소 제보 안내 바텀시트 — 웹 SuggestNotificationModal.tsx 와 동일
 */
import React from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    Pressable,
    StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useLocale } from "../lib/useLocale";
import { useThemeColors } from "../hooks/useThemeColors";
import { useModal } from "../lib/modalContext";

const STATUS_DOT: Record<string, string> = {
    PENDING: "#f59e0b",
    PUBLISHED: "#10b981",
    REJECTED: "#94a3b8",
};

export default function SuggestNotificationModal() {
    const { isOpen, closeModal } = useModal();
    const visible = isOpen("suggestNotification");
    const onClose = () => closeModal("suggestNotification");
    const { t } = useLocale();
    const tc = useThemeColors();
    const insets = useSafeAreaInsets();

    const handleSuggest = () => {
        onClose();
        router.push("/suggest" as any);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
            navigationBarTranslucent
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: tc.card,
                            paddingBottom: Math.max(insets.bottom, 16) + 8,
                        },
                    ]}
                    onPress={(e) => e.stopPropagation()}
                >
                    {/* 핸들 */}
                    <View style={[styles.handle, { backgroundColor: tc.border }]} />

                    {/* 닫기 버튼 */}
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
                        <Ionicons name="close" size={18} color={tc.textMuted} />
                    </TouchableOpacity>

                    {/* 타이틀 */}
                    <View style={styles.titleBlock}>
                        <Text style={styles.emoji}>📍</Text>
                        <Text style={[styles.title, { color: tc.text }]}>{t("suggest.pageTitle")}</Text>
                        <Text style={[styles.subtitle, { color: tc.textMuted }]}>{t("suggest.pageSubtitle")}</Text>
                    </View>

                    {/* 상태 안내 */}
                    <View style={[styles.statusBox, { backgroundColor: tc.surface ?? tc.background }]}>
                        {(["PENDING", "PUBLISHED", "REJECTED"] as const).map((status) => (
                            <View key={status} style={styles.statusRow}>
                                <View style={[styles.statusDot, { backgroundColor: STATUS_DOT[status] }]} />
                                <Text style={[styles.statusText, { color: tc.text }]}>
                                    <Text style={styles.statusLabel}>{t(`home.myReportedCourses.status.${status}`)}</Text>
                                    {" — "}
                                    {t(`suggest.modalStatusHint.${status}`)}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* CTA */}
                    <TouchableOpacity style={styles.ctaBtn} onPress={handleSuggest} activeOpacity={0.88}>
                        <Text style={styles.ctaBtnText}>{t("home.myReportedCourses.suggestBtn")}</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "flex-end",
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 12,
        paddingHorizontal: 24,
        gap: 16,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: "center",
        marginBottom: 4,
    },
    closeBtn: {
        position: "absolute",
        top: 14,
        right: 16,
        padding: 6,
    },
    titleBlock: {
        alignItems: "center",
        gap: 6,
        paddingTop: 8,
    },
    emoji: {
        fontSize: 36,
    },
    title: {
        fontSize: 17,
        fontWeight: "700",
        textAlign: "center",
    },
    subtitle: {
        fontSize: 13,
        textAlign: "center",
        lineHeight: 19,
    },
    statusBox: {
        borderRadius: 14,
        padding: 16,
        gap: 10,
    },
    statusRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 4,
        flexShrink: 0,
    },
    statusText: {
        fontSize: 12,
        lineHeight: 18,
        flex: 1,
    },
    statusLabel: {
        fontWeight: "700",
    },
    ctaBtn: {
        backgroundColor: "#7FCC9F",
        borderRadius: 16,
        paddingVertical: 15,
        alignItems: "center",
    },
    ctaBtnText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "700",
    },
});
