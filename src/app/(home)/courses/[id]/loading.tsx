export default function Loading() {
    return (
        <div className="min-h-screen bg-white text-black">
            <div className="max-w-5xl mx-auto px-4 py-6">
                <div className="animate-pulse space-y-6" aria-busy="true" aria-live="polite">
                    <div className="h-8 w-40 bg-gray-200 rounded" />
                    <div className="relative w-full h-64 bg-gray-200 rounded-xl overflow-hidden" />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-4">
                            <div className="h-6 bg-gray-200 rounded w-3/4" />
                            <div className="h-4 bg-gray-200 rounded w-full" />
                            <div className="h-4 bg-gray-200 rounded w-5/6" />
                            <div className="h-4 bg-gray-200 rounded w-2/3" />
                        </div>
                        <div className="space-y-3">
                            <div className="h-10 bg-gray-200 rounded" />
                            <div className="h-10 bg-gray-200 rounded" />
                            <div className="h-10 bg-gray-200 rounded" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="rounded-xl border border-gray-200 p-4">
                                <div className="h-32 bg-gray-200 rounded-lg mb-3" />
                                <div className="h-5 bg-gray-200 rounded w-2/3 mb-2" />
                                <div className="h-4 bg-gray-200 rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
