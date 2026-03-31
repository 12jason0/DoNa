import React, { useRef, useCallback, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Animated,
    Modal,
    FlatList,
    ScrollView,
    Dimensions,
    StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resolveImageUrl } from "../lib/imageUrl";

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;
const STORY_TICK_MS = 50;
const STORY_TOTAL_TICKS = 4000 / STORY_TICK_MS;

export interface MemoryDetailStory {
    id: number;
    createdAt: string;
    content?: string;
    rating?: number;
    imageUrls?: string[];
    tags?: string[];
    course?: { id?: number; title?: string; region?: string | null };
    placeData?: Record<string, { photos?: string[]; tags?: string[] }>;
}

function getAllPhotos(memory: MemoryDetailStory): string[] {
    if (memory.placeData && typeof memory.placeData === "object") {
        const stepIndices = Object.keys(memory.placeData).sort((a, b) => Number(a) - Number(b));
        return stepIndices.flatMap((k) => memory.placeData![k]?.photos ?? []);
    }
    return memory.imageUrls ?? [];
}

function getTagsForIndex(memory: MemoryDetailStory, idx: number): string[] {
    if (memory.placeData && typeof memory.placeData === "object") {
        const stepIndices = Object.keys(memory.placeData).sort((a, b) => Number(a) - Number(b));
        let count = 0;
        for (const k of stepIndices) {
            const photos = memory.placeData![k]?.photos ?? [];
            if (idx < count + photos.length) return memory.placeData![k]?.tags ?? [];
            count += photos.length;
        }
        return [];
    }
    return memory.tags ?? [];
}

interface Props {
    visible: boolean;
    memory: MemoryDetailStory | null;
    currentIndex: number;
    onIndexChange: (i: number) => void;
    onClose: () => void;
    locale?: string;
}

