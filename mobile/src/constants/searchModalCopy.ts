/** 웹 ko translation.json `search` 섹션과 동일한 카피 (앱 네이티브 검색 모달용) */

export const SEARCH_COPY = {
    title: "검색",
    placeholder: "지역, 테마, 핫플 검색",
    recentSearches: "최근 검색어",
    disableHistory: "검색 기록 안 남기기",
    enableHistory: "검색 기록 다시 남기기",
    disableConfirmTitle: "검색 기록을 끄시겠어요?",
    disableConfirmDesc: "기능을 끄면 이전에 검색한 장소를 다시 찾기 어려울 수 있어요.",
    keep: "유지하기",
    confirmDisable: "네, 끌게요",
    popularTitle: "지금 인기있는 검색어",
    suggestedThemes: "이런 테마는 어때요?",
    deleteItem: "삭제",
    popularKeywords: ["성수동 카페", "비오는날 데이트", "전시회", "야경 명소", "실내 데이트"] as const,
    tags: [
        { id: "COST_EFFECTIVE" as const, label: "가성비", iconFile: "COST_EFFECTIVE.png" },
        { id: "EMOTIONAL" as const, label: "감성데이트", iconFile: "EMOTIONAL.png" },
        { id: "PHOTO" as const, label: "인생샷", iconFile: "PHOTO.png" },
        { id: "HEALING" as const, label: "힐링", iconFile: "HEALING.png" },
    ],
};

export const CDN_CONCEPT_ICONS = "https://d13xx6k6chk2in.cloudfront.net/concept-Icon";
