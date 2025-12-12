export default function Loading() {
    return (
        <main className="min-h-screen bg-white">
            <div className="max-w-[500px] mx-auto px-4 py-10">
                <div className="mb-6">
                    <div className="h-8 w-40 rounded bg-gray-300 animate-pulse" />
                </div>
                <div className="grid grid-cols-1 gap-5">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
                            <div className="h-40 rounded-xl bg-gray-300 animate-pulse" />
                            <div className="h-4 w-1/2 mt-4 rounded bg-gray-300 animate-pulse" />
                            <div className="h-3 w-1/3 mt-2 rounded bg-gray-300 animate-pulse" />
                            <div className="flex gap-2 mt-3">
                                <div className="h-6 w-16 rounded-full bg-gray-300 animate-pulse" />
                                <div className="h-6 w-20 rounded-full bg-gray-300 animate-pulse" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
