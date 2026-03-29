/**
 * 루트 진입점 — 항상 홈(탭)으로 이동. 웹처럼 로그인 없이도 홈 접근 가능.
 * 로그인이 필요한 기능(찜, 예약 등)은 각 화면에서 개별 처리.
 */
import { Redirect } from 'expo-router';

export default function Index() {
    return <Redirect href="/(tabs)" />;
}
