import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { TouchableOpacity } from "react-native";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { useLocale } from "../src/lib/useLocale";
import { FontSize, Spacing } from "../src/constants/theme";

export default function ShopScreen() {
    const t = useThemeColors();
    const { t: i18n } = useLocale();
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
            <View style={[styles.header, { borderBottomColor: t.border }]}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Text style={[styles.backBtn, { color: t.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: t.text }]}>{i18n("mobile.shop.headerTitle")}</Text>
                <View style={{ width: 32 }} />
            </View>

            <View style={styles.body}>
                <Text style={styles.icon}>🛍️</Text>
                <Text style={[styles.title, { color: t.text }]}>{i18n("mobile.shop.heroTitle")}</Text>
                <Text style={[styles.sub, { color: t.textMuted }]}>{i18n("mobile.shop.comingSoon")}</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: Spacing[4],
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backBtn: { fontSize: 22, fontWeight: "500" },
    headerTitle: { fontSize: FontSize.lg, fontWeight: "600", letterSpacing: -0.3 },
    body: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: Spacing[4],
        gap: 12,
    },
    icon: { fontSize: 56 },
    title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
    sub: { fontSize: FontSize.sm, textAlign: "center", lineHeight: 22 },
});
