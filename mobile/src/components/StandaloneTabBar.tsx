/**
 * AppTabBar와 동일한 디자인 — Stack 화면(로그인/회원가입 등)에서 사용
 * expo-router의 router.push로 탭 전환
 */
import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColors } from "../hooks/useThemeColors";
import { useAuth } from "../hooks/useAuth";
import PersonalizedHomeNavIcon from "./icons/PersonalizedHomeNavIcon";

type TabConfig = {
    name: string;
    route: string;
    activeIcon: React.ComponentProps<typeof Ionicons>["name"] | null;
    inactiveIcon: React.ComponentProps<typeof Ionicons>["name"] | null;
};

const TABS: TabConfig[] = [
    { name: "index",   route: "/(tabs)",          activeIcon: "home",      inactiveIcon: "home-outline" },
    { name: "courses", route: "/(tabs)/courses",   activeIcon: "map",       inactiveIcon: "map-outline" },
    { name: "explore", route: "/(tabs)/explore",   activeIcon: "location",  inactiveIcon: "location-outline" },
    { name: "ai",      route: "/(tabs)/ai",        activeIcon: null,        inactiveIcon: null },
    { name: "mypage",  route: "/(tabs)/mypage",    activeIcon: "person",    inactiveIcon: "person-outline" },
];

const ACTIVE_COLOR = "#059669";
const INACTIVE_COLOR = "#6b7280";

export default function StandaloneTabBar() {
    const t = useThemeColors();
    const insets = useSafeAreaInsets();
    const pathname = usePathname();
    const { isAuthenticated } = useAuth();

    function handlePress(tab: TabConfig) {
        if (tab.name === "mypage" && !isAuthenticated) {
            router.push("/(auth)/login" as any);
            return;
        }
        router.push(tab.route as any);
    }

    return (
        <View style={[styles.wrapper, { paddingBottom: insets.bottom + 8 }]}>
            <View style={[styles.pill, { borderColor: t.border }]}>
                {TABS.map((tab) => {
                    const isFocused = pathname === tab.route || (tab.name === "index" && pathname === "/");

                    return (
                        <TouchableOpacity
                            key={tab.name}
                            onPress={() => handlePress(tab)}
                            activeOpacity={0.75}
                            style={styles.tabItem}
                        >
                            <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                                {tab.name === "ai" ? (
                                    <PersonalizedHomeNavIcon
                                        color={isFocused ? ACTIVE_COLOR : INACTIVE_COLOR}
                                        size={20}
                                    />
                                ) : (
                                    <Ionicons
                                        name={isFocused ? tab.activeIcon! : tab.inactiveIcon!}
                                        size={20}
                                        color={isFocused ? ACTIVE_COLOR : INACTIVE_COLOR}
                                    />
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 8,
        backgroundColor: "transparent",
    },
    pill: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.82)",
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 4,
        width: "100%",
        maxWidth: 400,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 12,
        borderWidth: 1,
        borderColor: "rgba(243,244,246,0.8)",
    },
    tabItem: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    iconWrap: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
    },
    iconWrapActive: {
        backgroundColor: "rgba(16, 185, 129, 0.12)",
    },
});
