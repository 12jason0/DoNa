/**
 * 커스텀 플로팅 탭바
 * 웹 src/components/Footer.tsx + LayoutContent(+버튼) 과 동일
 * — + 탭 시 웹 SideMenuDrawer 와 같은 사이드 메뉴 (SideMenuSheet)
 */
import React from "react";
import { View, Text, TouchableOpacity, Pressable, StyleSheet, Platform } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import { useThemeColors } from "../hooks/useThemeColors";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../lib/useLocale";
import { useModal } from "../lib/modalContext";
import { textFontForLocale } from "../lib/textDefaultFont";
import PersonalizedHomeNavIcon from "./icons/PersonalizedHomeNavIcon";

type TabConfig = {
    name: string;
    activeIcon: React.ComponentProps<typeof Ionicons>["name"] | null;
    inactiveIcon: React.ComponentProps<typeof Ionicons>["name"] | null;
};

const TABS: TabConfig[] = [
    { name: "index", activeIcon: "home", inactiveIcon: "home-outline" },
    { name: "courses", activeIcon: "map", inactiveIcon: "map-outline" },
    { name: "explore", activeIcon: "location", inactiveIcon: "location-outline" },
    { name: "ai", activeIcon: null, inactiveIcon: null },
    { name: "mypage", activeIcon: "person", inactiveIcon: "person-outline" },
];

const ACTIVE_COLOR = "#059669";
const INACTIVE_COLOR = "#6b7280";

export default function AppTabBar({ state, navigation }: BottomTabBarProps) {
    const t = useThemeColors();
    const insets = useSafeAreaInsets();
    const { isAuthenticated } = useAuth();
    const { t: i18n, locale } = useLocale();
    const { openModal, isOpen } = useModal();
    const sideMenuOpen = isOpen("sideMenu");

    /** 지도 탭: 웹과 동일하게 하단 네비(플로팅 탭바) 숨김 */
    const currentName = state.routes[state.index]?.name;
    if (currentName === "explore") {
        return null;
    }

    const plusBottom = insets.bottom + 8 + 46 + 12;

    return (
        <>
            {/* + 버튼 — 웹과 동일: 메뉴 열릴 때는 숨김 */}
            <View style={[styles.plusArea, { bottom: plusBottom, right: 24 }]} pointerEvents="box-none">
                {!sideMenuOpen ? (
                    <TouchableOpacity
                        style={styles.plusBtn}
                        onPress={() => openModal("sideMenu")}
                        activeOpacity={0.85}
                        accessibilityLabel={i18n("nav.openMenu")}
                    >
                        <Text style={[styles.plusText, textFontForLocale(locale)]}>+</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={[styles.wrapper, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
                <View style={[styles.pill, { borderColor: t.border }]}>
                    {state.routes.map((route, index) => {
                        const isFocused = state.index === index;
                        const tab = TABS[index];
                        if (!tab) return null;

                        const onPress = () => {
                            if (tab.name === "mypage" && !isAuthenticated) {
                                router.push("/(auth)/login" as any);
                                return;
                            }
                            const event = navigation.emit({
                                type: "tabPress",
                                target: route.key,
                                canPreventDefault: true,
                            });
                            if (!isFocused && !event.defaultPrevented) {
                                navigation.navigate(route.name);
                            }
                        };

                        return (
                            <View key={route.key} style={styles.tabItem}>
                                <Pressable
                                    onPress={onPress}
                                    style={({ pressed }) => [
                                        styles.iconWrap,
                                        isFocused && styles.iconWrapActive,
                                        Platform.OS === "ios" && pressed && { opacity: 0.75 },
                                    ]}
                                    android_ripple={{
                                        color: "rgba(5, 150, 105, 0.2)",
                                        borderless: true,
                                        radius: 22,
                                    }}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: isFocused }}
                                >
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
                                </Pressable>
                            </View>
                        );
                    })}
                </View>
            </View>
        </>
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
    plusArea: {
        position: "absolute",
        alignItems: "flex-end",
        zIndex: 50,
    },
    plusBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#7FCC9F",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.5)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 10,
    },
    plusText: {
        fontSize: 28,
        fontWeight: "300",
        color: "#fff",
        lineHeight: 34,
        marginTop: -2,
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
