/**
 * AppTabBar 플로팅 pill 높이(대략): wrapper paddingTop 8 + pill paddingVertical 8 + icon 38 + wrapper bottom padding 8
 * + useSafeAreaInsets().bottom (제스처/홈 인디케이터)
 */
const FLOATING_TAB_BAR_FIXED = 8 + 8 + 38 + 8;

export function floatingTabBarBottomReserve(bottomInset: number): number {
    return FLOATING_TAB_BAR_FIXED + bottomInset;
}
