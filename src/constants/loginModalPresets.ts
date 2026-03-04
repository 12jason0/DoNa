/**
 * 로그인 모달 상황별 프리셋 키 (번역은 loginModal.presets.* 에서 t()로 로드)
 * - courseDetail: 메인 카드/코스 클릭 → 상세 보기
 * - recommendation: 추천받기 CTA → 맞춤 추천
 * - saveRecord: 저장/기록 버튼 → 나만의 앨범
 */
export const LOGIN_MODAL_PRESET_KEYS = ["courseDetail", "recommendation", "saveRecord"] as const;
export type LoginModalPresetKey = (typeof LOGIN_MODAL_PRESET_KEYS)[number];
