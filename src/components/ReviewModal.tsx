"use client";

import React, { useState } from "react";

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId?: number;
    placeId?: number;
    courseName?: string;
    placeName?: string;
}

export default function ReviewModal({ isOpen, onClose, courseId, placeId, courseName, placeName }: ReviewModalProps) {
    const [rating, setRating] = useState(5);
    const [content, setContent] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");

        try {
            const token = localStorage.getItem("authToken");
            if (!token) {
                setError("로그인이 필요합니다. 로그인 페이지로 이동합니다.");
                setIsSubmitting(false);
                // 2초 후 로그인 페이지로 이동
                setTimeout(() => {
                    window.location.href = "/login";
                }, 2000);
                return;
            }

            const response = await fetch("/api/reviews", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    courseId,
                    placeId,
                    rating,
                    content: content.trim(),
                }),
            });

            const data = await response.json();

            if (response.ok) {
                alert("후기가 성공적으로 작성되었습니다!");
                onClose();
                // 후기 목록 새로고침을 위한 이벤트 발생
                window.dispatchEvent(new CustomEvent("reviewSubmitted"));
            } else {
                setError(data.error || "후기 작성에 실패했습니다.");
            }
        } catch (error) {
            console.error("후기 작성 오류:", error);
            setError("후기 작성 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setRating(5);
            setContent("");
            setError("");
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">후기 작성하기</h2>
                        <button
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <svg
                                className="hover:cursor-pointer w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>

                    {/* 대상 정보 */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">후기 대상</p>
                        <p className="font-medium text-gray-900">{courseName || placeName || "알 수 없는 대상"}</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-600 text-sm">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* 평점 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">평점 *</label>
                            <div className="flex items-center space-x-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        className={`hover:cursor-pointer text-2xl transition-colors ${
                                            star <= rating ? "text-yellow-400" : "text-gray-300"
                                        }`}
                                    >
                                        ★
                                    </button>
                                ))}
                                <span className="ml-2 text-sm text-gray-600">{rating}/5</span>
                            </div>
                        </div>

                        {/* 후기 내용 */}
                        <div>
                            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                                후기 내용 *
                            </label>
                            <textarea
                                id="content"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                required
                                minLength={10}
                                maxLength={500}
                                rows={4}
                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
                                placeholder="이 곳에 대한 솔직한 후기를 작성해주세요. (최소 10자)"
                            />
                            <div className="mt-1 text-right">
                                <span className={`text-xs ${content.length >= 10 ? "text-gray-500" : "text-red-500"}`}>
                                    {content.length}/500
                                </span>
                            </div>
                        </div>

                        {/* 버튼 */}
                        <div className="flex space-x-3 pt-4">
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={isSubmitting}
                                className="hover:cursor-pointer flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || content.trim().length < 10}
                                className="hover:cursor-pointer flex-1 px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed tracking-tight"
                            >
                                {isSubmitting ? "작성 중..." : "후기 작성"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
