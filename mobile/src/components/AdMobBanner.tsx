import React, { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

/**
 * Google AdMob 배너 광고 (표준 320x50)
 * - 로드 실패 시 영역 숨김 (빈 박스 방지)
 */
const AD_UNIT_ID = __DEV__
    ? TestIds.BANNER
    : Platform.OS === "android"
      ? "ca-app-pub-1305222191440436/1315254814"
      : "ca-app-pub-1305222191440436/1315254814";

export default function AdMobBanner() {
    const insets = useSafeAreaInsets();
    const [loadFailed, setLoadFailed] = useState(false);

    if (loadFailed) return null;

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <BannerAd
                unitId={AD_UNIT_ID}
                size={BannerAdSize.BANNER}
                onAdLoaded={() => {}}
                onAdFailedToLoad={(error) => {
                    if (__DEV__) console.log("[AdMob] 배너 로드 실패:", error);
                    setLoadFailed(true);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 320,
        alignSelf: "center",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
        marginTop: -24, // footer와 광고 사이 간격
    },
});
