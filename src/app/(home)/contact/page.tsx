"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

const ContactPage = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        const trimmedEmail = email.trim();
        const trimmedSubject = subject.trim();
        const trimmedMessage = message.trim();
        if (!trimmedName || !trimmedEmail || !trimmedSubject || !trimmedMessage) {
            alert("이름, 이메일, 제목, 문의 내용을 모두 입력해주세요.");
            return;
        }

        const mailto = `mailto:12jason@naver.com?subject=${encodeURIComponent(
            trimmedSubject
        )}&body=${encodeURIComponent(
            `이름: ${trimmedName}\n이메일: ${trimmedEmail}\n\n문의 내용:\n${trimmedMessage}`
        )}`;
        window.location.href = mailto;
    };

    return (
        <div className="flex flex-col min-h-screen bg-white">
            <main className="flex-grow container mx-auto px-4 py-8 bg-white">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8">문의하기</h1>

                    <div className="mb-8">
                        <p className="text-lg text-gray-700 mb-4">
                            DoNa 서비스에 대해 궁금한 점이 있으시거나, 도움이 필요하신가요?
                        </p>
                        <p className="text-gray-600">
                            언제든지 아래 연락처로 문의해 주시면 신속하게 답변해 드리겠습니다.
                        </p>
                    </div>

                    {/* 연락처 정보 */}
                    <div className="grid md:grid-cols-2 gap-8 mb-12">
                        <div className="bg-blue-50 rounded-lg p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">이메일 문의</h2>
                            <p className="text-blue-600 font-medium">12jason@naver.com</p>
                        </div>

                        <div className="bg-green-50 rounded-lg p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">고객센터 운영 시간</h2>
                            <div className="space-y-2 text-gray-700">
                                <p>평일 오전 10:00 ~ 오후 6:00 (주말 및 공휴일 제외)</p>
                                <p className="text-sm text-gray-600">점심시간: 오후 12:30 ~ 1:30</p>
                            </div>
                        </div>
                    </div>

                    {/* 자주 묻는 질문 안내 */}
                    <div className="bg-yellow-50 rounded-lg p-6 mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">자주 묻는 질문 (FAQ)</h2>
                        <p className="text-gray-700">
                            먼저{" "}
                            <Link href="/help" className="text-blue-600 hover:underline" prefetch>
                                자주 묻는 질문 페이지
                            </Link>
                            를 확인하시면 더 빠르게 답변을 찾으실 수 있습니다.
                        </p>
                    </div>

                    {/* 문의 폼 */}
                    <div className="bg-gray-50 rounded-lg p-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-6">문의 양식</h2>
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                    이름
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-800 text-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="이름을 입력해주세요"
                                />
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                    이메일
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 text-gray-800 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="이메일을 입력해주세요"
                                />
                            </div>

                            <div>
                                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                                    제목
                                </label>
                                <input
                                    type="text"
                                    id="subject"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 text-gray-800 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="문의 제목을 입력해주세요"
                                />
                            </div>

                            <div>
                                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                                    문의 내용
                                </label>
                                <textarea
                                    id="message"
                                    rows={6}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 text-gray-800 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="문의 내용을 자세히 입력해주세요"
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                            >
                                문의하기
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ContactPage;
