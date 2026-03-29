/**
 * 웹 src/components/PageLoadingSpinner.tsx 의 RN 포팅
 * — 흰 반투명 오버레이 + 에메랄드 스피너 링 + 📍 펄스 + DoNa 텍스트
 */
import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet, Easing } from "react-native";

type Props = {
    message?: string;
    /** true면 전체화면 절대위치 오버레이, false면 인라인(flex 1) */
    overlay?: boolean;
};

export default function PageLoadingOverlay({ message = "코스를 찾고 있어요...", overlay = true }: Props) {
    const spinAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // 스피너 회전
        Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1,
                duration: 900,
                easing: Easing.linear,
                useNativeDriver: true,
            }),
        ).start();

        // 📍·텍스트 펄스
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 0.4,
                    duration: 700,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 700,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
            ]),
        ).start();
    }, []);

    const rotate = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
    });

    return (
        <View style={[styles.root, overlay && styles.overlay]}>
            <View style={styles.inner}>
                {/* 스피너 링 */}
                <View style={styles.ringWrap}>
                    {/* 배경 링 */}
                    <View style={styles.ringBg} />
                    {/* 회전 링 */}
                    <Animated.View style={[styles.ringSpin, { transform: [{ rotate }] }]} />
                    {/* 📍 중앙 */}
                    <Animated.Text style={[styles.pin, { opacity: pulseAnim }]}>📍</Animated.Text>
                </View>

                {/* DoNa + 메시지 */}
                <View style={styles.textWrap}>
                    <Text style={styles.brand}>DoNa</Text>
                    <Animated.Text style={[styles.message, { opacity: pulseAnim }]}>
                        {message}
                    </Animated.Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.85)",
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999,
    },
    inner: {
        alignItems: "center",
        gap: 20,
    },
    // ── 링 ──────────────────────────────────────────────────────────────────
    ringWrap: {
        width: 64,
        height: 64,
        alignItems: "center",
        justifyContent: "center",
    },
    ringBg: {
        position: "absolute",
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 6,
        borderColor: "#d1fae5", // emerald-100
    },
    ringSpin: {
        position: "absolute",
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 6,
        borderTopColor: "#10b981",    // emerald-500
        borderRightColor: "transparent",
        borderBottomColor: "transparent",
        borderLeftColor: "transparent",
    },
    pin: {
        fontSize: 22,
    },
    // ── 텍스트 ──────────────────────────────────────────────────────────────
    textWrap: {
        alignItems: "center",
        gap: 4,
    },
    brand: {
        fontSize: 18,
        fontWeight: "800",
        color: "#064e3b", // emerald-900
        letterSpacing: -0.4,
    },
    message: {
        fontSize: 12,
        fontWeight: "500",
        color: "rgba(5,150,105,0.8)", // emerald-600/80
        letterSpacing: 0.3,
    },
});
