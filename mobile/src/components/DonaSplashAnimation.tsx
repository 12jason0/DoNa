/**
 * 웹 DonaSplashFinal.tsx 완전 동일 UI — React Native 버전
 *
 * 타임라인 (웹과 동일):
 *  70ms  → step 1 시작
 *  270ms → step 2: 지도 그리드 등장
 *  530ms → step 3: 핀1 (💕 출발) 낙하
 *  870ms → step 4: 핀2 (🌳 데이트) 낙하
 * 1330ms → step 5: 핀3 (💖 도착) 낙하
 * 2000ms → step 6: DoNa 로고 슬라이드업 + 페이드인
 * 3330ms → fade out 시작
 * 4000ms → onDone() 호출
 */
import React, { useEffect, useRef } from "react";
import {
    View,
    Text,
    Image,
    Animated,
    Dimensions,
    StyleSheet,
} from "react-native";
import Svg, { Line } from "react-native-svg";
import { useLocale } from "../lib/useLocale";

const { width: SW, height: SH } = Dimensions.get("window");

// 웹 컨테이너(340×420)를 화면 비율에 맞게 스케일
const CONTAINER_W = Math.min(SW * 0.88, 340);
const SCALE = CONTAINER_W / 340;
const CONTAINER_H = 420 * SCALE;

// DoNa 로고 (CloudFront) — getS3StaticUrl("logo/donalogo_512.png") 와 동일
const LOGO_URI = "https://d13xx6k6chk2in.cloudfront.net/logo/donalogo_512_glow.png";

type Props = { onDone?: () => void };

