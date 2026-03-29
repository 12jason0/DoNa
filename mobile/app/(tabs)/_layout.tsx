/**
 * 탭 레이아웃
 * — 커스텀 플로팅 pill 탭바 (웹 Footer.tsx와 동일한 모양)
 */
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
