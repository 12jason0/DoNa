/**
 * 탭 레이아웃
 * — 커스텀 플로팅 pill 탭바 (웹 Footer.tsx와 동일한 모양)
 */
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import AppTabBar from '../../src/components/AppTabBar';
import { usePushRegistration } from '../../src/hooks/usePushRegistration';

export default function TabLayout() {
    usePushRegistration();

    return (
        <Tabs
            tabBar={(props) => <AppTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                freezeOnBlur: true,
                lazy: true,
                // Android: 루트 Stack과 동일하게 설정 — 미설정 시 탭 화면에서 상태바 높이가
                // 두 번 적용되어 헤더가 과도하게 내려감
                statusBarTranslucent: Platform.OS === "android",
            }}
        >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="courses" />
            <Tabs.Screen name="explore" />
            <Tabs.Screen name="ai" />
            <Tabs.Screen name="mypage" />
        </Tabs>
    );
}