export default function DonaSplashAnimation({ onDone }: Props) {
    const { t } = useLocale();
    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;

    // ── 전체 페이드 ──────────────────────────────────────────────────────────
    const fadeAnim = useRef(new Animated.Value(1)).current;

    // ── 그리드 ───────────────────────────────────────────────────────────────
    const gridOpacity = useRef(new Animated.Value(0)).current;
    const gridScale   = useRef(new Animated.Value(0.9)).current;

    // ── 핀1 (💕 출발) ────────────────────────────────────────────────────────
    const p1Y = useRef(new Animated.Value(-120 * SCALE)).current;
    const p1O = useRef(new Animated.Value(0)).current;
    const p1S = useRef(new Animated.Value(0)).current;
    const p1R = useRef(new Animated.Value(0)).current; // 0→1→2→3 단계 → deg 변환

    // ── 핀2 (🌳 데이트) ──────────────────────────────────────────────────────
    const p2Y = useRef(new Animated.Value(-120 * SCALE)).current;
    const p2O = useRef(new Animated.Value(0)).current;
    const p2S = useRef(new Animated.Value(0)).current;
    const p2R = useRef(new Animated.Value(0)).current;

    // ── 핀3 (💖 도착) ────────────────────────────────────────────────────────
    const p3Y = useRef(new Animated.Value(-120 * SCALE)).current;
    const p3O = useRef(new Animated.Value(0)).current;
    const p3S = useRef(new Animated.Value(0)).current;
    const p3R = useRef(new Animated.Value(0)).current;

    // ── 로고 (카드 없이 배경 위 직접 등장) ──────────────────────────────────────
    const logoO = useRef(new Animated.Value(0)).current;
    const logoY = useRef(new Animated.Value(24)).current;

    // ── 핀 낙하 애니메이션 (웹 pinDrop keyframe 완전 동일) ───────────────────
    // 웹: 0%→translateY(-120) scale(0) rotate(0) opacity:0
    //     60%→translateY(8) scale(1.15) rotate(5deg) opacity:1
    //     80%→translateY(-3) scale(0.95) rotate(-2deg)
    //     100%→translateY(0) scale(1) rotate(0deg) opacity:1
    // rotate는 0→1→2→3 단계값으로 animate 후 interpolate로 deg 변환
    const dropPin = (
        yAnim: Animated.Value,
        oAnim: Animated.Value,
        sAnim: Animated.Value,
        rAnim: Animated.Value,
    ) => {
        Animated.parallel([
            Animated.sequence([
                Animated.timing(yAnim, { toValue: 8 * SCALE,  duration: 360, useNativeDriver: true }),
                Animated.timing(yAnim, { toValue: -3 * SCALE, duration: 120, useNativeDriver: true }),
                Animated.timing(yAnim, { toValue: 0,          duration: 120, useNativeDriver: true }),
            ]),
            Animated.timing(oAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.sequence([
                Animated.timing(sAnim, { toValue: 1.15, duration: 360, useNativeDriver: true }),
                Animated.timing(sAnim, { toValue: 0.95, duration: 120, useNativeDriver: true }),
                Animated.timing(sAnim, { toValue: 1,    duration: 120, useNativeDriver: true }),
            ]),
            // rotate: 0deg → 5deg → -2deg → 0deg (단계값 0→1→2→3)
            Animated.sequence([
                Animated.timing(rAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
                Animated.timing(rAnim, { toValue: 2, duration: 120, useNativeDriver: true }),
                Animated.timing(rAnim, { toValue: 3, duration: 120, useNativeDriver: true }),
            ]),
        ]).start();
    };

    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = [];
        const at = (delay: number, fn: () => void) => {
            timers.push(setTimeout(fn, delay));
        };

        // step 2: 그리드
        at(270, () => {
            Animated.parallel([
                Animated.timing(gridOpacity, { toValue: 0.15, duration: 800, useNativeDriver: true }),
                Animated.timing(gridScale,   { toValue: 1,    duration: 800, useNativeDriver: true }),
            ]).start();
        });

        // step 3: 핀1
        at(530, () => dropPin(p1Y, p1O, p1S, p1R));

        // step 4: 핀2
        at(870, () => dropPin(p2Y, p2O, p2S, p2R));

        // step 5: 핀3
        at(1330, () => dropPin(p3Y, p3O, p3S, p3R));

        // step 6: 로고 — 배경 위 슬라이드업 + 페이드인
        at(2000, () => {
            Animated.parallel([
                Animated.timing(logoO, { toValue: 1, duration: 700, useNativeDriver: true }),
                Animated.timing(logoY, { toValue: 0, duration: 600, useNativeDriver: true }),
            ]).start();
        });

        // fade out
        at(3330, () => {
            Animated.timing(fadeAnim, { toValue: 0, duration: 670, useNativeDriver: true }).start();
        });

        // 완전 종료
        at(4000, () => onDoneRef.current?.());

        return () => timers.forEach(clearTimeout);
    }, []);

    const p1RotateDeg = p1R.interpolate({ inputRange: [0,1,2,3], outputRange: ["0deg","5deg","-2deg","0deg"] });
    const p2RotateDeg = p2R.interpolate({ inputRange: [0,1,2,3], outputRange: ["0deg","5deg","-2deg","0deg"] });
    const p3RotateDeg = p3R.interpolate({ inputRange: [0,1,2,3], outputRange: ["0deg","5deg","-2deg","0deg"] });

    return (
        <Animated.View style={[StyleSheet.absoluteFillObject, s.root, { opacity: fadeAnim }]}
            pointerEvents="auto"
        >
            {/* ── 지도 그리드 배경 ─────────────────────────────────────────── */}
            <Animated.View
                style={[StyleSheet.absoluteFillObject, {
                    opacity:   gridOpacity,
                    transform: [{ scale: gridScale }],
                }]}
                pointerEvents="none"
            >
                <GridBackground />
            </Animated.View>

            {/* ── 핀 컨테이너 (340×420 스케일) ─────────────────────────────── */}
            <View style={s.pinsCenter}>
                <View style={{ width: CONTAINER_W, height: CONTAINER_H }}>

                    {/* 핀1 — 💕 출발 (left:50, top:80) */}
                    <Animated.View style={[s.pin, {
                        left: 50 * SCALE,
                        top:  80 * SCALE,
                        opacity:   p1O,
                        transform: [{ translateY: p1Y }, { scale: p1S }, { rotate: p1RotateDeg }],
                    }]}>
                        <PinHead color="#FF8DA1" emoji="💕" />
                        <Text style={s.pinLabel}>{t("splash.start")}</Text>
                    </Animated.View>

                    {/* 핀2 — 🌳 데이트 (left:160, top:200) */}
                    <Animated.View style={[s.pin, {
                        left: 160 * SCALE,
                        top:  200 * SCALE,
                        opacity:   p2O,
                        transform: [{ translateY: p2Y }, { scale: p2S }, { rotate: p2RotateDeg }],
                    }]}>
                        <PinHead color="#F5DEB3" emoji="🌳" />
                        <Text style={s.pinLabel}>{t("splash.date")}</Text>
                    </Animated.View>

                    {/* 핀3 — 💖 도착 (left:250, top:120) */}
                    <Animated.View style={[s.pin, {
                        left: 250 * SCALE,
                        top:  120 * SCALE,
                        opacity:   p3O,
                        transform: [{ translateY: p3Y }, { scale: p3S }, { rotate: p3RotateDeg }],
                    }]}>
                        <PinHead color="#FF6B7A" emoji="💖" />
                        <Text style={s.pinLabel}>{t("splash.arrival")}</Text>
                    </Animated.View>

                </View>
            </View>

            {/* ── DoNa 로고 — 배경 위 직접 등장 ───────────────────────────── */}
            <Animated.View
                style={[StyleSheet.absoluteFillObject, s.logoCenter, {
                    opacity:   logoO,
                    transform: [{ translateY: logoY }],
                }]}
                pointerEvents="none"
            >
                <Image
                    source={{ uri: LOGO_URI }}
                    style={s.logoImage}
                    resizeMode="contain"
                />
            </Animated.View>
        </Animated.View>
    );
}

