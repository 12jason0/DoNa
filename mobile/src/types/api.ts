/**
 * API 응답 공통 타입 정의
 * 웹 Next.js API와 동일한 스키마 사용
 */

// ─── 사용자 ───────────────────────────────────────────────────────────────────

export type SubscriptionTier = 'FREE' | 'BASIC' | 'PREMIUM';

export type UserProfile = {
    id: number;
    email: string;
    name: string;
    nickname: string;
    profileImage?: string | null;
    subscriptionTier?: SubscriptionTier;
    subscription_tier?: SubscriptionTier; // 서버 snake_case 호환
    subscriptionExpiresAt?: string | null;
    subscription_expires_at?: string | null;
    ageRange?: string | null;
    gender?: string | null;
    mbti?: string | null;
    phone?: string | null;
    birthday?: string | null;
    createdAt?: string | null;
    hasSeenConsentModal?: boolean;
    hasOnboarding?: boolean;
    onboardingComplete?: boolean;
    user?: {
        id: number;
        nickname?: string;
        subscriptionTier?: SubscriptionTier;
        profileImage?: string | null;
    };
};

// ─── 코스 ─────────────────────────────────────────────────────────────────────

export type CourseGrade = 'FREE' | 'BASIC' | 'PREMIUM';

export type CoursePlace = {
    order_index?: number;
    place?: {
        id?: number;
        name?: string;
        imageUrl?: string | null;
        category?: string;
        address?: string;
        latitude?: number;
        longitude?: number;
    };
};

export type Course = {
    id: number;
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    grade: CourseGrade;
    duration?: string | null;
    location?: string | null;
    region?: string | null;
    tags?: string[];
    rating?: number | null;
    reviewCount?: number | null;
    participants?: number | null;
    vibe?: string | null;
    walkability?: string | null;
    concept?: string | null;
    coursePlaces?: CoursePlace[];
    isLocked?: boolean;
    matchScore?: number | null;
    matchReason?: string | null;
};

// ─── 활성 코스 (오늘 진행 중인 데이트) ────────────────────────────────────────

export type ActiveCourse = {
    courseId: number;
    courseTitle: string;
    title?: string;
    imageUrl?: string | null;
    vibe?: string | null;
    walkability?: string | null;
    rating?: number | null;
    hasMemory: boolean;
};

// ─── 예약/북마크 ──────────────────────────────────────────────────────────────

export type Booking = {
    id: number;
    courseId: number;
    userId: number;
    status: string;
    course: Course;
    createdAt: string;
};

// ─── 리워드 ──────────────────────────────────────────────────────────────────

export type Reward = {
    id: number;
    type: string;
    amount: number;
    description?: string;
    createdAt: string;
};

// ─── 추천 ────────────────────────────────────────────────────────────────────

export type RecommendationParams = {
    region?: string;
    concept?: string;
    companion?: string;
    purpose?: string;
    limit?: number;
};
