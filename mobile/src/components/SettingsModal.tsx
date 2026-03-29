/**
 * 웹 Header 설정 모달과 동일: 언어(4종) + 라이트/다크 테마
 */
import React from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    TouchableOpacity,
    ScrollView,
    useWindowDimensions,
    Animated,
    Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useSlideModalAnimation } from "../hooks/useSlideModalAnimation";
import { useAppSettings } from "../context/AppSettingsContext";
import { useThemeColors } from "../hooks/useThemeColors";
import { modalBottomPadding } from "../utils/modalSafePadding";
import { MODAL_ANDROID_PROPS } from "../constants/modalAndroidProps";
import type { LocalePreference } from "../lib/appSettingsStorage";

const COPY = {
    title: "설정",
    languageLabel: "언어",
    themeLabel: "테마",
    light: "라이트",
    dark: "다크",
    locales: {
        ko: "한국어",
        en: "English",
        ja: "日本語",
        zh: "中文",
    } satisfies Record<LocalePreference, string>,
};

type Props = {
    visible: boolean;
    onClose: () => void;
};

const LOCALES: LocalePreference[] = ["ko", "en", "ja", "zh"];

export default function SettingsModal({ visible, onClose }: Props) {
    const t = useThemeColors();
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const maxH = Math.min(height * 0.85, height - insets.top - 24);
    const { rendered, translateY, backdropOpacity } = useSlideModalAnimation(visible);
    const { theme, setTheme, locale, setLocale } = useAppSettings();

    const bottomPad = modalBottomPadding(insets.bottom);

    const pickLocale = (l: LocalePreference) => {
        setLocale(l);
        onClose();
    };

    const pickTheme = (themeVal: "light" | "dark") => {
        setTheme(themeVal);
        onClose();
    };

    if (!rendered) return null;

    const isDarkSheet = theme === "dark";

    return (
        <Modal
            visible={rendered}
            transparent
            animationType="none"
            onRequestClose={onClose}
            {...MODAL_ANDROID_PROPS}
        >
            <View style={styles.root}>
                <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                </Animated.View>
                <Animated.View
                    style={[
                        styles.sheetWrap,
                        {
                            transform: [{ translateY }],
                            maxHeight: maxH,
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.sheet,
                            { backgroundColor: t.card, borderColor: t.border },
                            { paddingBottom: bottomPad },
                        ]}
                    >
                        <View style={[styles.headRow, { borderBottomColor: t.border }]}>
                            <Text style={[styles.headTitle, { color: t.text }]}>{COPY.title}</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
                                <Ionicons name="close" size={22} color={t.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.scrollInner}
                        >
                            <Text style={[styles.sectionLabel, { color: t.textMuted }]}>
                                {COPY.languageLabel}
                            </Text>
                            <View style={styles.langGrid}>
                                {LOCALES.map((loc) => {
                                    const active = locale === loc;
                                    return (
                                        <TouchableOpacity
                                            key={loc}
                                            style={[
                                                styles.langChip,
                                                { borderColor: t.border, backgroundColor: t.surface },
                                                active && styles.langChipActive,
                                                active && isDarkSheet && styles.langChipActiveDark,
                                            ]}
                                            onPress={() => pickLocale(loc)}
                                            activeOpacity={0.85}
                                        >
                                            <Text
                                                style={[
                                                    styles.langChipText,
                                                    { color: t.textMuted },
                                                    active && styles.langChipTextActive,
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {COPY.locales[loc]}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={[styles.sectionLabel, styles.themeSection, { color: t.textMuted }]}>
                                {COPY.themeLabel}
                            </Text>
                            <View style={styles.themeRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.themeBtn,
                                        { borderColor: t.border, backgroundColor: t.surface },
                                        theme === "light" && styles.themeBtnActive,
                                    ]}
                                    onPress={() => pickTheme("light")}
                                    activeOpacity={0.88}
                                >
                                    <Ionicons
                                        name="sunny-outline"
                                        size={22}
                                        color={theme === "light" ? "#059669" : t.textMuted}
                                    />
                                    <Text
                                        style={[
                                            styles.themeBtnText,
                                            { color: t.textMuted },
                                            theme === "light" && styles.themeBtnTextActive,
                                        ]}
                                    >
                                        {COPY.light}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.themeBtn,
                                        { borderColor: t.border, backgroundColor: t.surface },
                                        theme === "dark" && styles.themeBtnActive,
                                    ]}
                                    onPress={() => pickTheme("dark")}
                                    activeOpacity={0.88}
                                >
                                    <Ionicons
                                        name="moon-outline"
                                        size={22}
                                        color={theme === "dark" ? "#059669" : t.textMuted}
                                    />
                                    <Text
                                        style={[
                                            styles.themeBtnText,
                                            { color: t.textMuted },
                                            theme === "dark" && styles.themeBtnTextActive,
                                        ]}
                                    >
                                        {COPY.dark}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        justifyContent: "flex-end",
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.55)",
    },
    sheetWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
    },
    sheet: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderTopWidth: Platform.OS === "ios" ? StyleSheet.hairlineWidth : 0,
        borderColor: "#f3f4f6",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 16,
        maxHeight: "100%",
    },
    sheetDark: {
        backgroundColor: "#1a241b",
        borderColor: "#374151",
    },
    headRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#f3f4f6",
    },
    borderMuted: {
        borderBottomColor: "#374151",
    },
    headTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#111827",
    },
    textLight: {
        color: "#fff",
    },
    subtextLight: {
        color: "#9ca3af",
    },
    textMutedLight: {
        color: "#9ca3af",
    },
    closeBtn: {
        padding: 4,
    },
    scrollInner: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: "600",
        color: "#6b7280",
        marginBottom: 10,
    },
    themeSection: {
        marginTop: 20,
    },
    langGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    langChip: {
        width: "48%",
        flexGrow: 1,
        minWidth: "45%",
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: "#e5e7eb",
        alignItems: "center",
        justifyContent: "center",
    },
    langChipDark: {
        borderColor: "#4b5563",
        backgroundColor: "#111827",
    },
    langChipActive: {
        borderColor: "#059669",
        backgroundColor: "#ecfdf5",
    },
    langChipActiveDark: {
        backgroundColor: "rgba(5, 150, 105, 0.2)",
    },
    langChipText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#4b5563",
    },
    langChipTextActive: {
        color: "#047857",
    },
    themeRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 8,
    },
    themeBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: "#e5e7eb",
    },
    themeBtnDark: {
        borderColor: "#4b5563",
        backgroundColor: "#111827",
    },
    themeBtnActive: {
        borderColor: "#059669",
        backgroundColor: "#ecfdf5",
    },
    themeBtnText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#4b5563",
    },
    themeBtnTextActive: {
        color: "#047857",
    },
});