// ── 핀 헤드 컴포넌트 ─────────────────────────────────────────────────────────
// 웹: borderRadius "50% 50% 50% 0" + rotate(-45deg) = 눈물방울 핀 모양
function PinHead({ color, emoji }: { color: string; emoji: string }) {
    const SIZE = 50 * SCALE;
    return (
        <View style={[s.pinHead, {
            width:  SIZE,
            height: SIZE,
            backgroundColor: color,
            borderTopLeftRadius:     SIZE / 2,
            borderTopRightRadius:    SIZE / 2,
            borderBottomRightRadius: SIZE / 2,
            borderBottomLeftRadius:  0,           // 웹: borderRadius "50% 50% 50% 0"
        }]}>
            <Text style={[s.pinEmoji, { fontSize: 22 * SCALE }]}>{emoji}</Text>
        </View>
    );
}

// ── SVG 그리드 (웹: repeating-linear-gradient 50px 격자) ─────────────────────
function GridBackground() {
    const hLines: React.ReactElement[] = [];
    const vLines: React.ReactElement[] = [];
    for (let y = 0; y <= SH; y += 50) {
        hLines.push(
            <Line key={`h${y}`} x1={0} y1={y} x2={SW} y2={y}
                stroke="white" strokeWidth={1} opacity={0.3} />
        );
    }
    for (let x = 0; x <= SW; x += 50) {
        vLines.push(
            <Line key={`v${x}`} x1={x} y1={0} x2={x} y2={SH}
                stroke="white" strokeWidth={1} opacity={0.3} />
        );
    }
    return (
        <Svg width={SW} height={SH}>
            {hLines}
            {vLines}
        </Svg>
    );
}

// ── 스타일 ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: {
        backgroundColor: "#7FCC9F",   // 웹과 동일
        zIndex: 100000,
    },
    pinsCenter: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    pin: {
        position: "absolute",
        alignItems: "center",
    },
    pinHead: {
        transform: [{ rotate: "-45deg" }],
        borderWidth: 3,
        borderColor: "white",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
    },
    pinEmoji: {
        transform: [{ rotate: "45deg" }],  // 핀 -45도 상쇄
    },
    pinLabel: {
        marginTop: 6 * SCALE,
        fontSize: 13 * SCALE,
        fontWeight: "400",
        color: "white",
        textShadowColor: "rgba(0,0,0,0.2)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    logoCenter: {
        alignItems: "center",
        justifyContent: "center",
    },
    logoImage: {
        width: Math.min(SW * 0.82, 340),
        height: Math.min(SW * 0.82, 340),
    },
});
