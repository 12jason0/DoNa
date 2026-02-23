/**
 * 로그인 모달 상황별 문구 (LoginModal props용)
 * - courseDetail: 메인 카드/코스 클릭 → 상세 보기
 * - recommendation: 추천받기 CTA → 맞춤 추천
 * - saveRecord: 저장/기록 버튼 → 나만의 앨범
 */

export const LOGIN_MODAL_PRESETS = {
    courseDetail: {
        title: "이 코스를 자세히 보려면\n로그인이 필요해요",
        description: "로그인하면 상세 정보와\n지도·저장도 할 수 있어요",
        benefits: [
            "코스 상세/지도/팁을 볼 수 있어요",
            "원하는 코스를 저장할 수 있어요",
            "내 취향 기준 추천도 받을 수 있어요",
        ],
    },
    recommendation: {
        title: "내 취향으로 추천을 받아볼까요?",
        description: "몇 가지 질문만 답하면\n오늘 코스를 골라줘요",
        benefits: [
            "질문 4개로 오늘 코스를 골라줘요",
            "내 취향/무드/지역 반영",
            "추천 기록이 앨범에 남아요",
        ],
    },
    saveRecord: {
        title: "이 코스를 기록하려면\n로그인이 필요해요",
        description: "저장한 코스는\n나만의 앨범에 모여요",
        benefits: [
            "저장한 코스는 앨범에 자동으로 모여요",
            "사진/코스 기록을 한 번에 관리할 수 있어요",
            "나중에 다시 꺼내보기 쉬워요",
        ],
    },
} as const;

export type LoginModalPresetKey = keyof typeof LOGIN_MODAL_PRESETS;
