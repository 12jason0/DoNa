/**
 * 장소 제보 화면 — 웹 (home)/suggest/page.tsx 와 동일한 흐름
 */
import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    ScrollView,
    Pressable,
    StyleSheet,
    Alert,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useThemeColors } from "../src/hooks/useThemeColors";
import { useLocale } from "../src/lib/useLocale";
import { useAuth } from "../src/hooks/useAuth";
import { apiFetch, ApiError } from "../src/lib/api";

const CONCEPT_KEYS = [
    "healing", "emotional", "romantic", "cafe", "photo",
    "photoSpot", "nightView", "food", "indoor", "outdoor",
    "culture", "unique", "hotPlace", "activity",
] as const;

type ConceptKey = typeof CONCEPT_KEYS[number];

export default function SuggestScreen() {
    const tc = useThemeColors();
    const { t } = useLocale();
    const { isAuthenticated } = useAuth();

    const [placeName, setPlaceName] = useState("");
    const [concept, setConcept] = useState<ConceptKey | "">("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!placeName.trim()) {
            Alert.alert("", t("suggest.validationAlert"));
            return;
        }
        setSubmitting(true);
        try {
            await apiFetch("/api/course-suggestions", {
                method: "POST",
                body: {
                    placeName: placeName.trim(),
                    concept: concept || undefined,
                },
            });
            Alert.alert("", t("suggest.successAlert"), [
                { text: t("common.confirm"), onPress: () => router.back() },
            ]);
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : t("suggest.errorFallback");
            Alert.alert("", msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={[styles.safe, { backgroundColor: tc.bg }]} edges={["top", "left", "right"]}>
                <View style={[styles.header, { borderBottomColor: tc.border }]}>
                    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
                        <Ionicons name="chevron-back" size={24} color={tc.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: tc.text }]} numberOfLines={1}>
                        {t("suggest.pageTitle")}
                    </Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.loginPrompt}>
                    <Text style={[styles.loginText, { color: tc.textMuted }]}>{t("suggest.loginRequired")}</Text>
                    <Pressable
                        onPress={() => router.push("/(auth)/login" as any)}
                        style={[styles.loginBtn, { backgroundColor: "#7FCC9F" }]}
                    >
                        <Text style={styles.loginBtnText}>{t("nav.login")}</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: tc.bg }]} edges={["top", "left", "right"]}>
            <View style={[styles.header, { borderBottomColor: tc.border }]}>
                <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
                    <Ionicons name="chevron-back" size={24} color={tc.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: tc.text }]} numberOfLines={1}>
                    {t("suggest.pageTitle")}
                </Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Text style={[styles.subtitle, { color: tc.textMuted }]}>{t("suggest.pageSubtitle")}</Text>

                {/* 장소 이름 */}
                <View style={[styles.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
                    <Text style={[styles.label, { color: tc.text }]}>
                        {t("suggest.labelPlaceNameSimple")}{" "}
                        <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        value={placeName}
                        onChangeText={setPlaceName}
                        placeholder={t("suggest.placeholderPlaceNameSimple")}
                        placeholderTextColor={tc.textMuted}
                        style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text }]}
                    />
                </View>

                {/* 컨셉 */}
                <View style={[styles.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
                    <Text style={[styles.label, { color: tc.text }]}>{t("suggest.labelConceptSimple")}</Text>
                    <View style={styles.chips}>
                        {CONCEPT_KEYS.map((key) => {
                            const selected = concept === key;
                            return (
                                <Pressable
                                    key={key}
                                    onPress={() => setConcept(selected ? "" : key)}
                                    style={[
                                        styles.chip,
                                        selected
                                            ? { backgroundColor: "#7FCC9F", borderColor: "#7FCC9F" }
                                            : { backgroundColor: tc.card, borderColor: tc.border },
                                    ]}
                                >
                                    <Text style={[styles.chipText, { color: selected ? "#fff" : tc.text }]}>
                                        {t(`courseConcept.${key}`)}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* 버튼 */}
                <View style={styles.btnRow}>
                    <Pressable
                        onPress={() => router.back()}
                        disabled={submitting}
                        style={[styles.btnOutline, { borderColor: tc.border }]}
                    >
                        <Text style={[styles.btnOutlineText, { color: tc.text }]}>{t("suggest.cancel")}</Text>
                    </Pressable>
                    <Pressable
                        onPress={handleSubmit}
                        disabled={submitting || !placeName.trim()}
                        style={[
                            styles.btnPrimary,
                            (submitting || !placeName.trim()) && styles.btnDisabled,
                        ]}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.btnPrimaryText}>{t("suggest.submit")}</Text>
                        )}
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1 },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: {
        flex: 1,
        fontSize: 17,
        fontWeight: "700",
        textAlign: "center",
    },
    scroll: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 40,
        gap: 16,
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 21,
    },
    card: {
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 16,
        gap: 10,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
    },
    required: {
        color: "#f43f5e",
    },
    input: {
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
    },
    chips: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
    },
    chipText: {
        fontSize: 13,
        fontWeight: "500",
    },
    btnRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 4,
    },
    btnOutline: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: "center",
    },
    btnOutlineText: {
        fontSize: 15,
        fontWeight: "600",
    },
    btnPrimary: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: "#7FCC9F",
        alignItems: "center",
    },
    btnPrimaryText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#fff",
    },
    btnDisabled: {
        opacity: 0.5,
    },
    loginPrompt: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        paddingHorizontal: 40,
    },
    loginText: {
        fontSize: 15,
        textAlign: "center",
        lineHeight: 22,
    },
    loginBtn: {
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 14,
    },
    loginBtnText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "700",
    },
});
