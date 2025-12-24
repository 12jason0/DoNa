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

    // 데이터 가져오기 함수 (재사용 가능하도록 useCallback으로 분리)
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const { fetchSession, authenticatedFetch, apiFetch } = await import("@/lib/authClient");

            // 1. 세션 확인 (캐시 무시)
            const session = await fetchSession();

            // 🟢 세션 정보가 확실히 있을 때만 프로필 호출
            if (session.authenticated && session.user) {
                // 🟢 로그인 상태를 즉시 설정 (이름이 없어도 로그인 상태는 유지)
                setIsLoggedIn(true);

                // 🟢 세션에서 이름을 먼저 추출 (프로필 API 호출 전에)
                const sessionName = (session.user.name || session.user.nickname || "").trim();

                console.log("[PersonalizedSection] 세션 정보 확인:", {
                    sessionName,
                    sessionUser: session.user,
                    authenticated: session.authenticated,
                    userId: session.user.id,
                });

                // 🟢 세션에 이름이 있으면 임시로 사용, 없으면 "회원" 사용
                if (sessionName) {
                    setUserName(sessionName);
                } else {
                    // 이름이 없어도 로그인 상태는 유지, 이름은 "회원"으로 표시
                    setUserName("회원");
                    console.log("[PersonalizedSection] 세션에 이름 없음 - '회원' 사용");
                }

                // 🟢 프로필 API 호출 (이름 업데이트용, 실패해도 무방)
                try {
                    const profileData = await authenticatedFetch<any>("/api/users/profile", {
                        cache: "no-store", // 🟢 로그인 시 캐시 무시
                    });

                    if (profileData) {
                        // 🟢 프로필 API가 성공했으면 로그인 상태 확실히 설정
                        setIsLoggedIn(true);

                        // 🟢 프로필에서 이름 추출 (세션보다 우선)
                        const profileName = (
                            profileData.nickname ||
                            profileData.user?.nickname ||
                            profileData.user?.username ||
                            profileData.name ||
                            sessionName ||
                            ""
                        ).trim();

                        console.log("[PersonalizedSection] 프로필에서 이름 추출:", {
                            profileName,
                            profileDataNickname: profileData.nickname,
                            profileDataUserNickname: profileData.user?.nickname,
                            profileDataUserUsername: profileData.user?.username,
                            profileDataName: profileData.name,
                            sessionName,
                        });

                        // 🟢 프로필 이름이 있으면 업데이트, 없으면 세션 이름 유지
                        if (profileName && profileName !== "") {
                            setUserName(profileName);
                            console.log("[PersonalizedSection] 최종 이름 설정 (프로필):", profileName);
                        } else if (sessionName && sessionName !== "") {
                            // 세션 이름이 있으면 그대로 사용
                            setUserName(sessionName);
                            console.log("[PersonalizedSection] 최종 이름 설정 (세션):", sessionName);
                        } else {
                            // 둘 다 없으면 "회원" 사용
                            setUserName("회원");
                            console.log("[PersonalizedSection] 최종 이름 설정 (기본값): 회원");
                        }
                    } else {
                        // 🟢 프로필 데이터가 없으면 세션 이름 사용, 그것도 없으면 "회원"
                        if (sessionName && sessionName !== "") {
                            setUserName(sessionName);
                            console.log("[PersonalizedSection] 프로필 없음 - 세션 이름 사용:", sessionName);
                        } else {
                            setUserName("회원");
                            console.log("[PersonalizedSection] 프로필 없음 - 기본값 사용: 회원");
                        }
                    }
                } catch (profileError) {
                    console.warn("[PersonalizedSection] 프로필 로드 실패 (세션 이름 사용):", profileError);
                    // 🟢 프로필 실패해도 세션 이름이 있으면 사용, 없으면 "회원"
                    if (sessionName && sessionName !== "") {
                        setUserName(sessionName);
                        console.log("[PersonalizedSection] 프로필 에러 - 세션 이름 사용:", sessionName);
                    } else {
                        setUserName("회원");
                        console.log("[PersonalizedSection] 프로필 에러 - 기본값 사용: 회원");
                    }
                }
            } else {
                setIsLoggedIn(false);
                setUserName("회원");
                console.log("[PersonalizedSection] 세션 없음 - 비로그인 상태");
            }

            // 2. 추천 코스 가져오기 (로그인 상태에 따라 캐시 정책 변경)
            // ✅ AI 추천은 BASIC 등급 코스만 추천 (mode 파라미터 없으면 BASIC만 반환)
            const isUserAuthenticated = session.authenticated && session.user;
            const { data, response } = await apiFetch("/api/recommendations?limit=3", {
                // 🟢 로그인 상태면 캐시를 쓰지 않고 최신 개인화 데이터를 가져옴
                cache: isUserAuthenticated ? "no-store" : "force-cache",
                next: { revalidate: isUserAuthenticated ? 0 : 300 },
            });

            if (!response.ok || !data) {
                setCourses([]);
                setLoading(false);
                return;
            }

            const recommendations = (data as any)?.recommendations || [];
            if (recommendations.length > 0) {
                setCourses(recommendations);

                // 🟢 로그인 상태가 확인된 경우에만 태그 분석 수행
                // (비로그인 시에는 guest 메시지 사용)
                if (isUserAuthenticated) {
                    // 🟢 로그인 상태 확실히 설정 (추천 API 호출 후에도 재확인)
                    setIsLoggedIn(true);

                    // 3. 멘트 결정 로직 (1등 코스 태그 분석)
                    const topCourse = recommendations[0];
                    const topTags = topCourse.tags;

                    console.log("[PersonalizedSection] 태그 분석 시작:", {
                        topCourseTitle: topCourse.title,
                        topTags,
                        isUserAuthenticated,
                    });

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

                    console.log("[PersonalizedSection] 태그 분석 완료");
                } else {
                    // 비로그인 상태이면 guest 타입 유지
                    setIsLoggedIn(false);
                    setCurrentTagType("guest");
                    console.log("[PersonalizedSection] 비로그인 상태 - guest 메시지 사용");
                }
            } else {
                setCourses([]);
                // 추천이 없어도 로그인 상태는 유지
                if (isUserAuthenticated) {
                    setIsLoggedIn(true);
                    setCurrentTagType("default");
                }
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
