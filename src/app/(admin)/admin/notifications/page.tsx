"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminNotificationsPage() {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [target, setTarget] = useState<"all" | "subscribed">("all");
    const [isSending, setIsSending] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !body) {
            alert("제목과 내용을 입력해주세요.");
            return;
        }

        setIsSending(true);
        setResult(null);

        try {
            const res = await fetch("/api/admin/send-event-notification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, body, imageUrl, target }),
            });
            const data = await res.json();

            if (res.ok) {
                setResult(`✅ ${data.message || "알림 전송 완료"}`);
                setTitle("");
                setBody("");
                setImageUrl("");
            } else {
                setResult(`❌ 실패: ${data.error}`);
            }
        } catch (err) {
            console.error(err);
            setResult("❌ 네트워크 오류가 발생했습니다.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <main className="max-w-3xl mx-auto px-6 py-12 pt-24 text-black">
            <h1 className="text-3xl font-bold mb-8">📢 이벤트 / 공지 알림 발송</h1>

            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-2xl shadow-lg">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">제목 *</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg"
                        placeholder="예: 도나 11월 프리미엄 이벤트 오픈!"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">내용 *</label>
                    <textarea
                        rows={3}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg"
                        placeholder="예: 지금 바로 참여하고 포인트를 받아보세요!"
                    ></textarea>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">이미지 URL (선택)</label>
                    <input
                        type="text"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg"
                        placeholder="https://dona.io.kr/uploads/banner_11_event.jpg"
                    />
                    <p className="text-xs text-gray-500 mt-1">알림에 표시할 썸네일 이미지</p>
                </div>

                {/* 대상 선택 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">발송 대상</label>
                    <div className="flex items-center gap-6 text-sm">
                        <label className="flex items-center gap-2">
                            <input
                                type="radio"
                                name="target"
                                value="all"
                                checked={target === "all"}
                                onChange={() => setTarget("all")}
                            />
                            <span>전체 (모든 사용자)</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="radio"
                                name="target"
                                value="subscribed"
                                checked={target === "subscribed"}
                                onChange={() => setTarget("subscribed")}
                            />
                            <span>구독자만 (알림 수신 동의)</span>
                        </label>
                    </div>
                </div>

                {imageUrl && (
                    <div className="mt-4 border rounded-lg overflow-hidden bg-gray-200">
                        <img
                            src={imageUrl}
                            alt="미리보기"
                            className="w-full object-cover max-h-48"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                            }}
                        />
                    </div>
                )}

                <div className="pt-4 flex justify-end">
                    <button
                        type="submit"
                        disabled={isSending}
                        className={`px-6 py-3 rounded-lg font-semibold text-white ${
                            isSending ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                    >
                        {isSending ? "전송 중..." : "전체 유저에게 알림 보내기"}
                    </button>
                </div>

                {result && (
                    <p
                        className={`text-sm mt-4 font-medium ${
                            result.startsWith("✅") ? "text-green-600" : "text-red-600"
                        }`}
                    >
                        {result}
                    </p>
                )}
            </form>

            <div className="mt-8 text-sm text-gray-500 flex justify-end">
                <button onClick={() => router.push("/admin")} className="underline hover:text-gray-700">
                    ← 관리자 메인으로 돌아가기
                </button>
            </div>
        </main>
    );
}
