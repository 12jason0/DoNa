import React from "react";
import { View, StyleSheet } from "react-native";

/** expo-linear-gradient 없이 동작 (네이티브 미포함 시 ViewManagerAdapter 오류 방지) */
export const HeroGradientOverlay = React.memo(function HeroGradientOverlay() {
    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.1)" }]} />
            <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 200 }}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0)" }} />
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.1)" }} />
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.18)" }} />
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.32)" }} />
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.48)" }} />
            </View>
        </View>
    );
});
