/**
 * 웹 Header.tsx 와 동일: 검색 모달 / 장소 제보(벨) / 설정
 * 모달은 ModalManager에서 전역 렌더링 — useModal()로 열기만 함
 */
import React from "react";
import AppHeader from "./AppHeader";
import { useModalActions } from "../lib/modalContext";

export default function AppHeaderWithModals() {
    const { openModal } = useModalActions();

    return (
        <AppHeader
            showBellBadge={true}
            onSearchPress={() => openModal("search")}
            onBellPress={() => openModal("suggestNotification")}
            onSettingsPress={() => openModal("settings")}
        />
    );
}
