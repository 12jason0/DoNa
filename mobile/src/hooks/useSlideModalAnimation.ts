import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing } from "react-native";

const SCREEN_H = Dimensions.get("window").height;

/**
 * 투명 Modal + 배경 페이드 + 시트 아래→위 슬라이드 (visible false 시 닫힘 애니메이션 후 언마운트)
 * @param slideDistance 시트를 화면 아래로 숨길 때 이동 거리 (기본: 화면 높이)
 */
export function useSlideModalAnimation(visible: boolean, slideDistance: number = SCREEN_H) {
    const slideRef = useRef(slideDistance);
    slideRef.current = slideDistance;

    const [rendered, setRendered] = useState(visible);
    const translateY = useRef(new Animated.Value(SCREEN_H)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setRendered(true);
        }
    }, [visible]);

    useEffect(() => {
        if (!rendered) return;
        const dist = slideRef.current;

        if (visible) {
            translateY.setValue(dist);
            backdropOpacity.setValue(0);
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 24,
                    stiffness: 300,
                    mass: 0.85,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 240,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: dist,
                    duration: 280,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 0,
                    duration: 220,
                    easing: Easing.in(Easing.quad),
                    useNativeDriver: true,
                }),
            ]).start(() => setRendered(false));
        }
    }, [visible, rendered, translateY, backdropOpacity]);

    return { rendered, translateY, backdropOpacity };
}
