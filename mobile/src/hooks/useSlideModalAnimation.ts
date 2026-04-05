import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing } from "react-native";

const SCREEN_H = Dimensions.get("window").height;

/**
 * 투명 Modal + 배경 페이드 + 시트 아래→위 슬라이드 (visible false 시 닫힘 애니메이션 후 언마운트)
 * @param slideDistance 시트를 화면 아래로 숨길 때 이동 거리 (기본: 화면 높이)
 *
 * sheetReady: 열림 스프링이 끝난 뒤 true — 애니메이션 중 배경 탭이 시트 영역으로 잡히면
 * onClose만 먹고 언어 칩 onPress가 안 먹는 이중 탭 현상을 막기 위해 배경 dismiss에 사용
 */
export function useSlideModalAnimation(visible: boolean, slideDistance: number = SCREEN_H) {
    const slideRef = useRef(slideDistance);
    slideRef.current = slideDistance;
    const visibleRef = useRef(visible);
    visibleRef.current = visible;

    const [rendered, setRendered] = useState(visible);
    const [sheetReady, setSheetReady] = useState(false);
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
            setSheetReady(false);
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
            ]).start(({ finished }) => {
                if (finished && visibleRef.current) setSheetReady(true);
            });
        } else {
            setSheetReady(false);
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

    // 닫힘 애니메이션 중: Modal 윈도우가 아직 떠 있지만 터치를 통과시켜야 함
    const isClosing = !visible && rendered;

    return { rendered, translateY, backdropOpacity, sheetReady, isClosing };
}
