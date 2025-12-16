// src/app/(home)/courses/[id]/loading.tsx
export default function CourseDetailLoading() {
    return (
        <div className="min-h-screen bg-[#F8F9FA] animate-pulse">
            {/* Hero Section Skeleton */}
            <div className="relative h-[400px] w-full max-w-[600px] mx-auto bg-gray-200">
                <div className="absolute bottom-0 left-0 w-full p-6 pb-14 space-y-4">
                    <div className="flex gap-2">
                        <div className="w-16 h-6 bg-white/30 rounded-full" />
                        <div className="w-20 h-6 bg-white/30 rounded-full" />
                    </div>
                    <div className="w-3/4 h-8 bg-white/30 rounded-lg" />
                    <div className="flex gap-3">
                        <div className="w-20 h-8 bg-white/30 rounded-xl" />
                        <div className="w-20 h-8 bg-white/30 rounded-xl" />
                        <div className="w-20 h-8 bg-white/30 rounded-xl" />
                    </div>
                </div>
            </div>

            {/* Content Skeleton */}
            <main className="max-w-[600px] mx-auto -mt-8 relative z-10 px-5 space-y-10">
                {/* Intro Card */}
                <div className="bg-white rounded-[2rem] p-8 h-40" />

                {/* Map Skeleton */}
                <div className="bg-white rounded-[2rem] p-4">
                    <div className="w-full h-[320px] bg-gray-100 rounded-3xl flex items-center justify-center text-gray-300 font-medium">
                        지도를 불러오는 중...
                    </div>
                </div>

                {/* Timeline Skeleton */}
                <div className="relative px-4 pb-20 space-y-8">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="relative ml-12 bg-white rounded-3xl p-4 h-24 border border-gray-100" />
                    ))}
                </div>
            </main>
        </div>
    );
}
