/**
 * 🟢 AdMob 비활성화: 앱 WebView에 모달 상태 전달 (AdMob 배너 숨김) 주석 처리
 * 앱 WebView에서 모달 열림/닫힘 시 네이티브(AdMob 배너 등)에 알려 모달이 광고 위에 제대로 표시되도록 함
 */
// let modalOpenCount = 0;

// function postToNative() {
//     if (typeof window === "undefined") return;
//     const rn = (window as any).ReactNativeWebView;
//     if (!rn?.postMessage) return;
//     try {
//         rn.postMessage(JSON.stringify({ type: "modalState", isOpen: modalOpenCount > 0 }));
//     } catch {}
// }

/** 모달 열림 시 호출 - AdMob 비활성화로 no-op */
export function notifyNativeModalOpen() {
    // modalOpenCount++;
    // postToNative();
}

/** 모달 닫힘 시 호출 - AdMob 비활성화로 no-op */
export function notifyNativeModalClose() {
    // if (modalOpenCount > 0) modalOpenCount--;
    // postToNative();
}
