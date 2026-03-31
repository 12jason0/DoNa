/**
 * 웹 KakaoChannelModal.tsx 와 동일 — 로그인 사용자 알림(카카오 채널) 안내
 * 시트는 아래에서 위로 슬라이드
 */
import React from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    TouchableOpacity,
    Linking,
    useWindowDimensions,
    Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useSlideModalAnimation } from "../hooks/useSlideModalAnimation";
import { useThemeColors } from "../hooks/useThemeColors";
import { modalBottomPadding } from "../utils/modalSafePadding";
import { MODAL_ANDROID_PROPS } from "../constants/modalAndroidProps";
import { KAKAO_CHANNEL_CHAT_URL } from "../config";

const COPY = {
    eventPromotion: "이벤트 프로모션",
    reportTitle: "숨겨진 맛집 제보하고",
    starbucksCoffee: "스타벅스 커피",
    receive: "받기",
    shareDesc: "나만 아는 데이트 장소를 공유해주세요.",
    lotteryDesc: "매달 추첨을 통해 선물을 드립니다.",
    reportViaKakao: "카카오톡으로 제보하기",
    participateLater: "다음에 참여할게요",
};

type Props = {
    visible: boolean;
    onClose: () => void;
};

export default function KakaoChannelModal({ visible, onClose }: Props) {
    const t = useThemeColors();
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const maxH = Math.min(height * 0.88, height - insets.top - 24);
    const { rendered, translateY, backdropOpacity } = useSlideModalAnimation(visible);

    const openKakao = async () => {
        try {
            await Linking.openURL(KAKAO_CHANNEL_CHAT_URL);
        } catch {
            // ignore
        }
        onClose();
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
            <View style={styles.root}>
                <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                </Animated.View>
                <Animated.View
                    style={[
                        styles.sheetWrap,
                        {
                            transform: [{ translateY }],
                            maxHeight: maxH,
                        },
                    ]}
                >
                    <Pressable
                        style={[styles.sheet, { backgroundColor: t.card, paddingBottom: modalBottomPadding(insets.bottom) }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={[styles.hero, { backgroundColor: t.surface }]}>
                            <View style={styles.heroInner}>
                                <Text style={styles.heroEmoji}>☕️</Text>
                                <Text style={styles.heroCaps}>{COPY.eventPromotion}</Text>
                            </View>
                            <TouchableOpacity style={styles.heroClose} onPress={onClose} hitSlop={12}>
                                <Ionicons name="close" size={22} color={t.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.body}>
                            <Text style={[styles.title, { color: t.text }]}>
                                {COPY.reportTitle}
                                {"\n"}
                                <Text style={styles.titleAccent}>{COPY.starbucksCoffee}</Text> {COPY.receive}
                            </Text>
                            <Text style={[styles.desc, { color: t.textMuted }]}>
                                {COPY.shareDesc}
                                {"\n"}
                                {COPY.lotteryDesc}
                            </Text>

                            <TouchableOpacity style={styles.kakaoBtn} onPress={openKakao} activeOpacity={0.9}>
                                <Text style={styles.kakaoMark}>💬</Text>
                                <Text style={styles.kakaoBtnText}>{COPY.reportViaKakao}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={onClose} style={styles.laterBtn}>
                                <Text style={[styles.laterText, { color: t.textMuted }]}>{COPY.participateLater}</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        justifyContent: "flex-end",
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.55)",
    },
    sheetWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
    },
    sheet: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: "hidden",
    },
    hero: {
        height: 160,
        backgroundColor: "#f1f5f9",
        justifyContent: "center",
        alignItems: "center",
    },
    heroInner: {
        alignItems: "center",
        gap: 8,
    },
    heroEmoji: {
        fontSize: 40,
    },
    heroCaps: {
        fontSize: 11,
        fontWeight: "600",
        color: "#059669",
        letterSpacing: 1.2,
    },
    heroClose: {
        position: "absolute",
        top: 12,
        right: 12,
        padding: 8,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.6)",
    },
    body: {
        paddingHorizontal: 24,
        paddingTop: 8,
        alignItems: "center",
    },
    title: {
        fontSize: 22,
        fontWeight: "600",
        color: "#111827",
        textAlign: "center",
        lineHeight: 30,
        marginBottom: 10,
    },
    titleAccent: {
        color: "#059669",
    },
    desc: {
        fontSize: 15,
        color: "#6b7280",
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 24,
        maxWidth: 300,
    },
    kakaoBtn: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#FAE100",
        paddingVertical: 16,
        borderRadius: 14,
    },
    kakaoMark: {
        fontSize: 20,
    },
    kakaoBtnText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#371D1E",
    },
    laterBtn: {
        marginTop: 16,
        paddingVertical: 8,
    },
    laterText: {
        fontSize: 14,
        color: "#9ca3af",
        textDecorationLine: "underline",
    },
});
