import type { Course } from "../../types/api";

export interface PlaceData {
    id?: number;
    name?: string;
    name_en?: string | null;
    name_ja?: string | null;
    name_zh?: string | null;
    imageUrl?: string | null;
    image_url?: string | null;
    category?: string;
    address?: string;
    address_en?: string | null;
    address_ja?: string | null;
    address_zh?: string | null;
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    description?: string;
    description_en?: string | null;
    description_ja?: string | null;
    description_zh?: string | null;
    opening_hours?: string | null;
    avg_cost_range?: string;
    phone?: string;
    parking_available?: boolean;
    reservation_required?: boolean;
    reservationUrl?: string | null;
    reservation_url?: string | null;
    maps_link?: string | null;
    mapUrl?: string | null;
    closed_days?: { day_of_week?: number | null; specific_date?: string | Date | null; note?: string | null }[];
}

export interface CoursePlace {
    id?: number;
    place_id?: number;
    order_index?: number;
    order_in_segment?: number | null;
    estimated_duration?: number;
    recommended_time?: string;
    segment?: string | null;
    tips?: string | null;
    tips_en?: string | null;
    tips_ja?: string | null;
    tips_zh?: string | null;
    place?: PlaceData;
}

export interface CourseDetail extends Course {
    isSelectionType?: boolean;
    description?: string | null;
    coursePlaces?: CoursePlace[];
    sub_title?: string | null;
    target_situation?: string | null;
    budget_range?: string | null;
    transportation?: string;
    recommended_start_time?: string;
    highlights?: any[];
}

export interface CourseReview {
    id: number;
    rating: number;
    content: string;
    createdAt: string;
    userName: string;
    profileImageUrl: string;
    imageUrls?: string[];
}
