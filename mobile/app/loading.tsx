import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Image } from "expo-image";

/**
 * expo-router가 root layout 로드 중일 때 보여주는 로딩 화면
 * splash 배경색(#6db48c)에 맞춰 자연스럽게 이어짐
 */
export default function LoadingScreen() {
    return (
        <View style={styles.container}>
            <Image source={require("../assets/splash.png")} style={styles.logo} contentFit="contain" />
            <ActivityIndicator color="#ffffff" size="large" style={styles.spinner} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#6db48c",
        alignItems: "center",
        justifyContent: "center",
    },
    logo: {
        width: 200,
        height: 200,
    },
    spinner: {
        marginTop: 32,
    },
});
