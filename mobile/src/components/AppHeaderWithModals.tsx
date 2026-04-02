/**
 * 웹 Header.tsx 와 동일: 검색 모달 / 장소 제보(벨) / 설정
 */
import React, { useState } from "react";
import AppHeader from "./AppHeader";
import SearchModal from "./SearchModal";
import SuggestNotificationModal from "./SuggestNotificationModal";
import SettingsModal from "./SettingsModal";

export default function AppHeaderWithModals() {
    const [searchOpen, setSearchOpen] = useState(false);
    const [suggestOpen, setSuggestOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    return (
        <>
            <AppHeader
                showBellBadge={true}
                onSearchPress={() => setSearchOpen(true)}
                onBellPress={() => setSuggestOpen(true)}
                onSettingsPress={() => setSettingsOpen(true)}
            />
            <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} />
            <SuggestNotificationModal visible={suggestOpen} onClose={() => setSuggestOpen(false)} />
            <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </>
    );
}
