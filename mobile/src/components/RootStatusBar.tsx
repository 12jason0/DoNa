import { StatusBar } from "expo-status-bar";
import { useAppSettings } from "../context/AppSettingsContext";

/**
 * MMKV 저장 테마에 맞춰 상태바 글자색 (라이트 배경 → dark 글자 / 다크 배경 → light 글자)
 */
export default function RootStatusBar() {
    const { theme } = useAppSettings();
    return <StatusBar style={theme === "dark" ? "light" : "dark"} />;
}
