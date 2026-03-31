/**
 * 웹 SearchModal.tsx 와 동일 기능 — 검색 기록 API / 인기 검색어 / 추천 테마
 * 제출 시 /(tabs)/explore?q= 로 네이티브 탐색
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Image,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
    ActivityIndicator,
    Animated,
    PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { api } from "../lib/api";
import { SEARCH_COPY, CDN_CONCEPT_ICONS } from "../constants/searchModalCopy";
import { Colors } from "../constants/theme";
import { useSlideModalAnimation } from "../hooks/useSlideModalAnimation";
import { useThemeColors } from "../hooks/useThemeColors";
import { modalBottomPadding } from "../utils/modalSafePadding";
import { MODAL_ANDROID_PROPS } from "../constants/modalAndroidProps";

const HEADER_BAR = 48;

type SearchHistoryItem = { id: string; keyword: string; createdAt: string };

type Props = {
    visible: boolean;
    onClose: () => void;
};

export default function SearchModal({ visible, onClose }: Props) {
    const t = useThemeColors();
    const insets = useSafeAreaInsets();
    const inputRef = useRef<TextInput>(null);
    const [query, setQuery] = useState("");
    const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
    const [isSearchHistoryEnabled, setIsSearchHistoryEnabled] = useState(true);
    const [showDisableConfirm, setShowDisableConfirm] = useState(false);
    const [loading, setLoading] = useState(true);

    const topOffset = insets.top + HEADER_BAR;
    const sheetHeight = Dimensions.get("window").height - topOffset;

    const { rendered, translateY, backdropOpacity } = useSlideModalAnimation(visible, sheetHeight);

    // 드래그로 닫기
    const dragY = useRef(new Animated.Value(0)).current;
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
            onPanResponderMove: (_, g) => {
                if (g.dy > 0) dragY.setValue(g.dy);
            },
            onPanResponderRelease: (_, g) => {
                if (g.dy > 80 || g.vy > 0.5) {
                    Animated.timing(dragY, {
                        toValue: sheetHeight,
                        duration: 220,
                        useNativeDriver: true,
                    }).start(() => {
                        dragY.setValue(0);
                        onClose();
                    });
                } else {
                    Animated.spring(dragY, {
                        toValue: 0,
                        useNativeDriver: true,
                        damping: 20,
                        stiffness: 300,
                    }).start();
                }
            },
        })
    ).current;
    const confirmAnim = useSlideModalAnimation(showDisableConfirm, 380);

    const fetchSearchHistory = useCallback(async () => {
        try {
            const res = await api.get<SearchHistoryItem[] | { list?: SearchHistoryItem[]; isSearchHistoryEnabled?: boolean }>(
                "/api/search-history",
            );
            if (Array.isArray(res)) {
                setSearchHistory(res);
                setIsSearchHistoryEnabled(true);
            } else if (res && typeof res === "object" && "list" in res) {
                setSearchHistory(Array.isArray(res.list) ? res.list : []);
                setIsSearchHistoryEnabled(res.isSearchHistoryEnabled !== false);
            } else {
                setSearchHistory([]);
            }
        } catch {
            setSearchHistory([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (visible) {
            setLoading(true);
            setQuery("");
            fetchSearchHistory();
            setTimeout(() => inputRef.current?.focus(), 120);
        } else {
            setShowDisableConfirm(false);
        }
    }, [visible, fetchSearchHistory]);

    const handleSearch = async (keyword: string) => {
        const trimmed = keyword.trim();
        if (!trimmed) return;
        onClose();
        setQuery("");
        router.push(`/nearby?q=${encodeURIComponent(trimmed)}` as any);
        try {
            await api.post("/api/search-history", { keyword: trimmed });
        } catch {
            // ignore
        }
    };

    const handleDeleteHistoryItem = async (id: string) => {
        try {
            await api.delete(`/api/search-history?id=${encodeURIComponent(id)}`);
            setSearchHistory((prev) => prev.filter((h) => h.id !== id));
        } catch {
            // ignore
        }
    };

    const handleConfirmDisableSearchHistory = async () => {
        try {
            await api.delete("/api/search-history");
            await api.patch("/api/search-history", { isSearchHistoryEnabled: false });
            setSearchHistory([]);
            setIsSearchHistoryEnabled(false);
            setShowDisableConfirm(false);
        } catch {
            setShowDisableConfirm(false);
        }
    };

    const handleEnableSearchHistory = async () => {
        try {
            await api.patch("/api/search-history", { isSearchHistoryEnabled: true });
            setIsSearchHistoryEnabled(true);
        } catch {
            // ignore
        }
    };

    if (!rendered) return null;

    return (
        <Modal
            visible={rendered}
            transparent
            animationType="none"
            onRequestClose={onClose}
            {...MODAL_ANDROID_PROPS}
        >
            <View style={styles.flex}>
                <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                >
                    <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                    </Animated.View>
                    <Animated.View
                        style={[
                            styles.sheet,
                            {
                                top: topOffset,
                                bottom: 0,
                                backgroundColor: t.card,
                                transform: [{ translateY: Animated.add(translateY, dragY) }],
                            },
                        ]}
                    >
                        <Pressable style={styles.sheetInner} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.sheetInnerFill}>
                            {/* 드래그 핸들 */}
                            <View style={styles.dragHandleArea} {...panResponder.panHandlers}>
                                <View style={[styles.dragHandle, { backgroundColor: t.isDark ? "#4b5563" : "#d1d5db" }]} />
                            </View>
                            {/* 헤더 */}
                            <View style={styles.headRow}>
                                <Text style={[styles.headTitle, { color: t.text }]}>{SEARCH_COPY.title}</Text>
                                <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.iconHit}>
                                    <Ionicons name="close" size={26} color={t.textMuted} />
                                </TouchableOpacity>
                            </View>

                            {/* 검색창 */}
                            <View style={[styles.searchBarWrap, { borderBottomColor: t.border }]}>
                                <View style={[styles.searchBar, { backgroundColor: t.surface }]}>
                                    <Ionicons name="search" size={18} color={t.textMuted} />
                                    <TextInput
                                        ref={inputRef}
                                        style={[styles.input, { color: t.text }]}
                                        placeholder={SEARCH_COPY.placeholder}
                                        placeholderTextColor={t.textMuted}
                                        value={query}
                                        onChangeText={setQuery}
                                        returnKeyType="search"
                                        onSubmitEditing={() => handleSearch(query)}
                                    />
                                    {query.length > 0 ? (
                                        <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                                            <Ionicons name="close-circle" size={20} color="#9ca3af" />
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            </View>

                            {loading ? (
                                <View style={styles.loadingBox}>
                                    <ActivityIndicator size="large" color={Colors.brandGreen} />
                                </View>
                            ) : (
                                <ScrollView
                                    style={styles.scroll}
                                    contentContainerStyle={[
                                        styles.scrollContent,
                                        {
                                            paddingBottom: Math.max(32, modalBottomPadding(insets.bottom) + 8),
                                        },
                                    ]}
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator={false}
                                >
                                    {(searchHistory.length > 0 || !isSearchHistoryEnabled) && (
                                        <View style={styles.section}>
                                            <View style={styles.sectionHead}>
                                                <View style={styles.sectionHeadLeft}>
                                                    <Ionicons name="time-outline" size={16} color={t.textMuted} />
                                                    <Text style={[styles.sectionTitle, { color: t.text }]}>{SEARCH_COPY.recentSearches}</Text>
                                                </View>
                                                {isSearchHistoryEnabled ? (
                                                    <TouchableOpacity onPress={() => setShowDisableConfirm(true)}>
                                                        <Text style={styles.linkMuted}>{SEARCH_COPY.disableHistory}</Text>
                                                    </TouchableOpacity>
                                                ) : (
                                                    <TouchableOpacity onPress={handleEnableSearchHistory}>
                                                        <Text style={styles.linkGreen}>{SEARCH_COPY.enableHistory}</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                            {searchHistory.length > 0 && (
                                                <ScrollView
                                                    horizontal
                                                    showsHorizontalScrollIndicator={false}
                                                    contentContainerStyle={styles.chipsRow}
                                                >
                                                    {searchHistory.map((item) => (
                                                        <View key={item.id} style={[styles.historyChip, { backgroundColor: t.surface, borderColor: t.border }]}>
                                                            <TouchableOpacity onPress={() => handleSearch(item.keyword)}>
                                                                <Text style={[styles.historyChipText, { color: t.text }]} numberOfLines={1}>
                                                                    {item.keyword}
                                                                </Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                onPress={() => handleDeleteHistoryItem(item.id)}
                                                                hitSlop={6}
                                                                accessibilityLabel={SEARCH_COPY.deleteItem}
                                                            >
                                                                <Ionicons name="close" size={14} color="#9ca3af" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    ))}
                                                </ScrollView>
                                            )}
                                        </View>
                                    )}

                                    <View style={styles.section}>
                                        <View style={[styles.sectionHeadLeft, styles.popularHeadRow]}>
                                            <Ionicons name="trending-up" size={16} color="#10b981" />
                                            <Text style={[styles.sectionTitle, { color: t.text }]}>{SEARCH_COPY.popularTitle}</Text>
                                        </View>
                                        <View style={styles.popularWrap}>
                                            {SEARCH_COPY.popularKeywords.map((kw, i) => (
                                                <TouchableOpacity
                                                    key={i}
                                                    style={[styles.popularChip, { backgroundColor: t.card, borderColor: t.border }]}
                                                    onPress={() => handleSearch(kw)}
                                                >
                                                    <Text style={[styles.popularChipText, { color: t.text }]}>{kw}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    <View style={[styles.section, { marginBottom: 24 }]}>
                                        <Text style={[styles.sectionTitleStandalone, { color: t.text }]}>{SEARCH_COPY.suggestedThemes}</Text>
                                        <View style={styles.themeGrid}>
                                            {SEARCH_COPY.tags.map((tag) => (
                                                <TouchableOpacity
                                                    key={tag.id}
                                                    style={[styles.themeCard, { backgroundColor: t.surface }]}
                                                    onPress={() => handleSearch(tag.label)}
                                                    activeOpacity={0.85}
                                                >
                                                    <View style={[styles.themeIconWrap, { backgroundColor: t.card }]}>
                                                        <Image
                                                            source={{ uri: `${CDN_CONCEPT_ICONS}/${tag.iconFile}` }}
                                                            style={styles.themeIcon}
                                                            resizeMode="contain"
                                                        />
                                                    </View>
                                                    <Text style={[styles.themeLabel, { color: t.text }]}>{tag.label}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                </ScrollView>
                            )}
                        </View>
                    </Pressable>
                </Animated.View>
                </KeyboardAvoidingView>

                {/* 검색 기록 끄기 확인 — 아래에서 위로 슬라이드 */}
                {confirmAnim.rendered ? (
                    <Modal
                        visible={confirmAnim.rendered}
                        transparent
                        animationType="none"
                        onRequestClose={() => setShowDisableConfirm(false)}
                        {...MODAL_ANDROID_PROPS}
                    >
                        <View style={styles.flex}>
                            <Animated.View style={[styles.backdrop, { opacity: confirmAnim.backdropOpacity }]}>
                                <Pressable
                                    style={StyleSheet.absoluteFill}
                                    onPress={() => setShowDisableConfirm(false)}
                                />
                            </Animated.View>
                            <Animated.View
                                style={[
                                    styles.confirmSheetWrap,
                                    { transform: [{ translateY: confirmAnim.translateY }] },
                                ]}
                            >
                                <Pressable
                                    style={[
                                        styles.confirmSheet,
                                        { backgroundColor: t.card },
                                        {
                                            paddingBottom: Math.max(24, modalBottomPadding(insets.bottom) + 8),
                                        },
                                    ]}
                                    onPress={(e) => e.stopPropagation()}
                                >
                                    <Text style={[styles.confirmTitle, { color: t.text }]}>{SEARCH_COPY.disableConfirmTitle}</Text>
                                    <Text style={[styles.confirmDesc, { color: t.textMuted }]}>{SEARCH_COPY.disableConfirmDesc}</Text>
                                    <View style={styles.confirmRow}>
                                        <TouchableOpacity
                                            style={[styles.confirmBtnGhost, { borderColor: t.border }]}
                                            onPress={() => setShowDisableConfirm(false)}
                                        >
                                            <Text style={[styles.confirmBtnGhostText, { color: t.text }]}>{SEARCH_COPY.keep}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.confirmBtnPrimary}
                                            onPress={handleConfirmDisableSearchHistory}
                                        >
                                            <Text style={styles.confirmBtnPrimaryText}>{SEARCH_COPY.confirmDisable}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </Pressable>
                            </Animated.View>
                        </View>
                    </Modal>
                ) : null}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    dragHandleArea: {
        alignItems: "center",
        paddingTop: 10,
        paddingBottom: 4,
    },
    dragHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    sheet: {
        position: "absolute",
        left: 0,
        right: 0,
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 12,
    },
    sheetInner: {
        flex: 1,
    },
    sheetInnerFill: {
        flex: 1,
    },
    headRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headTitle: {
        fontSize: 18,
        fontWeight: "500",
        color: "#111827",
    },
    iconHit: { padding: 4 },
    searchBarWrap: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#f3f4f6",
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f9fafb",
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 8,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: "#111827",
        paddingVertical: 0,
    },
    loadingBox: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 48,
    },
    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    section: {
        marginBottom: 28,
    },
    sectionHead: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
        gap: 8,
    },
    sectionHeadLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    popularHeadRow: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#111827",
    },
    sectionTitleStandalone: {
        fontSize: 14,
        fontWeight: "600",
        color: "#111827",
        marginBottom: 20,
    },
    linkMuted: {
        fontSize: 12,
        color: "#6b7280",
        textDecorationLine: "underline",
    },
    linkGreen: {
        fontSize: 12,
        color: "#059669",
        fontWeight: "500",
    },
    chipsRow: {
        flexDirection: "row",
        gap: 8,
        paddingRight: 8,
    },
    historyChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingLeft: 10,
        paddingRight: 6,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "#f9fafb",
        borderWidth: 1,
        borderColor: "#e5e7eb",
        maxWidth: 220,
    },
    historyChipText: {
        fontSize: 12,
        color: "#374151",
        fontWeight: "500",
    },
    popularWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 4,
    },
    popularChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#e5e7eb",
    },
    popularChipText: {
        fontSize: 12,
        color: "#374151",
        fontWeight: "500",
    },
    themeGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        justifyContent: "space-between",
    },
    themeCard: {
        width: "48%",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: 14,
        backgroundColor: "#f9fafb",
    },
    themeIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 999,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 2,
    },
    themeIcon: {
        width: 32,
        height: 32,
    },
    themeLabel: {
        flex: 1,
        fontSize: 14,
        fontWeight: "500",
        color: "#1f2937",
    },
    confirmSheetWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
    },
    confirmSheet: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    confirmTitle: {
        fontSize: 15,
        fontWeight: "500",
        color: "#111827",
        textAlign: "center",
        marginBottom: 8,
    },
    confirmDesc: {
        fontSize: 13,
        color: "#6b7280",
        textAlign: "center",
        marginBottom: 20,
        lineHeight: 20,
    },
    confirmRow: {
        flexDirection: "row",
        gap: 12,
    },
    confirmBtnGhost: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        alignItems: "center",
    },
    confirmBtnGhostText: {
        fontSize: 15,
        fontWeight: "500",
        color: "#374151",
    },
    confirmBtnPrimary: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: "#059669",
        alignItems: "center",
    },
    confirmBtnPrimaryText: {
        fontSize: 15,
        fontWeight: "500",
        color: "#fff",
    },
});
