import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Share,
    Linking,
    Modal,
    Pressable,
    Animated,
    TextInput,
    Dimensions,
    Platform,
    KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, endpoints, BASE_URL } from "../../../src/lib/api";
import { useAuth } from "../../../src/hooks/useAuth";
import { Colors } from "../../../src/constants/theme";
import { resolveImageUrl } from "../../../src/lib/imageUrl";
import { useThemeColors } from "../../../src/hooks/useThemeColors";
import { useLocale } from "../../../src/lib/useLocale";
import { textFontForLocale } from "../../../src/lib/textDefaultFont";
import PageLoadingOverlay from "../../../src/components/PageLoadingOverlay";
import { useModal } from "../../../src/lib/modalContext";
import AppHeaderWithModals from "../../../src/components/AppHeaderWithModals";
import { MODAL_ANDROID_PROPS } from "../../../src/constants/modalAndroidProps";
import { floatingTabBarBottomReserve } from "../../../src/constants/floatingTabBarInset";
import type { Course, UserProfile, ActiveCourse } from "../../../src/types/api";
import type { CoursePlaceTipsRow } from "../../../../src/types/tip";
import {
    translateCourseFreeformKoText,
    translateCourseRegion,
    translatePlaceCategory,
    translateTargetSituation,
    translateBudgetRange,
    translateDuration,
    type CourseUiLocale,
} from "../../../../src/lib/courseTranslate";
import {
    pickCourseTitle,
    pickCourseDescription,
    pickPlaceName,
    pickPlaceAddress,
} from "../../../src/lib/courseLocalized";
import type { LocalePreference } from "../../../src/lib/appSettingsStorage";

import type { PlaceData, CoursePlace, CourseDetail, CourseReview } from "../../../src/components/courses/types";
import { GRADE_META, SEGMENT_ORDER, SEGMENT_ICONS } from "../../../src/components/courses/constants";
import {
    getPlaceImageUrl,
    getPlaceLatLng,
    getWalkingMinutes,
    getPlaceReservationUrl,
    getPlaceMapUrl,
    uploadImageViaPresign,
    coursePlaceToTipsRow,
} from "../../../src/components/courses/utils";
import { HeroGradientOverlay } from "../../../src/components/courses/HeroGradientOverlay";
import { PillToast } from "../../../src/components/courses/PillToast";
import { Toast } from "../../../src/components/courses/Toast";
import { PlaceDetailModal } from "../../../src/components/courses/PlaceDetailModal";
import { CourseMapModal } from "../../../src/components/courses/CourseMapModal";
import { PlaceCard } from "../../../src/components/courses/PlaceCard";
import { WalkingConnector } from "../../../src/components/courses/WalkingConnector";
import { ReviewCard } from "../../../src/components/courses/ReviewCard";

// ─── 메인 화면 ────────────────────────────────────────────────────────────────

