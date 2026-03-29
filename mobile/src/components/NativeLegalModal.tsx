/**
 * 마이페이지 푸터 — 서비스 소개 / FAQ / 개인정보 / 이용약관 인앱 네이티브 (웹 페이지와 동일 문구·UI 구조)
 */
import React, { useEffect, useRef } from "react";
import { View, Modal, ScrollView, TouchableOpacity, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useThemeColors } from "../hooks/useThemeColors";
import { useLocale } from "../lib/useLocale";
import { MODAL_ANDROID_PROPS } from "../constants/modalAndroidProps";

import LegalTermsBody from "./legal/LegalTermsBody";
import LegalPrivacyBody from "./legal/LegalPrivacyBody";
import LegalHelpBody from "./legal/LegalHelpBody";
import LegalAboutBody from "./legal/LegalAboutBody";

export type NativeLegalPage = "about" | "help" | "privacy" | "terms";

type Props = {
    page: NativeLegalPage | null;
    onClose: () => void;
};

export default function NativeLegalModal({ page, onClose }: Props) {
    const theme = useThemeColors();
    const { t: tr } = useLocale();
    const visible = page != null;
    const scrollRef = useRef<ScrollView>(null);
    const anchorYs = useRef<Record<string, number>>({});

    useEffect(() => {
        anchorYs.current = {};
        scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [page]);

    const headerTitle =
        page === "about"
            ? "서비스 소개"
            : page === "help"
              ? tr("help.title")
              : page === "privacy"
                ? tr("privacy.title")
                : page === "terms"
                  ? tr("terms.title")
                  : "";

    const needsWideAnchors = page === "terms" || page === "privacy";

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} {...MODAL_ANDROID_PROPS}>
            <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={["top", "bottom"]}>
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerBtn}>
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
                        {headerTitle}
                    </Text>
                    <View style={styles.headerBtn} />
                </View>

                <ScrollView
                    ref={scrollRef}
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator
                >
                    {page === "about" ? (
                        <LegalAboutBody
                            tr={tr}
                            theme={{
                                text: theme.text,
                                textMuted: theme.textMuted,
                                surface: theme.surface,
                                border: theme.border,
                                card: theme.card,
                                isDark: theme.isDark,
                            }}
                        />
                    ) : null}

                    {page === "help" ? (
                        <LegalHelpBody
                            tr={tr}
                            theme={{
                                text: theme.text,
                                textMuted: theme.textMuted,
                                textSubtle: theme.textSubtle,
                                surface: theme.surface,
                                border: theme.border,
                                isDark: theme.isDark,
                            }}
                        />
                    ) : null}

                    {page === "privacy" && needsWideAnchors ? (
                        <LegalPrivacyBody
                            tr={tr}
                            theme={{
                                text: theme.text,
                                textMuted: theme.textMuted,
                                surface: theme.surface,
                                border: theme.border,
                                isDark: theme.isDark,
                            }}
                            scrollRef={scrollRef}
                            anchorYs={anchorYs}
                        />
                    ) : null}

                    {page === "terms" && needsWideAnchors ? (
                        <LegalTermsBody
                            tr={tr}
                            theme={{
                                text: theme.text,
                                textMuted: theme.textMuted,
                                surface: theme.surface,
                                border: theme.border,
                                isDark: theme.isDark,
                            }}
                            scrollRef={scrollRef}
                            anchorYs={anchorYs}
                        />
                    ) : null}

                    <View style={{ height: 32 }} />
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
});
