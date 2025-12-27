// src/app/(home)/courses/[id]/loading.tsx
export default function CourseDetailLoading() {
    return (
        <main className="min-h-screen bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center fixed inset-0 z-[9999]">
            <div className="flex flex-col items-center gap-6 animate-fadeIn">
                {/* 1. 브랜드 로고 느낌의 스피너 */}
                <div className="relative">
                    {/* 바깥쪽 링 */}
                    <div className="h-16 w-16 rounded-full border-[6px] border-emerald-100"></div>
                    {/* 빙글빙글 도는 링 */}
                    <div className="absolute top-0 left-0 h-16 w-16 rounded-full border-[6px] border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                    {/* 중앙 아이콘 (선택 사항 - 하트나 핀) */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl animate-pulse">
                        📍
                    </div>
                </div>

                {/* 2. 감성 멘트 (랜덤으로 보여줘도 좋지만, 일단 하나로 통일) */}
                <div className="text-center space-y-1">
                    <h3 className="text-emerald-900 font-extrabold text-lg tracking-tight">DoNa</h3>
                    <p className="text-emerald-600/80 text-xs font-medium tracking-wide animate-pulse">
                        설레는 데이트를 준비하고 있어요...
                    </p>
                </div>
            </div>
        </main>
    );
}
