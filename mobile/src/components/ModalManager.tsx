/**
 * 통합 모달 매니저 — 앱 전역에서 사용하는 모든 모달을 한 곳에서 렌더링
 * _layout.tsx 에서 <ModalProvider> 안에 포함
 */
import React from "react";

import SearchModal from "./SearchModal";
import SettingsModal from "./SettingsModal";
import SuggestNotificationModal from "./SuggestNotificationModal";
import LoginModal from "./LoginModal";
import TicketPlansSheet from "./TicketPlansSheet";
import NativeLegalModal from "./NativeLegalModal";
import MemoryDetailModal from "./MemoryDetailModal";
import BenefitConsentBottomSheet from "./BenefitConsentBottomSheet";
import SideMenuSheet from "./SideMenuSheet";
import LogoutModal from "./LogoutModal";
import WithdrawalModal from "./WithdrawalModal";
import ProfileEditModal from "./ProfileEditModal";
import BadgeDetailModal from "./BadgeDetailModal";
import LimitExceededSheet from "./LimitExceededSheet";
import MemoryLimitModal from "./MemoryLimitModal";
import ScreenReservationModal from "./ScreenReservationModal";
import MoreCoursesSheet from "./MoreCoursesSheet";

export default function ModalManager() {
    return (
        <>
            {/* 헤더 모달 */}
            <SearchModal />
            <SettingsModal />
            <SuggestNotificationModal />

            {/* 인증 */}
            <LoginModal />

            {/* 결제 */}
            <TicketPlansSheet />

            {/* 법률 */}
            <NativeLegalModal />

            {/* 추억 */}
            <MemoryDetailModal />

            {/* 초기 동의 */}
            <BenefitConsentBottomSheet />

            {/* 사이드 메뉴 */}
            <SideMenuSheet />

            {/* 마이페이지 */}
            <LogoutModal />
            <WithdrawalModal />
            <ProfileEditModal />
            <BadgeDetailModal />

            {/* AI */}
            <LimitExceededSheet />

            {/* 코스 상세 */}
            <MemoryLimitModal />
            <ScreenReservationModal />

            {/* 홈 */}
            <MoreCoursesSheet />
        </>
    );
}
