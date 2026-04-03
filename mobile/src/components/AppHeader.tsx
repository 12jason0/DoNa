/**
 * 앱 공통 헤더
 * 웹 src/components/Header.tsx 기반
 * — "DoNa" 로고 (좌) + 검색/알림/설정 아이콘 (우)
 */
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAppSettings } from "../context/AppSettingsContext";

type Props = {
    onSearchPress?: () => void;
    onBellPress?: () => void;
    onSettingsPress?: () => void;
    /** 웹 Header와 동일: 찜이 있을 때 알림 아이콘 뱃지 */
    showBellBadge?: boolean;
};

export default function AppHeader({ onSearchPress, onBellPress, onSettingsPress, showBellBadge }: Props) {
    const { theme } = useAppSettings();
    const isDark = theme === "dark";

    return (
        <View style={[styles.header, isDark && styles.headerDark]}>
            {/* 로고 */}
            <TouchableOpacity onPress={() => router.push("/(tabs)")} activeOpacity={0.7}>
                <Text style={[styles.logo, isDark && styles.logoDark]}>DoNa</Text>
            </TouchableOpacity>

            {/* 우측 아이콘 3개 */}
            <View style={styles.right}>
                <TouchableOpacity style={styles.iconBtn} onPress={onSearchPress} activeOpacity={0.7}>
                    <Ionicons name="search-outline" size={20} color={isDark ? "#e5e7eb" : "#374151"} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.iconBtn} onPress={onBellPress} activeOpacity={0.7}>
                    <View style={styles.bellWrap}>
                        <Ionicons name="notifications-outline" size={20} color={isDark ? "#e5e7eb" : "#374151"} />
                        {showBellBadge ? <View style={styles.bellDot} /> : null}
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={onSettingsPress ?? (() => router.push("/(tabs)/mypage"))}
                    activeOpacity={0.7}
                >
                    <Ionicons name="settings-outline" size={20} color={isDark ? "#e5e7eb" : "#374151"} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        height: 48,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingBottom: 6,
        backgroundColor: "#ffffff",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#f3f4f6",
    },
    headerDark: {
        backgroundColor: "#1a241b",
        borderBottomColor: "#374151",
    },
    logo: {
        fontSize: 18,
        fontWeight: "500",
        fontFamily: "Cafe24Dongdong",
        color: "#111827",
        letterSpacing: -0.3,
        minWidth: 60,
    },
    logoDark: {
        color: "#fff",
    },
    right: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
    },
    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    bellWrap: {
        width: 22,
        height: 22,
        alignItems: "center",
        justifyContent: "center",
    },
    bellDot: {
        position: "absolute",
        top: 0,
        right: 0,
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: "#ef4444",
        borderWidth: 1.5,
        borderColor: "#fff",
    },
});
