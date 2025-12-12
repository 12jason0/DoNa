export default function Loading() {
    return (
        <main className="min-h-screen bg-gray-50">
            <div className="max-w-[500px] mx-auto px-4 py-16">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                    <p className="text-gray-600">페이지를 불러오는 중...</p>
                </div>

                <div className="space-y-4">
                    <div className="h-40 rounded-2xl bg-gray-200 animate-pulse" />
                    <div className="h-4 w-3/4 rounded bg-gray-200 animate-pulse" />
                    <div className="h-4 w-1/2 rounded bg-gray-200 animate-pulse" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="rounded-xl bg-white p-4 shadow-sm">
                                <div className="h-28 rounded-lg bg-gray-200 animate-pulse" />
                                <div className="h-3 w-2/3 mt-3 rounded bg-gray-200 animate-pulse" />
                                <div className="h-3 w-1/3 mt-2 rounded bg-gray-200 animate-pulse" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}