export default function CourseDetailScreen() {
    const t = useThemeColors();
    const { t: i18n, locale } = useLocale();
    const screenBg = t.isDark ? "#0f1710" : "#F8F9FA";
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams<{ id: string }>();
    const queryClient = useQueryClient();
    const { isAuthenticated } = useAuth();
    const { openModal, closeModal } = useModal();
    const [isFav, setIsFav] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState<{
        place: PlaceData;
        tipsRow: CoursePlaceTipsRow;
    } | null>(null);
    type ToastPayload =
        | { id: number; variant: "bar"; message: string; icon: string }
        | { id: number; variant: "pill"; message: string; pillMode: "fav-added" | "fav-removed" };
    const [toast, setToast] = useState<ToastPayload | null>(null);
    const toastIdRef = useRef(0);
    const showToast = useCallback((message: string, icon: string) => {
        toastIdRef.current += 1;
        setToast({ id: toastIdRef.current, variant: "bar", message, icon });
    }, []);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewShowCount, setReviewShowCount] = useState(5);
    const [reviewPreviewImages, setReviewPreviewImages] = useState<string[]>([]);
    const [reviewPreviewIndex, setReviewPreviewIndex] = useState(0);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewContent, setReviewContent] = useState("");
    const [reviewImageLocalUris, setReviewImageLocalUris] = useState<string[]>([]);
    const [reviewImageUrls, setReviewImageUrls] = useState<string[]>([]);
    const [reviewUploadingImage, setReviewUploadingImage] = useState(false);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [showCourseMapModal, setShowCourseMapModal] = useState(false);
    const [mapSelectedIndex, setMapSelectedIndex] = useState<number | null>(null);
    const [screenReservationUrl, setScreenReservationUrl] = useState<string | null>(null);
    const [mapRouteMode, setMapRouteMode] = useState<"full" | "segment">("full");
    const [activePlaceIndex, setActivePlaceIndex] = useState<number | null>(null);
    // 선택형 코스
    const [mySelection, setMySelection] = useState<{
        id: string; templateCourseId: number; selectedPlaceIds: number[]; createdAt: string;
    } | null>(null);
    const [selectionLoading, setSelectionLoading] = useState(false);
    const [showSelectionUI, setShowSelectionUI] = useState(false);
    const [selectedBySegment, setSelectedBySegment] = useState<Record<string, number>>({});

    const { data: profile } = useQuery<UserProfile>({
        queryKey: ["profile"],
        queryFn: () => api.get<UserProfile>(endpoints.profile),
        retry: false,
    });

    const { data: activeCourse } = useQuery<ActiveCourse | null>({
        queryKey: ["users", "active-course"],
        queryFn: () => api.get<ActiveCourse | null>(endpoints.activeCourse).catch(() => null),
        enabled: isAuthenticated,
        staleTime: 1000 * 60 * 2,
    });

    const {
        data: course,
        isLoading,
        isError,
    } = useQuery<CourseDetail>({
        queryKey: ["course", id],
        queryFn: () => api.get<CourseDetail>(endpoints.course(id!)),
        enabled: !!id,
    });

    const { data: favList } = useQuery<any[]>({
        queryKey: ["favorites"],
        queryFn: () => api.get<any[]>(endpoints.favorites),
        retry: false,
    });

    const {
        data: reviews = [],
        isFetching: reviewsLoading,
        refetch: refetchReviews,
    } = useQuery<CourseReview[]>({
        queryKey: ["courseReviews", id],
        queryFn: async () => {
            const data = await api.get<any[]>(`/api/reviews?courseId=${id}`);
            if (!Array.isArray(data)) return [];
            return data.map((r: any) => ({
                id: Number(r.id),
                rating: Number(r.rating ?? 0),
                content: String(r.comment ?? ""),
                createdAt: String(r.createdAt ?? ""),
                userName: String(r.user?.nickname ?? ""),
                profileImageUrl: String(r.user?.profileImageUrl ?? ""),
                imageUrls: Array.isArray(r.imageUrls) ? r.imageUrls.map(String) : [],
            }));
        },
        enabled: !!id,
    });

    React.useEffect(() => {
        if (!favList) return;
        const ids = new Set(favList.map((f: any) => Number(f?.course?.id ?? f?.course_id ?? f?.courseId ?? f?.id)));
        setIsFav(ids.has(Number(id)));
    }, [favList, id]);

    // ── 선택형 코스 데이터 ──────────────────────────────────────────────────────
    const normalizedPlacesAll = useMemo(() => {
        const sorted = [...(course?.coursePlaces ?? [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        return sorted.map((cp) => {
            if (!cp.place) return cp;
            return {
                ...cp,
                place: {
                    ...cp.place,
                    imageUrl: cp.place.imageUrl ?? cp.place.image_url ?? null,
                    latitude: cp.place.latitude ?? cp.place.lat,
                    longitude: cp.place.longitude ?? cp.place.lng,
                    reservationUrl: cp.place.reservationUrl ?? cp.place.reservation_url ?? null,
                },
            };
        });
    }, [course?.coursePlaces]);

    const placesBySegment = useMemo(() => {
        const map: Record<string, CoursePlace[]> = {};
        for (const cp of normalizedPlacesAll) {
            const seg = cp.segment ?? "";
            if (!seg) continue;
            if (!map[seg]) map[seg] = [];
            map[seg].push(cp);
        }
        for (const seg of Object.keys(map)) {
            map[seg].sort((a, b) => (a.order_in_segment ?? 0) - (b.order_in_segment ?? 0));
        }
        return map;
    }, [normalizedPlacesAll]);

    const selectionOrderedSteps = useMemo(() => {
        if (!course?.isSelectionType) return [];
        const steps: ({ type: "fixed"; coursePlace: CoursePlace } | { type: "segment"; segment: string; options: CoursePlace[] })[] = [];
        const seenSeg = new Set<string>();
        for (const cp of normalizedPlacesAll) {
            const seg = cp.segment ?? "";
            if (!seg) {
                steps.push({ type: "fixed", coursePlace: cp });
            } else if (!seenSeg.has(seg)) {
                seenSeg.add(seg);
                steps.push({ type: "segment", segment: seg, options: placesBySegment[seg] ?? [] });
            }
        }
        return steps;
    }, [course?.isSelectionType, normalizedPlacesAll, placesBySegment]);

    // 저장된 선택이 있으면 해당 장소만 표시
    const displayPlaces = useMemo(() => {
        if (!course?.isSelectionType || !mySelection) return normalizedPlacesAll;
        return mySelection.selectedPlaceIds
            .map((pid) => normalizedPlacesAll.find(
                (cp) => Number(cp.place_id ?? cp.place?.id) === Number(pid)
            ))
            .filter(Boolean) as CoursePlace[];
    }, [course?.isSelectionType, mySelection, normalizedPlacesAll]);

    /** 목록 진입 시 1번 장소가 선택된 것처럼 초록 테두리 표시 */
    const [highlightedPlaceId, setHighlightedPlaceId] = useState<number | null>(null);
    useEffect(() => {
        if (!course) return;
        const showNormalList =
            (!course.isSelectionType || selectionOrderedSteps.length === 0 || !!mySelection) && !showSelectionUI;
        if (showNormalList && displayPlaces.length > 0) {
            const pid = displayPlaces[0]?.place?.id;
            setHighlightedPlaceId(pid != null ? Number(pid) : null);
            return;
        }
        if (course.isSelectionType && selectionOrderedSteps.length > 0 && (!mySelection || showSelectionUI)) {
            const first = selectionOrderedSteps[0];
            if (first?.type === "fixed" && first.coursePlace.place?.id != null) {
                setHighlightedPlaceId(Number(first.coursePlace.place.id));
                return;
            }
        }
        setHighlightedPlaceId(null);
    }, [course, id, displayPlaces, selectionOrderedSteps, mySelection, showSelectionUI]);

    // 선택형 초기값 세팅
    useEffect(() => {
        if (!course?.isSelectionType || selectionOrderedSteps.length === 0) return;
        if (mySelection && showSelectionUI) {
            const next: Record<string, number> = {};
            selectionOrderedSteps.forEach((step, i) => {
                if (step.type === "segment") next[step.segment] = mySelection!.selectedPlaceIds[i] ?? step.options[0]?.place_id ?? 0;
            });
            setSelectedBySegment(next);
            return;
        }
        if (mySelection && !showSelectionUI) {
            // 저장된 선택을 selectedBySegment에 반영 (지도에서 선택/비선택 구분용)
            const next: Record<string, number> = {};
            const savedSet = new Set(mySelection.selectedPlaceIds.map(Number));
            selectionOrderedSteps.forEach((step) => {
                if (step.type === "segment") {
                    const selected = step.options.find((cp) => savedSet.has(Number(cp.place_id ?? cp.place?.id)));
                    const pid = selected?.place_id ?? selected?.place?.id ?? step.options[0]?.place_id ?? step.options[0]?.place?.id;
                    if (pid != null) next[step.segment] = Number(pid);
                }
            });
            setSelectedBySegment(next);
            return;
        }
        if (!mySelection) {
            const next: Record<string, number> = {};
            selectionOrderedSteps.forEach((step) => {
                if (step.type === "segment") {
                    const pid = step.options[0]?.place_id ?? step.options[0]?.place?.id;
                    if (pid != null) next[step.segment] = pid;
                }
            });
            setSelectedBySegment(next);
        }
    }, [course?.isSelectionType, showSelectionUI, mySelection, selectionOrderedSteps]);

    // 기존 선택 불러오기
    useEffect(() => {
        if (!isAuthenticated || !id || !course?.isSelectionType) return;
        let cancelled = false;
        api.get<{ selection: { id: string; templateCourseId: number; selectedPlaceIds: number[]; createdAt: string } | null }>(
            `/api/courses/${id}/my-selection`
        ).then((data) => {
            if (!cancelled && data?.selection) setMySelection(data.selection);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [isAuthenticated, id, course?.isSelectionType]);

    const favMutation = useMutation({
        mutationFn: async (adding: boolean) => {
            if (adding) await api.post(endpoints.favorites, { courseId: Number(id) });
            else await api.delete(`${endpoints.favorites}?courseId=${id}`);
        },
        onMutate: (adding) => setIsFav(adding),
        onError: (_err, adding) => setIsFav(!adding),
        onSuccess: (_data, adding) => {
            queryClient.invalidateQueries({ queryKey: ["favorites"] });
            queryClient.invalidateQueries({ queryKey: ["users", "favorites"] });
            queryClient.invalidateQueries({ queryKey: ["users", "favorites", "header-badge"] });
            toastIdRef.current += 1;
            setToast({
                id: toastIdRef.current,
                variant: "pill",
                message: adding ? i18n("courseDetail.favoriteAdded") : i18n("courseDetail.favoriteRemoved"),
                pillMode: adding ? "fav-added" : "fav-removed",
            });
        },
    });

    const shareInFlightRef = useRef(false);
    const handleShare = useCallback(async () => {
        if (!course || shareInFlightRef.current) return;
        shareInFlightRef.current = true;
        try {
            // 공유 이벤트 DB 저장 + shareId 링크 생성
            let shareUrl = `${BASE_URL}/courses/${id}/view`;
            try {
                const res = await api.post<{ shareId: string }>("/api/share/create", {
                    templateCourseId: Number(id),
                    selectedPlaceIds: [],
                });
                if (res?.shareId) shareUrl = `${BASE_URL}/share/course/${res.shareId}`;
            } catch {
                // 실패해도 기본 URL로 공유 계속 진행
            }
            // 개인화 signal 기록 (실패해도 무시)
            api.post("/api/users/interactions", { courseId: Number(id), action: "share" }).catch(() => {});

            const message = i18n("mobile.courseScreen.shareMessage", {
                title: pickCourseTitle(course, locale as LocalePreference),
                url: shareUrl,
            });
            // iOS에서 message + url 동시 전달 시 링크가 두 번 붙는 경우가 있어 단일 필드만 사용
            await Share.share(
                Platform.OS === "ios"
                    ? { message }
                    : { message, title: pickCourseTitle(course, locale as LocalePreference) },
            );
        } catch {
            // 사용자가 시트를 닫은 경우 등 — 무시
        } finally {
            setTimeout(() => {
                shareInFlightRef.current = false;
            }, 800);
        }
    }, [course, id, i18n]);

    const handleStartCourse = useCallback(async () => {
        if (!isAuthenticated) {
            openModal("login");
            return;
        }
        if (!course) return;
        const userTier = profile?.subscriptionTier ?? (profile as any)?.subscription_tier ?? "FREE";
        const isLocked =
            (course.grade === "BASIC" && userTier === "FREE") || (course.grade === "PREMIUM" && userTier !== "PREMIUM");
        if (isLocked) {
            openModal("ticket", { context: "COURSE", courseId: Number(id), courseGrade: course.grade as "BASIC" | "PREMIUM", onUnlocked: () => queryClient.invalidateQueries({ queryKey: ["course", id] }) });
            return;
        }
        try {
            await api.post(endpoints.activeCourse, { courseId: Number(id) });
        } catch {
            Alert.alert(i18n("mobile.courseScreen.alertNotice"), i18n("mobile.courseScreen.startCourseFailed"));
            return;
        }
        await queryClient.invalidateQueries({ queryKey: ["users", "active-course"] });
        showToast(i18n("mobile.courseScreen.courseStarted"), "🗺️");
        setTimeout(() => router.push("/(tabs)" as any), 800);
    }, [isAuthenticated, course, id, profile, queryClient, i18n, showToast]);

    // 선택형 코스: 장소 선택 후 저장
    const handleStartSelectionCourse = useCallback(async () => {
        if (!isAuthenticated) { openModal("login"); return; }
        if (!course) return;
        const userTier = profile?.subscriptionTier ?? (profile as any)?.subscription_tier ?? "FREE";
        const isLocked = (course.grade === "BASIC" && userTier === "FREE") || (course.grade === "PREMIUM" && userTier !== "PREMIUM");
        if (isLocked) { openModal("ticket", { context: "COURSE", courseId: Number(id), courseGrade: course.grade as "BASIC" | "PREMIUM", onUnlocked: () => queryClient.invalidateQueries({ queryKey: ["course", id] }) }); return; }
        const selectedPlaceIds = selectionOrderedSteps
            .map((step) => step.type === "fixed" ? step.coursePlace.place_id : selectedBySegment[step.segment])
            .filter((pid): pid is number => pid != null && pid > 0);
        if (selectedPlaceIds.length !== selectionOrderedSteps.length) {
            showToast(i18n("courseDetail.selectEachSegment"), "ℹ️");
            return;
        }
        setSelectionLoading(true);
        try {
            const data = await api.post<{ success?: boolean; selection?: { id: string; templateCourseId: number; selectedPlaceIds: number[] } }>(
                `/api/courses/${id}/my-selection`,
                { selectedPlaceIds }
            );
            if (data?.success && data?.selection) {
                setMySelection({ ...data.selection, createdAt: new Date().toISOString() });
                setShowSelectionUI(false);
                await api.post(endpoints.activeCourse, { courseId: Number(id) });
                await queryClient.invalidateQueries({ queryKey: ["users", "active-course"] });
                showToast(i18n("courseDetail.courseSavedToast"), "✅");
                router.push("/(tabs)" as any);
            } else {
                showToast(i18n("mobile.courseScreen.saveFailedToast"), "❌");
            }
        } catch {
            showToast(i18n("mobile.courseScreen.saveFailedToast"), "❌");
        } finally {
            setSelectionLoading(false);
        }
    }, [isAuthenticated, course, id, profile, selectionOrderedSteps, selectedBySegment, showToast, queryClient, i18n]);

    const handleMemoryRecord = useCallback(async () => {
        if (!isAuthenticated) { openModal("login"); return; }
        try {
            const data = await api.get<{ count: number; limit: number | null }>("/api/users/me/memory-count");
            if (data.limit !== null && data.count >= data.limit) {
                openModal("memoryLimit");
                return;
            }
        } catch {}
        router.push(`/courses/${id}/start` as any);
    }, [isAuthenticated, id]);

    const handleSwitchCourse = useCallback(() => {
        Alert.alert(
            i18n("mobile.courseScreen.switchCourseTitle"),
            i18n("mobile.courseScreen.switchCourseMessage"),
            [
                { text: i18n("mobile.courseScreen.cancel"), style: "cancel" },
                {
                    text: i18n("mobile.courseScreen.switchCourseConfirm"),
                    onPress: async () => {
                        try {
                            await api.post(endpoints.activeCourse, { courseId: Number(id) });
                        } catch {
                            Alert.alert(i18n("mobile.courseScreen.alertNotice"), i18n("mobile.courseScreen.switchCourseFailed"));
                            return;
                        }
                        await queryClient.invalidateQueries({ queryKey: ["users", "active-course"] });
                        router.push("/(tabs)" as any);
                    },
                },
            ],
        );
    }, [id, queryClient, i18n]);

    const handleSubmitReview = useCallback(async () => {
        if (!id) return;
        const content = reviewContent.trim();
        if (content.length < 10) {
            Alert.alert(i18n("mobile.courseScreen.alertNotice"), i18n("mobile.courseScreen.reviewMinLength"));
            return;
        }
        setReviewSubmitting(true);
        try {
            await api.post("/api/reviews", {
                courseId: Number(id),
                rating: reviewRating,
                content,
                isPublic: true,
                imageUrls: reviewImageUrls,
            });
            setShowReviewModal(false);
            setReviewContent("");
            setReviewRating(5);
            setReviewImageLocalUris([]);
            setReviewImageUrls([]);
            showToast(i18n("mobile.courseScreen.reviewPosted"), "✅");
            refetchReviews();
        } catch (e: any) {
            Alert.alert(i18n("mobile.courseScreen.reviewSubmitFailTitle"), e?.message ?? i18n("mobile.courseScreen.tryAgainLater"));
        } finally {
            setReviewSubmitting(false);
        }
    }, [id, reviewContent, reviewRating, reviewImageUrls, refetchReviews, showToast, i18n]);

    const MAX_REVIEW_IMAGES = 5;
    const handlePickReviewImage = useCallback(async () => {
        if (!id) return;
        const remaining = MAX_REVIEW_IMAGES - reviewImageLocalUris.length;
        if (remaining <= 0) return;
        try {
            const ImagePicker = require("expo-image-picker");
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert(i18n("mobile.courseScreen.permRequired"), i18n("mobile.courseScreen.permPhotos"));
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                selectionLimit: remaining,
                quality: 0.85,
            });
            if (result.canceled || !result.assets?.length) return;

            const newUris = result.assets.map((a: any) => a.uri);
            setReviewImageLocalUris((prev) => [...prev, ...newUris].slice(0, MAX_REVIEW_IMAGES));
            setReviewUploadingImage(true);
            try {
                const uploads = await Promise.all(
                    newUris.map((uri: string) =>
                        uploadImageViaPresign(uri, String(id), {
                            presign: i18n("courseStart.presignUrlError"),
                            putFail: i18n("courseStart.imageUploadPutError"),
                        })
                    )
                );
                setReviewImageUrls((prev) => [...prev, ...uploads].slice(0, MAX_REVIEW_IMAGES));
            } catch (e: any) {
                setReviewImageLocalUris((prev) => prev.slice(0, prev.length - newUris.length));
                Alert.alert(i18n("mobile.courseScreen.imageUploadFailTitle"), e?.message ?? i18n("mobile.courseScreen.tryAgainLater"));
            } finally {
                setReviewUploadingImage(false);
            }
        } catch {
            Alert.alert(i18n("mobile.courseScreen.alertNotice"), i18n("mobile.courseScreen.imagePickerBuildOnly"));
        }
    }, [id, i18n, reviewImageLocalUris.length]);

    const handleReviewImagePress = useCallback((images: string[], index: number) => {
        setReviewPreviewImages(images);
        setReviewPreviewIndex(index);
    }, []);

    // 카드 탭 → 선택 하이라이트 + 장소 상세 모달
    const handlePlaceCardPress = useCallback((cp: CoursePlace) => {
        if (cp.place?.id != null) setHighlightedPlaceId(Number(cp.place.id));
        if (cp.place) setSelectedPlace({ place: cp.place, tipsRow: coursePlaceToTipsRow(cp) });
    }, []);

    // 꿀팁 칩 탭 → 장소 상세 모달 열기
    const handlePlaceInfoPress = useCallback((cp: CoursePlace) => {
        if (cp.place?.id != null) setHighlightedPlaceId(Number(cp.place.id));
        if (cp.place) setSelectedPlace({ place: cp.place, tipsRow: coursePlaceToTipsRow(cp) });
    }, []);

    // 팁 잠금 탭 → TicketPlans 모달 열기
    const handleTipLockPress = useCallback(() => {
        if (!isAuthenticated) { openModal("login"); return; }
        if (!course) return;
        openModal("ticket", {
            context: "COURSE",
            courseId: Number(id),
            courseGrade: (course.grade === "PREMIUM" ? "PREMIUM" : "BASIC") as "BASIC" | "PREMIUM",
            onUnlocked: () => queryClient.invalidateQueries({ queryKey: ["course", id] }),
        });
    }, [isAuthenticated, course, id, queryClient, openModal]);

    const handleReserve = useCallback((url: string) => {
        setScreenReservationUrl(url);
    }, []);

    if (isLoading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={["top"]}>
                <PageLoadingOverlay overlay={false} message={i18n("mobile.courseScreen.loadingCourse")} />
            </SafeAreaView>
        );
    }

    if (isError || !course) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={["top"]}>
                <TouchableOpacity style={{ marginTop: insets.top + 12, padding: 16 }} onPress={() => router.back()}>
                    <Text style={{ color: Colors.brandGreen, fontWeight: "500" }}>{i18n("mobile.courseScreen.backArrow")}</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: t.textMuted }}>{i18n("mobile.courseScreen.courseLoadError")}</Text>
                </View>
            </SafeAreaView>
        );
    }

    const grade = GRADE_META[course.grade] ?? GRADE_META.FREE;
    const normalizedPlaces = normalizedPlacesAll;
    const regionLabel = translateCourseRegion(course.region, i18n) || (course as any).location || i18n("courses.regionSeoul");
    const heroImage = resolveImageUrl(course.imageUrl) ?? getPlaceImageUrl(normalizedPlaces[0]?.place);
    const openMapForIndex = (idx: number) => {
        setActivePlaceIndex(idx);
        setMapSelectedIndex(idx);
        setMapRouteMode(idx === 0 ? "full" : "segment");
        setShowCourseMapModal(true);
    };
    const openFullRouteMap = () => {
        setActivePlaceIndex(0);
        setMapSelectedIndex(0);
        setMapRouteMode("full");
        setShowCourseMapModal(true);
    };
    /** 하단 CTA 바 위로 띄운 고정 FAB (대략: 패딩 + 버튼열 높이) */
    const mapFabBottom = insets.bottom + 88;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={["top"]}>
            <AppHeaderWithModals />
            <ScrollView showsVerticalScrollIndicator={false} scrollEventThrottle={16} overScrollMode="never" decelerationRate="fast">
                {/* ── 히어로 (웹 CourseDetailClient: h-[450px], 그라데이션, 제목·메타는 히어로 하단) ── */}
                <View style={s.heroWrap}>
                    {heroImage ? (
                        <Image source={{ uri: heroImage }} style={s.heroImg} fadeDuration={0} />
                    ) : (
                        <View style={[s.heroImg, { backgroundColor: "#e5e7eb" }]} />
                    )}
                    <HeroGradientOverlay />
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={[s.heroBackBtn, { top: 12, left: 14 }]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="chevron-back" size={28} color="#fff" style={s.heroBackIconShadow} />
                    </TouchableOpacity>

                    {/* 히어로 하단: 상황·예산 칩 + 제목 + 메타 칩 (웹과 동일 구조) */}
                    <View style={[s.heroFooter, { paddingBottom: 16 }]}>
                        <View style={s.heroChipRowTop}>
                            {course.target_situation ? (
                                <View style={s.heroChipDark}>
                                    <Text style={s.heroChipDarkText}>
                                        #{translateTargetSituation(course.target_situation, locale as CourseUiLocale, i18n)}
                                    </Text>
                                </View>
                            ) : null}
                            {course.budget_range ? (
                                <View style={s.heroChipDark}>
                                    <Text style={s.heroChipDarkText}>💸 {translateBudgetRange(course.budget_range, locale as CourseUiLocale)}</Text>
                                </View>
                            ) : null}
                        </View>

                        <Text style={s.heroTitle} numberOfLines={3}>
                            {pickCourseTitle(course, locale as LocalePreference)}
                        </Text>
                        {course.description ? (
                            <Text style={s.heroSubTitle} numberOfLines={2}>
                                {pickCourseDescription(course, locale as LocalePreference)}
                            </Text>
                        ) : null}

                        <View style={s.heroMetaRow}>
                            <View style={s.heroMetaPill}>
                                <Text style={s.heroMetaPillText}>📍 {regionLabel}</Text>
                            </View>
                            <View style={s.heroMetaPill}>
                                <Text style={s.heroMetaPillText}>
                                    {i18n("mobile.courseScreen.metaSpotsCount", { count: normalizedPlaces.length })}
                                </Text>
                            </View>
                            {course.duration ? (
                                <View style={s.heroMetaPill}>
                                    <Text style={s.heroMetaPillText}>⏳ {translateDuration(course.duration, locale as CourseUiLocale)}</Text>
                                </View>
                            ) : null}
                            {course.rating != null && course.rating > 0 ? (
                                <View style={s.heroMetaPill}>
                                    <Text style={s.heroMetaPillText}>
                                        <Text style={{ color: "#facc15" }}>★</Text> {course.rating}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </View>

                {/* ── 메인 카드: 히어로와 겹침 (웹: rounded-2xl bg-white shadow-sm border) ── */}
                <View style={s.mainOuter}>
                    <View
                        style={[s.mainCard, { backgroundColor: t.card, borderColor: t.isDark ? "#374151" : "#f3f4f6" }]}
                    >
                        {/* ── 선택형 코스: 첫 방문 또는 "코스 수정" 시 ── */}
                        {course.isSelectionType && selectionOrderedSteps.length > 0 && (!mySelection || showSelectionUI) && (
                            <View style={{ position: "relative" }}>
                                {/* 세로 점선 타임라인 (웹과 동일: absolute left) */}
                                <View style={s.selTimelineLine} />
                                <View style={{ gap: 24 }}>
                                    {selectionOrderedSteps.map((step, stepIdx) => {
                                        // 이전 해결된 장소 좌표 계산
                                        const getPrevLatLng = (): { lat: number; lng: number } | null => {
                                            for (let i = stepIdx - 1; i >= 0; i--) {
                                                const s = selectionOrderedSteps[i];
                                                if (s.type === "fixed") {
                                                    const c = getPlaceLatLng(s.coursePlace.place);
                                                    if (c) return c;
                                                } else {
                                                    const sel = s.options.find((o) => Number(o.place_id) === Number(selectedBySegment[s.segment]));
                                                    const c = getPlaceLatLng(sel?.place);
                                                    if (c) return c;
                                                }
                                            }
                                            return null;
                                        };
                                        const prev = getPrevLatLng();

                                        if (step.type === "fixed") {
                                            const cp = step.coursePlace;
                                            const curCoords = getPlaceLatLng(cp.place);
                                            const walkMins = prev && curCoords
                                                ? getWalkingMinutes(prev.lat, prev.lng, curCoords.lat, curCoords.lng)
                                                : null;
                                            return (
                                                <View key={`fixed-${cp.id ?? stepIdx}`} style={{ zIndex: 1 }}>
                                                    {walkMins != null && <WalkingConnector minutes={walkMins} />}
                                                    <PlaceCard
                                                        cp={cp}
                                                        index={stepIdx}
                                                        onPress={handlePlaceCardPress}
                                                        onInfoPress={handlePlaceInfoPress}
                                                        isSelected={
                                                            cp.place?.id != null &&
                                                            highlightedPlaceId !== null &&
                                                            Number(cp.place.id) === highlightedPlaceId
                                                        }
                                                        onReserve={handleReserve}
                                                        showConfirmed
                                                        tipLocked={course?.userTier === "FREE"}
                                                        onTipLockPress={handleTipLockPress}
                                                    />
                                                </View>
                                            );
                                        }

                                        // 세그먼트 선택 카드
                                        const { segment: seg, options } = step;
                                        const selectedId = selectedBySegment[seg];
                                        const selectedOpt = options.find((o) => {
                                            const pid = o.place_id ?? o.place?.id;
                                            return pid != null && Number(pid) === Number(selectedId);
                                        });
                                        const walkMins = prev && getPlaceLatLng(selectedOpt?.place)
                                            ? getWalkingMinutes(prev.lat, prev.lng, getPlaceLatLng(selectedOpt!.place)!.lat, getPlaceLatLng(selectedOpt!.place)!.lng)
                                            : null;

                                        return (
                                            <View key={`seg-${seg}`} style={{ zIndex: 1 }}>
                                                {walkMins != null && <WalkingConnector minutes={walkMins} />}
                                                <View style={s.selStepRow}>
                                                    {/* 왼쪽 번호 배지 (웹: 40px #99c08e) */}
                                                    <View style={s.selStepNum}>
                                                        <Text style={s.selStepNumText}>{stepIdx + 1}</Text>
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        {/* 웹과 동일: "어디로 갈까요?" 작은 텍스트 → "둘 중 하나를 선택하세요" 굵게 */}
                                                        <Text style={[s.selSegPrompt, { color: t.textMuted }]}>
                                                            {i18n("courseDetail.selectSegmentPrompt")}
                                                        </Text>
                                                        <Text style={[s.selSegLabel, { color: t.text }]}>
                                                            {i18n("courseDetail.whereDoYouWant")}
                                                        </Text>
                                                        {/* 가로 스크롤 후보 카드 (웹: 이미지 좌측 80px + 텍스트 우측) */}
                                                        <ScrollView
                                                            horizontal
                                                            showsHorizontalScrollIndicator={false}
                                                            contentContainerStyle={s.selCandidateScroll}
                                                            style={{ marginTop: 10 }}
                                                        >
                                                            {options.map((cp) => {
                                                                const cpPlaceId = cp.place_id ?? cp.place?.id;
                                                                const isChosen = cpPlaceId != null && Number(cpPlaceId) === Number(selectedId);
                                                                const imgUri = getPlaceImageUrl(cp.place);
                                                                return (
                                                                    <TouchableOpacity
                                                                        key={cp.id ?? cp.place_id}
                                                                        onPress={() => { if (cpPlaceId != null) setSelectedBySegment((prev) => ({ ...prev, [seg]: cpPlaceId })); }}
                                                                        activeOpacity={0.85}
                                                                        style={[
                                                                            s.candidateCard,
                                                                            {
                                                                                borderColor: isChosen ? "#22c55e" : t.isDark ? "#374151" : "#d1d5db",
                                                                                borderWidth: isChosen ? 2 : 1,
                                                                                backgroundColor: t.isDark ? "#1a241b" : "#fff",
                                                                            },
                                                                        ]}
                                                                    >
                                                                        {/* 이미지(좌) + 텍스트(우) — 웹과 동일 */}
                                                                        <View style={{ flexDirection: "row" }}>
                                                                            <View style={s.candidateImgWrap}>
                                                                                {imgUri ? (
                                                                                    <Image source={{ uri: imgUri }} style={s.candidateImg} contentFit="cover" />
                                                                                ) : (
                                                                                    <View style={[s.candidateImg, { backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }]}>
                                                                                        <Text style={{ fontSize: 18 }}>📍</Text>
                                                                                    </View>
                                                                                )}
                                                                                {isChosen && (
                                                                                    <View style={s.candidateCheckBadge}>
                                                                                        <Text style={{ fontSize: 9, color: "#fff", fontWeight: "700" }}>✓</Text>
                                                                                    </View>
                                                                                )}
                                                                            </View>
                                                                            <View style={s.candidateInfo}>
                                                                                <Text style={[s.candidateName, { color: t.text }]} numberOfLines={2}>
                                                                                    {cp.place ? pickPlaceName(cp.place, locale as LocalePreference) : ""}
                                                                                </Text>
                                                                                <Text style={[s.candidateSub, { color: t.textMuted }]} numberOfLines={1}>
                                                                                    {cp.recommended_time?.trim()
                                                                                        ? translateCourseFreeformKoText(cp.recommended_time, locale as CourseUiLocale, i18n)
                                                                                        : cp.place ? pickPlaceAddress(cp.place, locale as LocalePreference) : ""}
                                                                                </Text>
                                                                            </View>
                                                                        </View>
                                                                        {/* 정보 버튼 (웹: 하단 전체 너비, 에메랄드 배경) */}
                                                                        <TouchableOpacity
                                                                            style={[s.candidateInfoBtn, {
                                                                                borderTopColor: t.isDark ? "#374151" : "#e5e7eb",
                                                                                backgroundColor: t.isDark ? "rgba(16,185,129,0.08)" : "#ecfdf5",
                                                                            }]}
                                                                            onPress={() => cp.place && setSelectedPlace({ place: cp.place, tipsRow: coursePlaceToTipsRow(cp) })}
                                                                            hitSlop={6}
                                                                        >
                                                                            <Text style={s.candidateInfoBtnText}>💡 {i18n("courseDetail.infoShort")}</Text>
                                                                        </TouchableOpacity>
                                                                    </TouchableOpacity>
                                                                );
                                                            })}
                                                        </ScrollView>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* ── 장소 목록: 일반 코스 or 저장된 선택형 ── */}
                        {(!course.isSelectionType || selectionOrderedSteps.length === 0 || mySelection) && !showSelectionUI && (
                            <View style={{ gap: 8 }}>
                                {mySelection && course.isSelectionType && (
                                    <TouchableOpacity
                                        onPress={() => setShowSelectionUI(true)}
                                        style={s.editSelectionBtn}
                                    >
                                        <Text style={s.editSelectionBtnText}>{i18n("courseDetail.editCourse")}</Text>
                                    </TouchableOpacity>
                                )}
                                {displayPlaces.map((cp, i) => {
                                    const a = i > 0 ? displayPlaces[i - 1]?.place : null;
                                    const b = cp.place;
                                    const walkMins = a?.latitude && a?.longitude && b?.latitude && b?.longitude
                                        ? getWalkingMinutes(a.latitude, a.longitude, b.latitude, b.longitude)
                                        : null;
                                    return (
                                        <React.Fragment key={i}>
                                            {walkMins != null ? <WalkingConnector minutes={walkMins} /> : null}
                                            <PlaceCard
                                                cp={cp}
                                                index={i}
                                                onPress={handlePlaceCardPress}
                                                onInfoPress={handlePlaceInfoPress}
                                                isSelected={
                                                    cp.place?.id != null &&
                                                    highlightedPlaceId !== null &&
                                                    Number(cp.place.id) === highlightedPlaceId
                                                }
                                                onReserve={handleReserve}
                                                tipLocked={course?.userTier === "FREE"}
                                                onTipLockPress={handleTipLockPress}
                                            />
                                        </React.Fragment>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                </View>

                {/* ── 리뷰 섹션 (웹: rounded-2xl border p-6) ── */}
                <View
                    style={[
                        s.reviewSection,
                        {
                            backgroundColor: t.isDark ? "rgba(26,36,27,0.85)" : "#f9fafb",
                            borderColor: t.isDark ? "#374151" : "#e5e7eb",
                        },
                    ]}
                >
                    <View style={s.reviewHeader}>
                        <Text style={[s.reviewSectionTitle, { color: t.text }]}>
                            {i18n("mobile.courseScreen.usageReviewsHeading", { count: reviews.length })}
                        </Text>
                        <TouchableOpacity style={s.reviewWriteBtn} onPress={() => setShowReviewModal(true)}>
                            <Text style={s.reviewWriteBtnText}>{i18n("mobile.courseScreen.reviewWrite")}</Text>
                        </TouchableOpacity>
                    </View>
                    {reviewsLoading ? (
                        <Text style={[s.reviewEmpty, { color: t.textMuted }]}>{i18n("mobile.courseScreen.reviewsLoading")}</Text>
                    ) : reviews.length === 0 ? null : (
                        <View style={{ gap: 12 }}>
                            {reviews.slice(0, reviewShowCount).map((item) => (
                                <ReviewCard
                                    key={item.id}
                                    item={item}
                                    onImagePress={handleReviewImagePress}
                                />
                            ))}
                            {reviews.length > reviewShowCount && (
                                <TouchableOpacity
                                    onPress={() => setReviewShowCount((c) => c + 5)}
                                    style={[s.reviewMoreBtn, { borderColor: t.border }]}
                                >
                                    <Text style={[s.reviewMoreBtnText, { color: t.textMuted }]}>
                                        {i18n("mobile.courseScreen.showMoreReviews", { n: reviews.length - reviewShowCount })}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                <View style={{ height: insets.bottom + 110 }} />
            </ScrollView>

            {/* 우하단 고정 지도 FAB (스크롤과 무관하게 CTA 바 위에 고정) */}
            {normalizedPlaces.length > 0 ? (
                <TouchableOpacity
                    style={[s.mapFabFixed, { bottom: mapFabBottom }]}
                    onPress={openFullRouteMap}
                    activeOpacity={0.88}
                    accessibilityLabel={i18n("mobile.courseScreen.mapFabA11y")}
                >
                    <Ionicons name="location" size={22} color="#fff" />
                </TouchableOpacity>
            ) : null}

            {/* ── 하단 CTA 바 ────────────────────────────────────────────── */}
            <View
                style={[
                    s.ctaBar,
                    { backgroundColor: t.card, borderTopColor: t.border, paddingBottom: insets.bottom + 12 },
                ]}
            >
                {/* 찜하기 */}
                <TouchableOpacity
                    style={s.ctaIconBtn}
                    onPress={() => {
                        if (!isAuthenticated) { openModal("login"); return; }
                        if (favMutation.isPending) return;
                        favMutation.mutate(!isFav);
                    }}
                >
                    <Ionicons
                        name={isFav ? "heart" : "heart-outline"}
                        size={28}
                        color={isFav ? "#ef4444" : t.textMuted}
                    />
                    <Text style={[textFontForLocale(locale), s.ctaIconLabel, { color: isFav ? "#ef4444" : t.textMuted }]}>
                        {i18n("courseDetail.favorite")}
                    </Text>
                </TouchableOpacity>
                {/* 공유하기 */}
                <TouchableOpacity style={s.ctaIconBtn} onPress={handleShare}>
                    <Ionicons name="share-outline" size={28} color={t.textMuted} />
                    <Text style={[textFontForLocale(locale), s.ctaIconLabel, { color: t.textMuted }]}>
                        {i18n("courseDetail.share")}
                    </Text>
                </TouchableOpacity>
                {/* 코스 CTA — 3가지 상태 */}
                {isAuthenticated && activeCourse?.courseId === Number(id) ? (
                    <View style={s.ctaMainColumn}>
                        <Text style={[textFontForLocale(locale), s.ctaStatusText, { color: t.textMuted, textAlign: "center" }]}>
                            {i18n("mobile.courseScreen.inProgressThisCourse")}
                        </Text>
                        <TouchableOpacity
                            style={[s.ctaMainBtn, s.ctaMainBtnColumn, { minHeight: 48, paddingVertical: 12 }]}
                            onPress={handleMemoryRecord}
                            activeOpacity={0.85}
                        >
                            <Text style={[textFontForLocale(locale), s.ctaMainBtnText]}>
                                {i18n("mobile.courseScreen.memoryRecordPersonal")}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : isAuthenticated && activeCourse && activeCourse.courseId !== Number(id) ? (
                    <View style={s.ctaMainColumn}>
                        <Text style={[textFontForLocale(locale), s.ctaStatusText, { color: t.textMuted, textAlign: "center" }]}>
                            {i18n("mobile.courseScreen.alreadyOtherCourse")}
                        </Text>
                        <TouchableOpacity
                            style={[
                                s.ctaMainBtn,
                                s.ctaMainBtnColumn,
                                { minHeight: 48, paddingVertical: 12, backgroundColor: "#374151" },
                            ]}
                            onPress={handleSwitchCourse}
                            activeOpacity={0.85}
                        >
                            <Text style={[textFontForLocale(locale), s.ctaMainBtnText]}>
                                {i18n("mobile.courseScreen.switchOtherCourse")}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : course?.isSelectionType && selectionOrderedSteps.length > 0 && (!mySelection || showSelectionUI) ? (
                    <TouchableOpacity
                        style={[s.ctaMainBtn, s.ctaMainBtnWide, selectionLoading && { opacity: 0.7 }]}
                        onPress={handleStartSelectionCourse}
                        disabled={selectionLoading}
                        activeOpacity={0.85}
                    >
                        {selectionLoading
                            ? <ActivityIndicator size="small" color="#fff" />
                            : (
                                <Text style={[textFontForLocale(locale), s.ctaMainBtnText]}>
                                    {mySelection ? i18n("mobile.courseScreen.saveSelection") : i18n("courseDetail.startCourse")}
                                </Text>
                            )
                        }
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[s.ctaMainBtn, s.ctaMainBtnWide]} onPress={handleStartCourse} activeOpacity={0.85}>
                        <Text style={[textFontForLocale(locale), s.ctaMainBtnText]}>{i18n("courseDetail.startCourse")}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* 장소 상세 모달 */}
            {selectedPlace && (
                <PlaceDetailModal
                    place={selectedPlace.place}
                    tipsRow={selectedPlace.tipsRow}
                    onClose={() => setSelectedPlace(null)}
                    isLoggedIn={!!profile}
                    tipLocked={course?.userTier === "FREE"}
                    onTipLockPress={handleTipLockPress}
                />
            )}

            <CourseMapModal
                visible={showCourseMapModal}
                places={
                    course.isSelectionType && selectionOrderedSteps.length > 0
                        ? normalizedPlacesAll
                        : displayPlaces
                }
                selectedIndex={mapSelectedIndex}
                routeMode={mapRouteMode}
                onSelectIndex={(idx) => {
                    setMapSelectedIndex(idx);
                    setMapRouteMode(idx === 0 ? "full" : "segment");
                    setActivePlaceIndex(idx);
                }}
                onResetRoute={() => {
                    setMapSelectedIndex(null);
                    setMapRouteMode("full");
                    setActivePlaceIndex(null);
                }}
                onClose={() => setShowCourseMapModal(false)}
                onOpenDetail={(place, tipsRow) => {
                    setShowCourseMapModal(false);
                    setSelectedPlace({ place, tipsRow });
                }}
                onReserve={(url) => setScreenReservationUrl(url)}
                selectionSteps={
                    course.isSelectionType && selectionOrderedSteps.length > 0
                        ? selectionOrderedSteps
                        : undefined
                }
                selectedBySegment={
                    course.isSelectionType ? selectedBySegment : undefined
                }
                onSegmentOptionSelect={course.isSelectionType ? (seg, pid) => {
                    setSelectedBySegment((prev) => ({ ...prev, [seg]: pid }));
                    setHighlightedPlaceId(pid);
                } : undefined}
            />

            {/* 예약 WebView 모달 */}
            <Modal
                visible={!!screenReservationUrl}
                animationType="slide"
                transparent
                onRequestClose={() => setScreenReservationUrl(null)}
                {...MODAL_ANDROID_PROPS}
            >
                <View style={s.screenReserveOverlay}>
                    <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setScreenReservationUrl(null)} />
                    <View style={s.screenReserveSheet}>
                        <View style={[s.reserveWebHeader, { borderBottomColor: "#e5e7eb", backgroundColor: "#fff" }]}>
                            <TouchableOpacity
                                onPress={() => setScreenReservationUrl(null)}
                                hitSlop={10}
                                style={s.reserveWebBackBtn}
                            >
                                <Ionicons name="chevron-down" size={22} color="#111827" />
                            </TouchableOpacity>
                            <Text style={[s.reserveWebTitle, { color: "#111827" }]} numberOfLines={1}>
                                {i18n("courses.reserve")}
                            </Text>
                            <TouchableOpacity
                                onPress={() => screenReservationUrl && Linking.openURL(screenReservationUrl)}
                                hitSlop={10}
                                style={s.reserveWebBackBtn}
                            >
                                <Ionicons name="open-outline" size={19} color="#6b7280" />
                            </TouchableOpacity>
                        </View>
                        {screenReservationUrl ? (
                            <WebView
                                source={{ uri: screenReservationUrl }}
                                style={{ flex: 1 }}
                                javaScriptEnabled
                                domStorageEnabled
                                allowsInlineMediaPlayback
                                startInLoadingState
                                renderLoading={() => (
                                    <View
                                        style={[
                                            StyleSheet.absoluteFillObject,
                                            { alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
                                        ]}
                                    >
                                        <ActivityIndicator color="#7aa06f" />
                                    </View>
                                )}
                            />
                        ) : null}
                    </View>
                </View>
            </Modal>

            {/* 리뷰 이미지 프리뷰 */}
            <Modal
                visible={reviewPreviewImages.length > 0}
                transparent
                animationType="fade"
                onRequestClose={() => setReviewPreviewImages([])}
                {...MODAL_ANDROID_PROPS}
            >
                <Pressable style={s.reviewPreviewBackdrop} onPress={() => setReviewPreviewImages([])}>
                    <Pressable onPress={(e) => e.stopPropagation()} style={s.reviewPreviewInner}>
                        <Image
                            source={{ uri: reviewPreviewImages[reviewPreviewIndex] }}
                            style={s.reviewPreviewImg}
                            resizeMode="contain"
                        />
                        {reviewPreviewImages.length > 1 && (
                            <View style={s.reviewPreviewNav}>
                                <TouchableOpacity
                                    onPress={() => setReviewPreviewIndex((i) => (i > 0 ? i - 1 : reviewPreviewImages.length - 1))}
                                    style={s.reviewPreviewNavBtn}
                                >
                                    <Ionicons name="chevron-back" size={24} color="#fff" />
                                </TouchableOpacity>
                                <Text style={s.reviewPreviewCounter}>
                                    {reviewPreviewIndex + 1} / {reviewPreviewImages.length}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setReviewPreviewIndex((i) => (i < reviewPreviewImages.length - 1 ? i + 1 : 0))}
                                    style={s.reviewPreviewNavBtn}
                                >
                                    <Ionicons name="chevron-forward" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        )}
                        <TouchableOpacity style={s.reviewPreviewClose} onPress={() => setReviewPreviewImages([])}>
                            <Ionicons name="close" size={22} color="#fff" />
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal
                visible={showReviewModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowReviewModal(false)}
                {...MODAL_ANDROID_PROPS}
            >
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
                >
                    <Pressable
                        style={s.overlay}
                        onPress={() => {
                            setShowReviewModal(false);
                            setReviewImageLocalUris([]);
                            setReviewImageUrls([]);
                        }}
                    >
                        <Pressable
                            style={[s.modalSheet, s.reviewModalSheet, { backgroundColor: t.card, paddingBottom: Math.max(20, insets.bottom + 8) }]}
                            onPress={(e) => e.stopPropagation()}
                        >
                        <View style={[s.handle, { backgroundColor: t.border }]} />
                        {/* 헤더: 타이틀 + X 버튼 */}
                        <View style={s.reviewModalHeader}>
                            <Text style={[s.modalTitle, { color: t.text, textAlign: "left", marginBottom: 0 }]}>
                                {i18n("mobile.courseScreen.reviewModalTitle")}
                            </Text>
                            <TouchableOpacity
                                style={[s.loginModalClose, { backgroundColor: t.surface, position: "relative", top: 0, right: 0 }]}
                                onPress={() => {
                                    setShowReviewModal(false);
                                    setReviewImageLocalUris([]);
                                    setReviewImageUrls([]);
                                }}
                                disabled={reviewSubmitting}
                            >
                                <Ionicons name="close" size={16} color={t.textMuted} />
                            </TouchableOpacity>
                        </View>
                        {/* 코스 이름 박스 */}
                        <View style={[s.reviewCourseName, { backgroundColor: t.surface }]}>
                            <Text style={{ fontSize: 11, color: t.textMuted, marginBottom: 2 }}>{i18n("mobile.courseScreen.reviewTargetLabel")}</Text>
                            <Text style={{ fontSize: 14, fontWeight: "500", color: t.text }} numberOfLines={2}>{pickCourseTitle(course, locale as LocalePreference)}</Text>
                        </View>
                        <Text style={[s.reviewModalFieldLabel, { color: t.text }]}>{i18n("mobile.courseScreen.reviewRatingLabel")}</Text>
                        <View style={s.reviewRatingRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity
                                    key={star}
                                    onPress={() => setReviewRating(star)}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                >
                                    <Text
                                        style={[
                                            s.reviewStarBtn,
                                            { color: star <= reviewRating ? "#f59e0b" : "#d1d5db" },
                                        ]}
                                    >
                                        ★
                                    </Text>
                                </TouchableOpacity>
                            ))}
                            <Text style={[s.reviewRatingCount, { color: t.textMuted }]}>{reviewRating} / 5</Text>
                        </View>
                        <Text style={[s.reviewModalFieldLabel, { color: t.text, marginTop: 4 }]}>{i18n("mobile.courseScreen.reviewContentLabel")}</Text>
                        <TextInput
                            value={reviewContent}
                            onChangeText={setReviewContent}
                            placeholder={i18n("mobile.courseScreen.reviewPlaceholder")}
                            placeholderTextColor={t.textSubtle}
                            multiline
                            maxLength={500}
                            style={[
                                s.reviewInput,
                                { color: t.text, borderColor: t.border, backgroundColor: t.surface },
                            ]}
                        />
                        <Text style={[s.reviewCharCount, { color: reviewContent.length < 10 ? "#ef4444" : t.textSubtle }]}>{reviewContent.length} / 500</Text>
                        <Text style={[s.reviewModalFieldLabel, { color: t.text }]}>{i18n("mobile.courseScreen.reviewPhotoOptional")}</Text>
                        <View style={s.reviewImageGrid}>
                            {reviewImageLocalUris.map((uri, idx) => (
                                <View key={idx} style={s.reviewImageThumb}>
                                    <Image source={{ uri }} style={s.reviewImageThumbImg} contentFit="cover" fadeDuration={0} />
                                    <TouchableOpacity
                                        style={s.reviewImageRemoveBtn}
                                        onPress={() => {
                                            setReviewImageLocalUris((prev) => prev.filter((_, i) => i !== idx));
                                            setReviewImageUrls((prev) => prev.filter((_, i) => i !== idx));
                                        }}
                                        disabled={reviewUploadingImage || reviewSubmitting}
                                    >
                                        <Ionicons name="close" size={12} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {reviewImageLocalUris.length < MAX_REVIEW_IMAGES && (
                                <TouchableOpacity
                                    style={[s.reviewImageAddBtn, { borderColor: t.border }]}
                                    onPress={handlePickReviewImage}
                                    disabled={reviewUploadingImage || reviewSubmitting}
                                    activeOpacity={0.7}
                                >
                                    {reviewUploadingImage ? (
                                        <ActivityIndicator size="small" color={Colors.brandGreen} />
                                    ) : (
                                        <>
                                            <Ionicons name="add" size={22} color={t.textMuted} />
                                            <Text style={[s.reviewImageAddText, { color: t.textMuted }]}>
                                                {`${reviewImageLocalUris.length}/${MAX_REVIEW_IMAGES}`}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                        <View style={[s.reviewModalActions, { marginTop: 16 }]}>
                            <TouchableOpacity
                                style={[s.reviewCancelHalfBtn, { borderColor: t.border, backgroundColor: t.surface }]}
                                onPress={() => {
                                    setShowReviewModal(false);
                                    setReviewImageLocalUris([]);
                                    setReviewImageUrls([]);
                                }}
                                disabled={reviewSubmitting}
                            >
                                <Text style={[s.reviewCancelHalfText, { color: t.textMuted }]}>{i18n("mobile.courseScreen.cancel")}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.ticketBtn, { flex: 1 }, reviewSubmitting && { opacity: 0.6 }]}
                                onPress={handleSubmitReview}
                                disabled={reviewSubmitting}
                            >
                                {reviewSubmitting ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={s.ticketBtnText}>{i18n("mobile.courseScreen.submitReview")}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                        </Pressable>
                    </Pressable>
                </KeyboardAvoidingView>
            </Modal>

            {toast?.variant === "bar" ? (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    icon={toast.icon}
                    onHide={() => setToast(null)}
                />
            ) : toast?.variant === "pill" ? (
                <PillToast
                    key={toast.id}
                    message={toast.message}
                    mode={toast.pillMode}
                    insets={insets}
                    onHide={() => setToast(null)}
                />
            ) : null}
        </SafeAreaView>
    );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    // Hero (웹 CourseDetailClient 헤더와 동일 톤)
    heroWrap: { position: "relative", width: "100%" },
    heroImg: { width: "100%", height: 448, resizeMode: "cover" },
    heroBackBtn: {
        position: "absolute",
        zIndex: 50,
        padding: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    heroBackIconShadow: {
        textShadowColor: "rgba(0,0,0,0.5)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    heroFooter: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 24,
        paddingTop: 8,
        zIndex: 10,
    },
    heroChipRowTop: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
    heroChipDark: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: "rgba(17,24,39,0.92)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(55,65,81,0.9)",
    },
    heroChipDarkText: { fontSize: 11, fontWeight: "500", color: "#fff", letterSpacing: 0.3 },
    heroTitle: {
        fontSize: 19,
        fontWeight: "600",
        color: "#fff",
        marginBottom: 4,
        lineHeight: 28,
        textShadowColor: "rgba(0,0,0,0.45)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },
    heroSubTitle: { fontSize: 13, color: "rgba(255,255,255,0.88)", marginBottom: 6, lineHeight: 19 },
    heroMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
    heroMetaPill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.15)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.4)",
    },
    heroMetaPillText: { fontSize: 13, fontWeight: "500", color: "#fff" },

    // 메인 카드 (웹: mt-4 rounded-2xl bg-white shadow-sm border border-gray-100)
    mainOuter: { marginTop: 16, paddingHorizontal: 20, marginBottom: 0, zIndex: 2 },
    mainCard: {
        borderRadius: 16,
        borderWidth: 1,
        paddingTop: 20,
        paddingHorizontal: 16,
        paddingBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        overflow: "hidden",
    },

    mapFabFixed: {
        position: "absolute",
        right: 16,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.brandGreenLight,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 30,
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
    },

    // Bottom CTA bar
    ctaBar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 14,
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: 0,
        minHeight: 64,
        borderTopWidth: StyleSheet.hairlineWidth,
        zIndex: 20,
    },
    ctaMainColumn: { flex: 1, minWidth: 0, gap: 6 },
    ctaIconBtn: {
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        paddingVertical: 4,
        paddingHorizontal: 4,
        minWidth: 60,
        marginBottom: 2,
    },
    ctaIconLabel: { fontSize: 13 },
    ctaMainBtn: {
        backgroundColor: Colors.brandGreenLight,
        borderRadius: 14,
        minHeight: 52,
        paddingVertical: 14,
        paddingHorizontal: 18,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    ctaMainBtnWide: {
        flex: 1,
        minWidth: 0,
    },
    /** 세로 스택(진행 중 등) 안에서만 — flex:1 금지(높이만 늘어남) */
    ctaMainBtnColumn: {
        alignSelf: "stretch",
    },
    ctaMainBtnText: { color: "#fff", fontSize: 15 },
    ctaStatusText: { fontSize: 11, marginBottom: 4, textAlign: "center" },

    // Ticket modal
    modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 20, fontWeight: "600", textAlign: "center", marginBottom: 8 },
    handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
    ticketBtn: { backgroundColor: Colors.brandGreen, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
    ticketBtnText: { color: "#fff", fontSize: 13, fontWeight: "500" },

    // 리뷰 섹션 (웹: 별도 rounded-2xl bg-gray-50 border border-gray-200 p-6)
    reviewSection: {
        marginHorizontal: 20,
        marginTop: 16,
        marginBottom: 8,
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 20,
        paddingVertical: 24,
    },
    reviewSectionTitle: { fontSize: 18, fontWeight: "500" },
    reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
    reviewWriteBtn: {
        backgroundColor: "#ecfdf5",
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: "#d1fae5",
    },
    reviewWriteBtnText: { color: "#047857", fontSize: 13, fontWeight: "500" },
    reviewEmpty: { fontSize: 13, marginBottom: 8 },
    reviewRatingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, justifyContent: "center" },
    reviewStarBtn: { fontSize: 30, lineHeight: 34 },
    reviewRatingCount: { fontSize: 14, fontWeight: "500", marginLeft: 4 },
    reviewCharCount: { fontSize: 12, textAlign: "right", marginBottom: 10, marginTop: -6 },
    reviewInput: {
        borderWidth: 1,
        borderRadius: 12,
        minHeight: 120,
        padding: 12,
        textAlignVertical: "top",
        marginBottom: 10,
    },
    reviewImageGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 4,
    },
    reviewImageThumb: {
        width: 72,
        height: 72,
        borderRadius: 10,
        overflow: "hidden",
        position: "relative",
    },
    reviewImageThumbImg: { width: "100%", height: "100%" },
    reviewImageAddBtn: {
        width: 72,
        height: 72,
        borderRadius: 10,
        borderWidth: 1.5,
        borderStyle: "dashed",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
    },
    reviewImageAddText: { fontSize: 11, fontWeight: "600" },
    reviewImageRemoveBtn: {
        position: "absolute",
        top: 4,
        right: 4,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(17,24,39,0.7)",
    },
    reviewCancelHalfBtn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    reviewCancelHalfText: { fontSize: 14, fontWeight: "600" },
    reviewModalActions: { flexDirection: "row", gap: 10, alignItems: "center" },
    reviewModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
    reviewModalFieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
    reviewCourseName: { borderRadius: 12, padding: 12, marginBottom: 16 },
    reviewModalSheet: { paddingBottom: 20 },
    reviewMoreBtn: {
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
        marginTop: 4,
    },
    reviewMoreBtnText: { fontSize: 13, fontWeight: "500" },
    reviewPreviewBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.92)",
        justifyContent: "center",
        alignItems: "center",
    },
    reviewPreviewInner: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
    },
    reviewPreviewImg: {
        width: "100%",
        height: "80%",
    },
    reviewPreviewNav: {
        flexDirection: "row",
        alignItems: "center",
        gap: 24,
        marginTop: 16,
    },
    reviewPreviewNavBtn: {
        padding: 8,
    },
    reviewPreviewCounter: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "500",
    },
    reviewPreviewClose: {
        position: "absolute",
        top: 52,
        right: 20,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(0,0,0,0.5)",
        alignItems: "center",
        justifyContent: "center",
    },

    loginModalClose: { position: "absolute", top: 20, right: 20, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", zIndex: 10 },

    // Reservation WebView
    reserveWebHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    reserveWebBackBtn: { width: 36, alignItems: "center" },
    reserveWebTitle: { flex: 1, fontSize: 15, fontWeight: "500", textAlign: "center" },
    screenReserveOverlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.4)",
    },
    screenReserveSheet: {
        height: Dimensions.get("window").height * 0.75,
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: "hidden",
    },

    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },

    // ── 선택형 코스 스타일 ──────────────────────────────────────────────────────
    // 세로 점선 타임라인 (웹: absolute left-5 border-l-2 border-dashed)
    selTimelineLine: {
        position: "absolute",
        left: 19,   // 40px 배지 중심(20px) - 1px(선 두께 절반)
        top: 20,
        bottom: 0,
        width: 0,
        borderLeftWidth: 2,
        borderStyle: "dashed",
        borderColor: "#e5e7eb",
        zIndex: 0,
    },
    selStepRow: { flexDirection: "row", alignItems: "flex-start", gap: 16, marginBottom: 4 },
    selStepNum: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: "#99c08e",
        alignItems: "center", justifyContent: "center",
        marginTop: 2, flexShrink: 0,
    },
    selStepNumText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    selSegLabel: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 2 },
    selSegPrompt: { fontSize: 13, marginBottom: 2 },
    selCandidateScroll: { paddingRight: 16, gap: 12, flexDirection: "row" },
    // 옵션 카드: 이미지 좌측 + 텍스트 우측 (웹과 동일)
    candidateCard: {
        width: 200, borderRadius: 12, overflow: "hidden",
    },
    candidateImgWrap: { position: "relative", width: 80, height: 80, flexShrink: 0, backgroundColor: "#f3f4f6" },
    candidateImg: { width: 80, height: 80 },
    candidateCheckBadge: {
        position: "absolute", top: 4, right: 4,
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: "#22c55e",
        alignItems: "center", justifyContent: "center",
    },
    candidateInfo: { flex: 1, padding: 8, justifyContent: "flex-start" },
    candidateName: { fontSize: 13, fontWeight: "700", marginBottom: 2, lineHeight: 17 },
    candidateSub: { fontSize: 11, lineHeight: 15 },
    candidateInfoBtn: {
        paddingVertical: 8, paddingHorizontal: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        alignItems: "center", justifyContent: "center",
        flexDirection: "row", gap: 4,
    },
    candidateInfoBtnText: { fontSize: 11, fontWeight: "700", color: "#059669" },
    editSelectionBtn: { alignSelf: "flex-end", paddingVertical: 4, paddingHorizontal: 2, marginBottom: 4 },
    editSelectionBtnText: { fontSize: 13, fontWeight: "500", color: "#10b981" },
});
