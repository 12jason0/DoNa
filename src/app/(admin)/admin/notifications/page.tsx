"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminNotificationsPage() {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [testEmail, setTestEmail] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const router = useRouter();
    const targetLabel = "알림 켜고 마케팅 수신 동의한 전체 유저";

    // 목 20:00 주말 알림에 넣을 "이번 주말 추천 코스"
    type CourseOption = { id: number; title: string };
    const [pick, setPick] = useState<CourseOption | null>(null);
    const [courses, setCourses] = useState<CourseOption[]>([]);
    const [pickId, setPickId] = useState("");
    const [pickMsg, setPickMsg] = useState<string | null>(null);

    useEffect(() => {
        try {
            setTestEmail(localStorage.getItem("admin_test_push_email") || "");
        } catch {}
        fetch("/api/admin/weekend-pick")
            .then((r) => r.json())
            .then((d) => {
                setPick(d.pick ?? null);
                setCourses(d.courses ?? []);
            })
            .catch(() => setPickMsg("❌ 주말 추천 코스를 불러오지 못했습니다."));
    }, []);

    const savePick = async (courseId: number | null) => {
        setPickMsg(null);
        const res = await fetch("/api/admin/weekend-pick", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ courseId }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) return setPickMsg(`❌ ${d.error || "저장 실패"}`);
        setPick(d.pick ?? null);
        setPickId("");
        setPickMsg(d.pick ? "✅ 저장했어요" : "✅ 해제했어요 (날씨 문구로 발송)");
    };

    const send = async (sendTarget: "everyone" | "me") => {
        if (!title || !body) {
            alert("제목과 내용을 입력해주세요.");
            return;
        }
        if (sendTarget === "me") {
            if (!testEmail.trim()) {
                alert("테스트 받을 계정 이메일을 입력해주세요.");
                return;
            }
            try {
                localStorage.setItem("admin_test_push_email", testEmail.trim());
            } catch {}
        } else if (!confirm(`[${targetLabel}]에게 발송합니다. 취소할 수 없습니다.

제목: ${title}
내용: ${body}`)) {
            return;
        }

        setIsSending(true);
        setResult(null);

        try {
            const res = await fetch("/api/admin/send-event-notification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, body, imageUrl, target: sendTarget, testEmail }),
            });
            const data = await res.json();

            if (res.ok) {
                setResult(`✅ ${data.message || "알림 전송 완료"}`);
                if (sendTarget === "me") return;
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

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    send("everyone");
                }} className="space-y-6 bg-white p-8 rounded-2xl shadow-lg">
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

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">발송 대상</label>
                    <p className="text-sm text-gray-700">{targetLabel}</p>
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

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">테스트 받을 내 계정 이메일</label>
                    <div className="flex gap-2">
                        <input
                            type="email"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            className="flex-1 px-4 py-2 border rounded-lg"
                            placeholder="앱에 로그인한 계정 이메일"
                        />
                        <button
                            type="button"
                            disabled={isSending}
                            onClick={() => send("me")}
                            className="px-4 py-2 rounded-lg font-semibold border border-indigo-600 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                        >
                            나에게 테스트 발송
                        </button>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button
                        type="submit"
                        disabled={isSending}
                        className={`px-6 py-3 rounded-lg font-semibold text-white ${
                            isSending ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                    >
                        {isSending ? "전송 중..." : `${targetLabel}에게 알림 보내기`}
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

            <section className="mt-8 space-y-4 bg-white p-8 rounded-2xl shadow-lg">
                <h2 className="text-xl font-bold">🗓️ 이번 주말 추천 코스 (목 20:00 알림)</h2>
                <p className="text-sm text-gray-600">
                    고르면 목요일 알림이 &quot;(광고) 이번 주말 추천 코스 💚 / [코스 이름] 어때요?&quot;로 나가고, 보낸 뒤 자동으로 해제돼요.
                    안 고르면 날씨에 맞는 문구로 나가요.
                </p>
                <p className="text-sm">
                    지금: <b>{pick ? `${pick.title} (#${pick.id})` : "선택 안 함 (날씨 문구)"}</b>
                </p>
                <div className="flex gap-2">
                    <select
                        value={pickId}
                        onChange={(e) => setPickId(e.target.value)}
                        className="flex-1 px-4 py-2 border rounded-lg"
                    >
                        <option value="">공개 코스 선택</option>
                        {courses.map((c) => (
                            <option key={c.id} value={c.id}>
                                #{c.id} {c.title}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        disabled={!pickId}
                        onClick={() => savePick(Number(pickId))}
                        className="px-4 py-2 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                    >
                        저장
                    </button>
                    {pick && (
                        <button
                            type="button"
                            onClick={() => savePick(null)}
                            className="px-4 py-2 rounded-lg font-semibold border border-gray-400 text-gray-700 hover:bg-gray-50"
                        >
                            해제
                        </button>
                    )}
                </div>
                {pickMsg && <p className={`text-sm font-medium ${pickMsg.startsWith("✅") ? "text-green-600" : "text-red-600"}`}>{pickMsg}</p>}
            </section>

            <div className="mt-8 text-sm text-gray-500 flex justify-end">
                <button onClick={() => router.push("/admin")} className="underline hover:text-gray-700">
                    ← 관리자 메인으로 돌아가기
                </button>
            </div>
        </main>
    );
}
