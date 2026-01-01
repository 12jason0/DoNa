import prisma from "@/lib/db";
import HomeClient from "./HomeClient";
import { filterCoursesByImagePolicy, type CourseWithPlaces } from "@/lib/imagePolicy";

export const dynamic = "force-dynamic";
export const revalidate = 300;

type Course = {
    id: string;
    title: string;
    description: string;
    duration: string;
    location: string;
    price: string;
    imageUrl: string;
    concept: string;
    rating: number;
    region?: string;
    reviewCount: number;
    participants: number;
    view_count: number;
    viewCount?: number;
    tags?: string[];
    grade?: "FREE" | "BASIC" | "PREMIUM";
    createdAt?: string;
};

// 🟢 [Optimization] Prisma 직접 호출로 전환 - 네트워크 오버헤드 제거
async function fetchCoursesData() {
    try {
        // 🟢 [Optimization] 병렬 쿼리로 DB에서 직접 데이터를 가져와 유실 방지
        const courseSelect = {
            id: true,
            title: true,
            description: true,
            duration: true,
            region: true,
            imageUrl: true,
            concept: true,
            grade: true,
            rating: true,
            view_count: true,
            createdAt: true,
            courseTags: { select: { tag: { select: { name: true } } } },
            coursePlaces: {
                orderBy: { order_index: "asc" as const },
                select: {
                    order_index: true,
                    place: {
                        select: {
                            id: true,
                            name: true,
                            imageUrl: true,
                            latitude: true,
                            longitude: true,
                            opening_hours: true,
                            reservationUrl: true,
                        },
                    },
                },
            },
        };

        const [allRaw, heroRaw, hotRaw, newRaw] = await Promise.all([
            // 1. 전체 코스 (기본 로드)
            prisma.course.findMany({
                where: { isPublic: true },
                take: 60,
                orderBy: { id: "desc" },
                select: courseSelect,
            }),
            // 2. Hero 코스 (FREE 등급)
            prisma.course.findMany({
                where: { isPublic: true, grade: "FREE" },
                take: 10,
                select: courseSelect,
            }),
            // 3. 인기별 코스 (조회수 정렬 - DB 레벨에서 처리)
            prisma.course.findMany({
                where: { isPublic: true },
                orderBy: { view_count: "desc" },
                take: 8,
                select: courseSelect,
            }),
            // 4. 새로운 코스 (생성일 정렬 - DB 레벨에서 처리)
            prisma.course.findMany({
                where: { isPublic: true },
                orderBy: { createdAt: "desc" },
                take: 8,
                select: courseSelect,
            }),
        ]);

        // 🟢 이미지 정책 필터링
        const imagePolicy = "any" as const;
        const allFiltered = filterCoursesByImagePolicy(allRaw as unknown as CourseWithPlaces[], imagePolicy);
        const heroFiltered = filterCoursesByImagePolicy(heroRaw as unknown as CourseWithPlaces[], imagePolicy);
        const hotFiltered = filterCoursesByImagePolicy(hotRaw as unknown as CourseWithPlaces[], imagePolicy);
        const newFiltered = filterCoursesByImagePolicy(newRaw as unknown as CourseWithPlaces[], imagePolicy);

        // 🟢 데이터 포맷팅 함수
        const formatCourse = (course: any): Course | null => {
            if (!course || !course.id) return null;
            const firstPlaceImage = Array.isArray(course?.coursePlaces)
                ? course.coursePlaces.find((cp: any) => cp?.place?.imageUrl)?.place?.imageUrl
                : undefined;
            const resolvedImageUrl = course.imageUrl || firstPlaceImage || "";

            return {
                id: String(course.id),
                title: course.title || "제목 없음",
                description: course.description || "",
                duration: course.duration || "",
                location: course.region || "",
                price: "", // API에서 제공하지 않으므로 빈 문자열
                imageUrl: resolvedImageUrl,
                concept: course.concept || "",
                grade: course.grade || "FREE",
                rating: Number(course.rating) || 0,
                region: course.region || undefined,
                reviewCount: 0, // 리뷰 수는 별도 조회 필요
                participants: 0, // 참여자 수는 별도 조회 필요
                view_count: course.view_count || 0,
                viewCount: course.view_count || 0,
                tags: Array.isArray(course?.courseTags)
                    ? course.courseTags.map((ct: any) => ct?.tag?.name).filter(Boolean)
                    : [],
                createdAt: course.createdAt ? new Date(course.createdAt).toISOString() : undefined,
            };
        };

        // 🟢 메인 코스 리스트 포맷팅 (기본 로드 로직 - FREE/BASIC/PREMIUM 인터리빙)
        const freeArr = allFiltered.filter((c) => c.grade === "FREE");
        const basicArr = allFiltered.filter((c) => c.grade === "BASIC");
        const premiumArr = allFiltered.filter((c) => c.grade === "PREMIUM");
        const interleaved = [];
        let f = 0,
            b = 0,
            p = 0;
        while (interleaved.length < 30 && (f < freeArr.length || b < basicArr.length || p < premiumArr.length)) {
            if (f < freeArr.length) interleaved.push(freeArr[f++]);
            if (f < freeArr.length && interleaved.length < 30) interleaved.push(freeArr[f++]);
            if (b < basicArr.length && interleaved.length < 30) interleaved.push(basicArr[b++]);
            if (p < premiumArr.length && interleaved.length < 30) interleaved.push(premiumArr[p++]);
        }
        const courses = interleaved.map(formatCourse).filter(Boolean) as Course[];

        // 🟢 Hero 코스 선택 로직 (기존 유지)
        const formattedHero = heroFiltered.map(formatCourse).filter(Boolean) as Course[];
        let heroCourses: Course[] = [];
        if (formattedHero.length > 0) {
            const threeDayEpoch = Math.floor(Date.now() / 259200000);
            const startIndex = threeDayEpoch % formattedHero.length;
            heroCourses = Array.from(
                { length: Math.min(5, formattedHero.length) },
                (_, i) => formattedHero[(startIndex + i) % formattedHero.length]
            );
        }
        // Hero 코스가 없으면 메인 코스에서 가져오기
        if (heroCourses.length === 0 && courses.length > 0) {
            heroCourses = courses.slice(0, 5);
        }

        // 🟢 인기별 코스 포맷팅
        const hotCourses = hotFiltered.map(formatCourse).filter(Boolean) as Course[];

        // 🟢 신규 코스 포맷팅
        const newCourses = newFiltered.map(formatCourse).filter(Boolean) as Course[];

        return { courses, heroCourses, hotCourses, newCourses };
    } catch (error) {
        console.error("[Home Server] 데이터 로드 실패:", error);
        return {
            courses: [],
            heroCourses: [],
            hotCourses: [],
            newCourses: [],
        };
    }
}

export default async function Page() {
    // 🟢 서버에서 데이터를 미리 가져옵니다 (LCP 속도 비약적 상승)
    const { courses, heroCourses, hotCourses, newCourses } = await fetchCoursesData();

    return (
        <HomeClient
            initialCourses={courses}
            initialHeroCourses={heroCourses}
            initialHotCourses={hotCourses}
            initialNewCourses={newCourses}
        />
    );
}
