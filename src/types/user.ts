export interface UserInfo {
    name: string;
    email: string;
    joinDate: string;
    profileImage: string;
    mbti?: string | null;
    age?: number | null;
    ageRange?: string | null;
    gender?: string | null;
    subscriptionTier?: "FREE" | "BASIC" | "PREMIUM";
    subscriptionExpiresAt?: string | null;
}

export interface UserPreferences {
    concept: string[];
    companion: string;
    mood: string[];
    regions: string[];
}

export interface CourseInfoForFavorite {
    id: number;
    title: string;
    description: string;
    imageUrl: string;
    price: string;
    rating: number;
    concept: string;
    grade?: "FREE" | "BASIC" | "PREMIUM";
}

export interface Favorite {
    id: number;
    course_id: number;
    course: CourseInfoForFavorite;
}

export interface UserBadgeItem {
    id: number;
    name: string;
    image_url?: string | null;
    description?: string | null;
    awarded_at: string;
}

export interface UserRewardRow {
    id: number;
    type: string;
    amount: number;
    unit: string;
    createdAt: string;
}

export interface UserCheckinRow {
    id: number;
    date: string;
    rewarded: boolean;
    createdAt: string;
}

export interface CompletedCourse {
    course_id: number;
    title: string;
    description: string;
    imageUrl: string;
    rating: number;
    concept: string;
    region?: string | null;
    completedAt?: string | null;
}

export interface CasefileItem {
    story_id: number;
    title: string;
    synopsis: string;
    region?: string | null;
    imageUrl?: string | null;
    completedAt?: string | null;
    badge?: { id: number; name: string; image_url?: string | null } | null;
    photoCount?: number;
}
