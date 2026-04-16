// 앱 세션 동안 push 등록 상태를 공유하는 모듈
// usePushRegistration + logout() 양쪽에서 circular dep 없이 사용하기 위해 분리

let _registeredForUserId: number | null = null;

export function getRegisteredForUserId() {
    return _registeredForUserId;
}

export function setRegisteredForUserId(id: number | null) {
    _registeredForUserId = id;
}
