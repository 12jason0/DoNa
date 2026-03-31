/**
 * 문의·사업자 정보 — /contact
 */
import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useThemeColors } from "../src/hooks/useThemeColors";
import { useLocale } from "../src/lib/useLocale";

export default function ContactScreen() {
    const t = useThemeColors();
    const { t: i18n } = useLocale();

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]} edges={["top", "left", "right"]}>
            <View style={[styles.header, { borderBottomColor: t.border }]}>
                <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
                    <Ionicons name="chevron-back" size={24} color={t.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: t.text }]} numberOfLines={1}>
                    {i18n("contact.pageTitle")}
                </Text>
                <View style={{ width: 24 }} />
            </View>
            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Text style={[styles.subtitle, { color: t.textMuted }]}>{i18n("contact.pageSubtitle")}</Text>

                <View style={styles.infoCardsColumn}>
                    <View
                        style={[
                            styles.infoCard,
                            { backgroundColor: t.isDark ? "rgba(30, 58, 138, 0.22)" : "#eff6ff" },
                        ]}
                    >
                        <Text style={[styles.infoCardTitle, { color: t.text }]}>{i18n("contact.emailInquiryTitle")}</Text>
                        <Pressable onPress={() => Linking.openURL("mailto:12jason@donacouse.com").catch(() => {})}>
                            <Text style={[styles.infoCardEmail, t.isDark && styles.infoCardEmailDark]}>12jason@donacouse.com</Text>
                        </Pressable>
                    </View>
                    <View
                        style={[
                            styles.infoCard,
                            { backgroundColor: t.isDark ? "rgba(20, 83, 45, 0.22)" : "#f0fdf4" },
                        ]}
                    >
                        <Text style={[styles.infoCardTitle, { color: t.text }]}>{i18n("contact.customerHoursTitle")}</Text>
                        <Text style={[styles.infoCardLine, { color: t.text }]}>{i18n("contact.hoursWeekday")}</Text>
                        <Text style={[styles.infoCardLineMuted, { color: t.textMuted }]}>{i18n("contact.hoursLunch")}</Text>
                    </View>
                </View>

                <Text style={[styles.sectionTitle, { color: t.text }]}>{i18n("mypage.profileTab.businessInfo")}</Text>
                <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
                    <Text style={[styles.lineStrong, { color: t.text }]}>{i18n("mypage.profileTab.businessCompanyName")}</Text>
                    <Text style={[styles.line, { color: t.textMuted }]}>{i18n("mypage.profileTab.businessLineCeoReg")}</Text>
                    <Text style={[styles.line, { color: t.textMuted }]}>{i18n("mypage.profileTab.businessLineMailOrder")}</Text>
                    <Text style={[styles.line, { color: t.textMuted }]}>{i18n("mypage.profileTab.businessLineAddress")}</Text>
                    <Pressable
                        onPress={() => Linking.openURL("mailto:12jason@donacouse.com").catch(() => {})}
                        accessibilityRole="link"
                    >
                        <Text style={[styles.line, { color: t.textMuted }]}>{i18n("mypage.profileTab.businessLineInquiry")}</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => Linking.openURL("tel:01024819824").catch(() => {})}
                        accessibilityRole="link"
                    >
                        <Text style={[styles.line, { color: t.textMuted }]}>
                            {i18n("mypage.profileTab.businessLineCustomerCenter")}
                        </Text>
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
        paddingBottom: 32,
        gap: 16,
    },
    infoCardsColumn: {
        gap: 12,
        marginBottom: 4,
    },
    infoCard: {
        borderRadius: 12,
        padding: 16,
    },
    infoCardTitle: {
        fontSize: 17,
        fontWeight: "600",
        marginBottom: 10,
    },
    infoCardEmail: {
        fontSize: 15,
        fontWeight: "500",
        color: "#2563eb",
    },
    infoCardEmailDark: {
        color: "#93c5fd",
    },
    infoCardLine: {
        fontSize: 15,
        lineHeight: 22,
    },
    infoCardLineMuted: {
        fontSize: 13,
        lineHeight: 20,
        marginTop: 4,
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 21,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: "600",
    },
    card: {
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 16,
        gap: 8,
    },
    lineStrong: {
        fontSize: 14,
        fontWeight: "600",
        lineHeight: 22,
    },
    line: {
        fontSize: 13,
        lineHeight: 21,
    },
});