export default function MemoryDetailModal({
    visible,
    memory,
    currentIndex,
    onIndexChange,
    onClose,
}: Props) {
    const insets = useSafeAreaInsets();

    const progressAnim = useRef(new Animated.Value(0)).current;
    const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
    const ticksRef     = useRef(0);
    const isPausedRef  = useRef(false);
    const flatListRef  = useRef<FlatList>(null);

    const photos = memory ? getAllPhotos(memory) : [];
    const total  = Math.max(photos.length, 1);
    const tags   = memory ? getTagsForIndex(memory, currentIndex) : [];

    const clearTimer = useCallback(() => {
        if (intervalRef.current != null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const startTimer = useCallback((fromTicks: number, idx: number, tot: number) => {
        clearTimer();
        ticksRef.current = fromTicks;
        progressAnim.setValue(fromTicks / STORY_TOTAL_TICKS);

        intervalRef.current = setInterval(() => {
            ticksRef.current += 1;
            progressAnim.setValue(ticksRef.current / STORY_TOTAL_TICKS);

            if (ticksRef.current >= STORY_TOTAL_TICKS) {
                clearTimer();
                if (idx < tot - 1) {
                    flatListRef.current?.scrollToIndex({ index: idx + 1, animated: true });
                    onIndexChange(idx + 1);
                } else {
                    onClose();
                }
            }
        }, STORY_TICK_MS);
    }, [clearTimer, progressAnim, onIndexChange, onClose]);

    useEffect(() => {
        if (!visible || !memory) { clearTimer(); return; }
        isPausedRef.current = false;
        startTimer(0, currentIndex, total);
        return clearTimer;
    }, [currentIndex, visible]);

    const handlePressIn = useCallback(() => {
        if (isPausedRef.current) return;
        isPausedRef.current = true;
        clearTimer();
    }, [clearTimer]);

    const handlePressOut = useCallback(() => {
        if (!isPausedRef.current) return;
        isPausedRef.current = false;
        startTimer(ticksRef.current, currentIndex, total);
    }, [currentIndex, total, startTimer]);

    if (!memory) return null;

    const TOP_H    = insets.top + 58;
    const BOTTOM_H = insets.bottom + 26;
    const PHOTO_H  = SCREEN_H - TOP_H - BOTTOM_H;

    const dateText = (() => {
        const d = new Date(memory.createdAt);
        const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
        return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`;
    })();

    return (
        <Modal
            visible={visible}
            transparent={false}
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <StatusBar barStyle="light-content" backgroundColor="#000" />
            <View style={ms.root}>

                {/* ── 상단: 진행 바 + 지역/X ── */}
                <View style={[ms.topSection, { paddingTop: insets.top + 10 }]}>
                    <View style={ms.progressRow}>
                        {Array.from({ length: total }).map((_, i) => (
                            <View key={i} style={[ms.progressTrack, { flex: 1 }]}>
                                {i < currentIndex ? (
                                    <View style={[ms.progressFill, { width: "100%" }]} />
                                ) : i === currentIndex ? (
                                    <Animated.View
                                        style={[ms.progressFill, {
                                            width: progressAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: ["0%", "100%"],
                                                extrapolate: "clamp",
                                            }),
                                        }]}
                                    />
                                ) : null}
                            </View>
                        ))}
                    </View>

                    <View style={ms.controlRow}>
                        {memory.course?.region ? (
                            <View style={ms.regionBadge}>
                                <Text style={ms.regionText} numberOfLines={1}>{memory.course.region}</Text>
                            </View>
                        ) : <View />}
                        <TouchableOpacity
                            onPress={onClose}
                            style={ms.closeBtn}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Text style={ms.closeX}>✕</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── 사진 ── */}
                <View
                    style={[ms.photoArea, { height: PHOTO_H }]}
                    onTouchStart={handlePressIn}
                    onTouchEnd={handlePressOut}
                >
                    {photos.length > 0 ? (
                        <FlatList
                            ref={flatListRef}
                            data={photos}
                            keyExtractor={(_, i) => String(i)}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            decelerationRate="fast"
                            scrollEventThrottle={16}
                            onMomentumScrollEnd={(e) => {
                                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                                if (idx !== currentIndex) onIndexChange(idx);
                            }}
                            style={{ height: PHOTO_H }}
                            renderItem={({ item }) => (
                                <View style={[ms.photoSlide, { height: PHOTO_H }]}>
                                    <Image
                                        source={{ uri: resolveImageUrl(item) }}
                                        style={{ width: SCREEN_W, height: PHOTO_H }}
                                        resizeMode="cover"
                                    />
                                </View>
                            )}
                        />
                    ) : (
                        <View style={[ms.noPhotoBox, { height: PHOTO_H }]}>
                            <Text style={{ fontSize: 60 }}>📷</Text>
                        </View>
                    )}
                </View>

                {/* ── 하단: 날짜 + 해시태그 ── */}
                <View style={[ms.bottomSection, { paddingBottom: insets.bottom }]}>
                    <Text style={ms.dateText}>{dateText}</Text>
                    {tags.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={ms.tagScroll}
                        >
                            {tags.map((tag, i) => (
                                <View key={i} style={ms.tagPill}>
                                    <Text style={ms.tagText}>#{tag}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const ms = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#000" },
    topSection: { paddingHorizontal: 12, paddingBottom: 10 },
    progressRow: { flexDirection: "row", gap: 4, marginBottom: 10 },
    progressTrack: {
        height: 5,
        borderRadius: 99,
        backgroundColor: "rgba(255,255,255,0.3)",
        overflow: "hidden",
    },
    progressFill: { height: "100%", backgroundColor: "#fff" },
    controlRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    regionBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.2)",
    },
    regionText: { fontSize: 13, fontWeight: "500", color: "#fff" },
    closeBtn: { padding: 4 },
    closeX: { fontSize: 22, color: "#fff", fontWeight: "300" },
    photoArea: { backgroundColor: "#000" },
    photoSlide: { width: SCREEN_W, justifyContent: "flex-start", alignItems: "center" },
    noPhotoBox: { width: SCREEN_W, alignItems: "center", justifyContent: "center" },
    bottomSection: { paddingHorizontal: 20, paddingTop: 4, backgroundColor: "#000" },
    dateText: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 11,
        fontWeight: "500",
        marginBottom: 2,
    },
    tagScroll: { flexDirection: "row", gap: 8, alignItems: "center" },
    tagPill: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.15)",
    },
    tagText: { color: "#fff", fontSize: 12, fontWeight: "500" },
});
