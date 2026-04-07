import React, { useRef, useEffect } from "react";
import { Animated, Text, StyleSheet } from "react-native";

export const Toast = React.memo(function Toast({ message, icon, onHide }: { message: string; icon: string; onHide: () => void }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(16)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start();

        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 16, duration: 200, useNativeDriver: true }),
            ]).start(onHide);
        }, 1500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <Animated.View style={[s.toast, { opacity, transform: [{ translateY }] }]}>
            <Text style={s.toastIcon}>{icon}</Text>
            <Text style={s.toastText}>{message}</Text>
        </Animated.View>
    );
});

const s = StyleSheet.create({
    toast: {
        position: "absolute",
        bottom: 120,
        left: 24,
        right: 24,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 14,
        backgroundColor: "rgba(30,42,26,0.94)",
        zIndex: 100,
    },
    toastIcon: { fontSize: 18 },
    toastText: { color: "#fff", fontSize: 14, fontWeight: "500", flex: 1 },
});
