/**
 * 웹 SideMenuDrawer.tsx 와 동일한 항목: + 탭 시 블러 오버레이 + 우측 하단 메뉴
 */
import React, { useCallback, useEffect, useRef } from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Dimensions,
    Animated,
    Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import { useAuth } from "../hooks/useAuth";
import { useThemeColors } from "../hooks/useThemeColors";
import { useLocale } from "../lib/useLocale";
import { useModal } from "../lib/modalContext";

const SLIDE_FROM = 96;

export default function SideMenuSheet() {
    const { isOpen, closeModal, openModal } = useModal();
    const visible = isOpen("sideMenu");
    const onClose = () => closeModal("sideMenu");
    const insets = useSafeAreaInsets();
    const t = useThemeColors();
    const { t: i18n } = useLocale();
    const { isAuthenticated } = useAuth();
    /** 탭바(+ 버튼) 기준보다 살짝 위로 올림 */
    const panelBottom = insets.bottom + 8 + 46 + 12 + 28;
    const maxW = Math.min(300, Dimensions.get("window").width * 0.8);

    const translateY = useRef(new Animated.Value(SLIDE_FROM)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;
    const closingRef = useRef(false);

    const overlayBg = "rgba(255,255,255,0.88)";

    useEffect(() => {
        if (!visible) {
            closingRef.current = false;
            return;
        }
        translateY.setValue(SLIDE_FROM);
        overlayOpacity.setValue(0);
        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 68,
                friction: 12,
            }),
            Animated.timing(overlayOpacity, {
                toValue: 1,
                duration: 280,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [visible, translateY, overlayOpacity]);

    const handleDismiss = useCallback(
        (afterClose?: () => void) => {
            if (closingRef.current) return;
            closingRef.current = true;
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: SLIDE_FROM,
                    duration: 240,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(overlayOpacity, {
                    toValue: 0,
                    duration: 220,
                    easing: Easing.in(Easing.quad),
                    useNativeDriver: true,
                }),
            ]).start(({ finished }) => {
                closingRef.current = false;
                if (finished) {
                    onClose();
                    afterClose?.();
                }
            });
        },
        [onClose, translateY, overlayOpacity],
    );

    const goNearby = () => handleDismiss(() => router.push("/nearby" as any));
    const goShop = () => handleDismiss(() => openModal("comingSoon"));
    const goMypage = () => handleDismiss(() => router.push("/(tabs)/mypage" as any));
    const goLogin = () => handleDismiss(() => router.push("/(auth)/login" as any));
    const goSignup = () => handleDismiss(() => router.push("/(auth)/signup" as any));
    const onEscape = () => handleDismiss(() => openModal("comingSoon"));
    const goSuggest = () => handleDismiss(() => router.push("/suggest" as any));

    return (
        <>
        <Modal visible={visible} transparent animationType="none" onRequestClose={() => handleDismiss()} statusBarTranslucent navigationBarTranslucent>
            <View style={styles.root} pointerEvents="box-none">
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => handleDismiss()}>
                    <Animated.View
                        style={[
                            StyleSheet.absoluteFill,
                            { opacity: overlayOpacity },
                        ]}
                    >
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayBg }]} />
                    </Animated.View>
                </TouchableOpacity>

                <Animated.View
                    style={[
                        styles.panelWrap,
                        {
                            bottom: panelBottom,
                            maxWidth: maxW,
                            transform: [{ translateY }],
                        },
                    ]}
                    pointerEvents="box-none"
                >
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollInner}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.colReverse}>
                            <TouchableOpacity style={styles.row} onPress={goNearby} activeOpacity={0.85}>
                                <Text style={[styles.label, { color: "#3f6212" }]}>{i18n("nav.whatToDoToday")}</Text>
                                <View style={[styles.iconCircle, { backgroundColor: "#ecfccb" }]}>
                                    <Ionicons name="grid-outline" size={20} color="#4d7c0f" />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.row} onPress={goSuggest} activeOpacity={0.85}>
                                <Text style={[styles.label, { color: "#d97706" }]}>{i18n("header.suggestPlace")}</Text>
                                <View style={[styles.iconCircle, { backgroundColor: "#fef3c7" }]}>
                                    <Ionicons name="bulb-outline" size={20} color="#d97706" />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.row} onPress={onEscape} activeOpacity={0.85}>
                                <Text style={[styles.label, { color: "#1d4ed8" }]}>{i18n("nav.coupleMissionGame")}</Text>
                                <View style={[styles.iconCircle, { backgroundColor: "#dbeafe" }]}>
                                    <Ionicons name="flag-outline" size={20} color="#2563eb" />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.row} onPress={goShop} activeOpacity={0.85}>
                                <Text style={[styles.label, { color: "#059669" }]}>{i18n("nav.donaShop")}</Text>
                                <View style={[styles.iconCircle, { backgroundColor: "#d1fae5" }]}>
                                    <Ionicons name="bag-handle-outline" size={20} color="#059669" />
                                </View>
                            </TouchableOpacity>

                            {isAuthenticated ? (
                                <TouchableOpacity style={styles.row} onPress={goMypage} activeOpacity={0.85}>
                                    <Text style={[styles.label, { color: t.text }]}>{i18n("nav.myPage")}</Text>
                                    <View style={[styles.iconCircle, { backgroundColor: "#334155" }]}>
                                        <Ionicons name="person" size={20} color="#fff" />
                                    </View>
                                </TouchableOpacity>
                            ) : (
                                <>
                                    <TouchableOpacity style={styles.row} onPress={goLogin} activeOpacity={0.85}>
                                        <Text style={[styles.label, { color: t.text }]}>{i18n("nav.login")}</Text>
                                        <View style={[styles.iconCircle, { backgroundColor: "#334155" }]}>
                                            <Ionicons name="log-in-outline" size={20} color="#fff" />
                                        </View>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.row} onPress={goSignup} activeOpacity={0.85}>
                                        <Text style={[styles.label, { color: "#0284c7" }]}>{i18n("nav.signup")}</Text>
                                        <View style={[styles.iconCircle, { backgroundColor: "#e0f2fe" }]}>
                                            <Ionicons name="person-add-outline" size={20} color="#0284c7" />
                                        </View>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>

        </>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    panelWrap: {
        position: "absolute",
        right: 12,
        alignSelf: "flex-end",
        maxHeight: "78%",
        zIndex: 10,
    },
    scrollInner: {
        paddingVertical: 8,
        paddingRight: 4,
    },
    colReverse: {
        flexDirection: "column-reverse",
        alignItems: "flex-end",
        gap: 4,
    },
    /** 텍스트(왼쪽) → 아이콘(오른쪽), 행은 우측 정렬 */
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 10,
        maxWidth: "100%",
    },
    label: {
        fontSize: 14,
        fontWeight: "500",
        flexShrink: 1,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
});
