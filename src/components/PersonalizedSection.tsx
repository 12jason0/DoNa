"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useCallback, useRef } from "react";
// 🚨 경로 주의: constants 폴더 안에 recommendations.ts 파일이 있어야 합니다.
import { RECOMMENDATION_MESSAGES, UserTagType } from "@/constants/recommendations";

interface Course {
    id: number;
    title: string;
    imageUrl: string | null;
    region: string | null;
    tags: any;
    matchScore?: number;
    coursePlaces?: Array<{ place: { imageUrl?: string } }>;
}

export default function PersonalizedSection() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState("회원");
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null); // 🟢 null = 아직 확인 중
    const [currentTagType, setCurrentTagType] = useState<UserTagType>("default");

    // --- Mouse Drag State ---
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const onMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        if (scrollRef.current) {
            setStartX(e.pageX - scrollRef.current.offsetLeft);
            setScrollLeft(scrollRef.current.scrollLeft);
        }
    };

    const onMouseLeave = () => {
        setIsDragging(false);
    };

    const onMouseUp = () => {
        setIsDragging(false);
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        if (scrollRef.current) {
            const x = e.pageX - scrollRef.current.offsetLeft;
            const walk = (x - startX) * 2; // scroll-fast
            scrollRef.current.scrollLeft = scrollLeft - walk;
        }
    };

    // 🟢 데이터 가져오기 함수 (성능 최적화: 프로필 API 호출 제거, 캐싱 개선)
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const { fetchSession, apiFetch } = await import("@/lib/authClient");

            // 1. 세션 확인
            const session = await fetchSession();
            const isUserAuthenticated = session.authenticated && session.user;

            // 2. 로그인 상태 및 이름 설정 (세션에서만 추출 - 프로필 API 호출 제거)
            if (isUserAuthenticated && session.user) {
                setIsLoggedIn(true);
                // 🟢 세션에서 이름 추출 (프로필 API 호출 없이)
                const sessionName = (session.user.name || session.user.nickname || "").trim();
                setUserName(sessionName || "회원");
            } else {
                setIsLoggedIn(false);
                setUserName("회원");
            }

            // 3. 추천 API 호출 (로그인 상태에 따라 캐싱 정책 분리)
            // 🟢 추천 알고리즘은 서버에서 userId(쿠키)를 통해 자체적으로 개인화 데이터를 조회합니다
            // - userPreference: 장기 선호도 (concept, mood, regions)
            // - userInteraction: 최근 조회/클릭/좋아요 기록
            // - 이 데이터로 개인화 점수를 계산하여 추천합니다
            const { data, response } = await apiFetch("/api/recommendations?limit=3", {
                // 🟢 로그인 사용자: 짧은 캐싱 (최근 상호작용 반영을 위해)
                // 🟢 비로그인 사용자: 긴 캐싱 (인기순 정렬이므로 동일 결과)
                cache: isUserAuthenticated ? "force-cache" : "force-cache",
                next: { revalidate: isUserAuthenticated ? 30 : 300 }, // 로그인: 30초, 비로그인: 5분
            });

            if (!response.ok || !data) {
                setCourses([]);
                setLoading(false);
                return;
            }

            const recommendations = (data as any)?.recommendations || [];
            if (recommendations.length > 0) {
                setCourses(recommendations);

                // 🟢 태그 분석 로직 (로그인 상태에 따라)
                if (isUserAuthenticated) {
                    // 멘트 결정 로직 (1등 코스 태그 분석)
                    const topCourse = recommendations[0];
                    const topTags = topCourse.tags;

                    if (topTags) {
                        if (topTags.concept?.includes("힐링") || topTags.mood?.includes("조용한")) {
                            setCurrentTagType("healing");
                        } else if (
                            topTags.concept?.includes("인생샷") ||
                            topTags.mood?.includes("사진") ||
                            topTags.mood?.includes("인스타")
                        ) {
                            setCurrentTagType("photo");
                        } else if (topTags.concept?.includes("맛집") || topTags.concept?.includes("먹방")) {
                            setCurrentTagType("food");
                        } else if (topTags.budget === "저렴함" || topTags.concept?.includes("가성비")) {
                            setCurrentTagType("cost");
                        } else if (topTags.mood?.includes("활동적인")) {
                            setCurrentTagType("activity");
                        } else {
                            setCurrentTagType("default");
                        }
                    } else {
                        setCurrentTagType("default");
                    }
                } else {
                    setCurrentTagType("guest");
                }
            } else {
                setCourses([]);
                setCurrentTagType(isUserAuthenticated ? "default" : "guest");
            }
        } catch (error) {
            console.error("추천 로딩 실패:", error);
            setCourses([]);
        } finally {
            setLoading(false);
        }
    }, []); // 의존성 없음 (setState 함수들은 안정적)

    // 초기 로드
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 🟢 로그인 성공/로그아웃 이벤트 리스너
    useEffect(() => {
        const handleAuthChange = () => {
            console.log("[PersonalizedSection] 로그인/토큰 변경 이벤트 수신 - 데이터 재로드");
            // 로그인 성공 시 데이터 다시 가져오기 (새로운 유저 정보로)
            fetchData();
        };

        const handleLogout = () => {
            console.log("[PersonalizedSection] 로그아웃 이벤트 수신 - 상태 초기화");
            setCourses([]);
            setUserName("회원");
            setIsLoggedIn(false);
            setCurrentTagType("guest");
            setLoading(false); // 로그아웃 시에는 로딩 중이 아님
        };

        window.addEventListener("authLoginSuccess", handleAuthChange);
        window.addEventListener("authTokenChange", handleAuthChange);
        window.addEventListener("authLogout", handleLogout);

        return () => {
            window.removeEventListener("authLoginSuccess", handleAuthChange);
            window.removeEventListener("authTokenChange", handleAuthChange);
            window.removeEventListener("authLogout", handleLogout);
        };
    }, [fetchData]);

    // 로딩 중이거나 데이터 없으면 아무것도 안 보여줌
    if (!loading && courses.length === 0) return null;

    // 🟢 로그인 상태 확인이 완료되지 않았으면 로딩 중으로 처리
    if (isLoggedIn === null) {
        return (
            <section className="py-8 px-4">
                <div className="mb-6">
                    <div className="h-6 bg-gray-200 rounded animate-pulse w-64 mb-2" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-48" />
                </div>
                <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-4 -mx-4 px-4">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="shrink-0 w-[200px] aspect-[3/4] bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            </section>
        );
    }

    // ✅ 여기서 멘트를 가져옵니다!
    // 비로그인 상태이면 무조건 guest 메시지 사용, 로그인 상태이면 태그 분석 결과 사용
    const content = !isLoggedIn
        ? RECOMMENDATION_MESSAGES["guest"]
        : RECOMMENDATION_MESSAGES[currentTagType] || RECOMMENDATION_MESSAGES["default"];

    return (
        <section className="py-8 px-4">
            {/* 1. 멘트 영역 (여기에 멘트가 나옵니다) */}
            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 leading-snug whitespace-pre-line animate-fade-in tracking-tight">
                    {/* 👇 제목: "00님, 기 빨리는 핫플은 지치시죠?" */}
                    {content.title(userName)}
                </h2>
                <p className="text-sm text-gray-500 mt-1 font-medium">
                    {/* 👇 부제목: "마음이 차분해지는..." */}
                    {content.subtitle}
                </p>
            </div>

            {/* 2. 카드 리스트 (가로 스크롤) */}
            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseLeave={onMouseLeave}
                onMouseUp={onMouseUp}
                onMouseMove={onMouseMove}
                className="flex overflow-x-auto gap-4 scrollbar-hide pb-4 -mx-4 px-4 snap-x cursor-grab active:cursor-grabbing"
                style={{ scrollBehavior: isDragging ? "auto" : "smooth" }}
            >
                {loading
                    ? [1, 2, 3].map((n) => (
                          <div
                              key={n}
                              className="shrink-0 w-[200px] aspect-[3/4] bg-gray-100 rounded-xl animate-pulse"
                          />
                      ))
                    : courses.map((course) => (
                          <Link
                              key={course.id}
                              href={`/courses/${course.id}`}
                              draggable={false}
                              className="snap-center shrink-0 w-[200px] group relative select-none"
                          >
                              <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-gray-100 transition-transform active:scale-95">
                                  {/* 이미지 */}
                                  <div className="relative w-full h-full bg-gray-200">
                                      {(() => {
                                          // 코스 이미지가 없으면 1번 장소의 이미지 사용
                                          const courseImage = course.imageUrl?.trim() || "";
                                          const firstPlaceImage =
                                              course.coursePlaces?.[0]?.place?.imageUrl?.trim() || "";
                                          const imageUrl = courseImage || firstPlaceImage;
                                          return imageUrl ? (
                                              <Image
                                                  src={imageUrl}
                                                  fill
                                                  alt={course.title}
                                                  className="object-cover"
                                                  sizes="200px"
                                                  loading="lazy" // 🟢 lazy loading
                                                  quality={75} // 🟢 적절한 quality
                                              />
                                          ) : (
                                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                                  No Image
                                              </div>
                                          );
                                      })()}
                                  </div>

                                  {/* 그라데이션 */}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                                  {/* 뱃지 */}
                                  <div className="absolute top-3 left-3">
                                      <span className="bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 backdrop-blur-md bg-opacity-90 tracking-tight">
                                          {course.matchScore
                                              ? `🎯 취향저격 ${Math.round(course.matchScore * 100)}%`
                                              : content.badge}
                                      </span>
                                  </div>

                                  {/* 텍스트 */}
                                  <div className="absolute bottom-4 left-4 right-4 text-left">
                                      {course.region && (
                                          <span className="text-[10px] text-gray-300 block mb-1">
                                              📍 {course.region}
                                          </span>
                                      )}
                                      <h3 className="text-white font-bold text-lg leading-tight line-clamp-2 drop-shadow-md tracking-tight">
                                          {course.title}
                                      </h3>
                                  </div>
                              </div>
                          </Link>
                      ))}
            </div>
        </section>
    );
}
