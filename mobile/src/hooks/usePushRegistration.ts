import { useEffect } from "react";
import { Platform } from "react-native";

import { useAuth } from "./useAuth";
import { registerForPushNotificationsAsync } from "../notifications";
import { api, endpoints } from "../lib/api";
import { getRegisteredForUserId, setRegisteredForUserId } from "../lib/pushRegistrationState";

export function usePushRegistration() {
    const { user } = useAuth();

    useEffect(() => {
        if (!user?.id) return;
        if (getRegisteredForUserId() === user.id) return; // 이미 등록한 유저면 스킵

        setRegisteredForUserId(user.id);

        (async () => {
            const pushToken = await registerForPushNotificationsAsync();
            if (!pushToken) return; // 권한 거부 시 early return

            try {
                await api.post(endpoints.push, {
                    pushToken,
                    platform: Platform.OS,
                    subscribed: true,
                });
            } catch (e) {
                console.warn("[usePushRegistration] 토큰 서버 등록 실패:", e);
                setRegisteredForUserId(null); // 실패 시 다음 마운트에서 재시도
            }
        })();
    }, [user?.id]);
}
