/**
 * 웹 Header.tsx 와 동일: 검색 모달 / 알림(비로그인: 혜택, 로그인: 카카오 채널)
 */
import React, { useState } from "react";
import { InteractionManager } from "react-native";
import { useQuery } from "@tanstack/react-query";
import AppHeader from "./AppHeader";
import SearchModal from "./SearchModal";
import NotificationPromoModal from "./NotificationPromoModal";
import KakaoChannelModal from "./KakaoChannelModal";
import SettingsModal from "./SettingsModal";
import { useAuth } from "../hooks/useAuth";
import { api, endpoints } from "../lib/api";

export default function AppHeaderWithModals() {
    const { isAuthenticated } = useAuth();
    const [searchOpen, setSearchOpen] = useState(false);
    const [notiOpen, setNotiOpen] = useState(false);
    const [kakaoOpen, setKakaoOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const [interactionDone, setInteractionDone] = React.useState(false);
    React.useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => setInteractionDone(true));
        return () => task.cancel();
    }, []);

    const { data: favorites } = useQuery({
        queryKey: ["users", "favorites", "header-badge"],
        queryFn: () => api.get<unknown[]>(endpoints.favorites),
        enabled: isAuthenticated && interactionDone,
        staleTime: 60 * 1000,
    });

    const showBellBadge = isAuthenticated && Array.isArray(favorites) && favorites.length > 0;

    return (
        <>
            <AppHeader
                showBellBadge={showBellBadge}
                onSearchPress={() => setSearchOpen(true)}
                onBellPress={() => {
                    if (isAuthenticated) setKakaoOpen(true);
                    else setNotiOpen(true);
                }}
                onSettingsPress={() => setSettingsOpen(true)}
            />
            <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} />
            <NotificationPromoModal visible={notiOpen} onClose={() => setNotiOpen(false)} />
            <KakaoChannelModal visible={kakaoOpen} onClose={() => setKakaoOpen(false)} />
            <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </>
    );
}
