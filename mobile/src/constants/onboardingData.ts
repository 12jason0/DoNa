/**
 * 웹 src/constants/onboardingData.ts 와 동일 (온보딩 단일 소스)
 * — 모바일 번들에서 웹 경로 import 불가하므로 복제 유지
 */

export const REGION_GROUPS = [
    { id: "SEONGSU", label: "성수 · 건대", dbValues: ["성수", "건대", "뚝섬", "서울숲"] },
    { id: "HONGDAE", label: "홍대 · 연남 · 신촌", dbValues: ["홍대", "연남", "신촌", "망원", "합정", "상수"] },
    {
        id: "JONGNO",
        label: "종로 · 북촌 · 서촌",
        dbValues: ["종로", "북촌", "서촌", "인사", "안국", "혜화", "대학로", "익선", "광화문"],
    },
    { id: "EULJIRO", label: "을지로 (힙지로)", dbValues: ["을지로", "충무로", "명동", "종로3가"] },
    {
        id: "GANGNAM",
        label: "강남 · 압구정 · 신사",
        dbValues: [
            "강남",
            "압구정",
            "신사",
            "가로수길",
            "논현",
            "청담",
            "반포",
            "서초",
            "역삼",
            "도곡",
            "양재",
            "잠원",
        ],
    },
    {
        id: "YONGSAN",
        label: "한남 · 이태원 · 용산",
        dbValues: ["용산", "이태원", "한남", "해방촌", "경리단", "삼각지", "신용산"],
    },
    { id: "JAMSIL", label: "잠실 · 송파", dbValues: ["잠실", "송파", "석촌", "방이", "문정"] },
    { id: "YEOUIDO", label: "여의도 · 영등포", dbValues: ["여의도", "영등포", "문래", "더현대"] },
] as const;

export const VIBE_OPTIONS = [
    {
        id: "healing",
        img: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=800&auto=format&fit=crop",
        title: "따스한 햇살 & 커피",
        concepts: ["힐링", "맛집탐방", "감성데이트"],
        moods: ["조용한", "감성적"],
        desc: "여유로운 힐링",
    },
    {
        id: "hipster",
        img: "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?q=80&w=800&auto=format&fit=crop",
        title: "힙한 네온사인 & 에너지",
        concepts: ["이색데이트", "술자리"],
        moods: ["힙한", "활기찬"],
        desc: "트렌드 세터",
    },
    {
        id: "romantic",
        img: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?q=80&w=800&auto=format&fit=crop",
        title: "은은한 조명 & 와인",
        concepts: ["맛집탐방", "야경", "이색데이트"],
        moods: ["프리미엄", "빈티지"],
        desc: "로맨틱 무드",
    },
    {
        id: "activity",
        img: "https://images.unsplash.com/photo-1538485399081-7191377e8241?q=80&w=800&auto=format&fit=crop",
        title: "탁 트인 야외 & 산책",
        concepts: ["공연·전시", "인생샷"],
        moods: ["깔끔한", "이색적인"],
        desc: "자연과 낭만",
    },
] as const;

export const VALUE_OPTIONS = [
    {
        id: "visual",
        icon: "✨",
        title: "맛은 평범해도\n분위기&뷰가 깡패",
        addMood: "감성적",
        addConcept: "인생샷",
        typeLabel: "분위기파",
    },
    {
        id: "taste",
        icon: "🥘",
        title: "다 쓰러져가도\n맛이 기가 막힌 곳",
        addMood: "빈티지",
        addConcept: "맛집탐방",
        typeLabel: "실속파",
    },
] as const;

export const CREW_OPTIONS = [
    { value: "연인", label: "💖 연인", sub: "사랑받는 센스쟁이" },
    { value: "친구", label: "😎 친구", sub: "수다 떨기 좋은 인싸" },
    { value: "혼자", label: "🧘 혼자", sub: "프로 독학러" },
    { value: "소개팅", label: "👋 소개팅", sub: "설레는 첫 만남" },
] as const;

export type VibeOption = (typeof VIBE_OPTIONS)[number];
export type ValueOption = (typeof VALUE_OPTIONS)[number];
export type RegionGroup = (typeof REGION_GROUPS)[number];
