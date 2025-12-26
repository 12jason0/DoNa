"use client";

import React, { useState, useRef } from "react";
import Image from "@/components/ImageFallback";

// 🟢 1. 서버 응답 데이터의 타입을 정의합니다.
interface ReviewResponse {
    success?: boolean;
    couponAwarded?: boolean;
    message?: string;
    error?: string;
}

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
    const [images, setImages] = useState<string[]>([]);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 🟢 2. 후기 제출 함수 (쿠폰 지급 로직 포함)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");

        try {
            // 쿠키 기반 인증: authenticatedFetch 동적 임포트
            const { authenticatedFetch } = await import("@/lib/authClient");

            // API 호출 및 타입 캐스팅 (as ReviewResponse)
            const data = (await authenticatedFetch("/api/reviews", {
                method: "POST",
                body: JSON.stringify({
                    courseId,
                    placeId,
                    rating,
                    content: content.trim(),
                    imageUrls: images,
                }),
            })) as ReviewResponse;

            // 응답 데이터 기반 처리
            if (data && !data.error) {
                // 🎁 서버에서 보낸 쿠폰 지급 여부에 따른 알림 처리 (리뷰 5개 마일스톤)
                if (data.couponAwarded) {
                    alert(data.message || "🎁 리뷰 5개 작성을 축하합니다! 쿠폰이 지급되었습니다.");
                } else {
                    alert("후기가 성공적으로 작성되었습니다!");
                }

                handleClose(); // 상태 초기화 및 모달 닫기
                // 후기 목록 새로고침을 위한 이벤트 발생
                window.dispatchEvent(new CustomEvent("reviewSubmitted"));
            } else {
                // 서버 에러 메시지 표시
                setError(data?.error || data?.message || "후기 작성에 실패했습니다.");
            }
        } catch (err) {
            console.error("후기 작성 오류:", err);
            setError("후기 작성 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // 🟢 3. 이미지 업로드 함수 (S3 연동)
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const filesToUpload = Array.from(files).slice(0, 5 - images.length);
        if (filesToUpload.length === 0) {
            setError("최대 5개까지 사진을 업로드할 수 있습니다.");
            return;
        }

        setUploadingImages(true);
        setError("");

        try {
            const formData = new FormData();
            filesToUpload.forEach((file) => {
                if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name}의 크기가 5MB를 초과합니다.`);
                if (!file.type.startsWith("image/")) throw new Error(`${file.name}은(는) 이미지 파일이 아닙니다.`);
                formData.append("photos", file);
            });

            // 리뷰 업로드를 위한 파라미터 추가
            if (courseId) {
                formData.append("type", "review");
                formData.append("courseId", courseId.toString());
            }

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
                credentials: "include", // 쿠키를 포함하여 userId를 서버에서 가져올 수 있도록
            });

            const data = await response.json();

            if (response.ok && data.success && data.photo_urls) {
                setImages([...images, ...data.photo_urls]);
            } else {
                throw new Error(data.message || "이미지 업로드에 실패했습니다.");
            }
        } catch (error: any) {
            console.error("이미지 업로드 오류:", error);
            setError(error.message || "이미지 업로드 중 오류가 발생했습니다.");
        } finally {
            setUploadingImages(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleRemoveImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
    };

    // 🟢 4. 모달 닫기 및 초기화 함수
    const handleClose = () => {
        if (!isSubmitting) {
            setRating(5);
            setContent("");
            setImages([]);
            setError("");
            if (fileInputRef.current) fileInputRef.current.value = "";
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-hidden">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-xl">
                <div className="p-6 min-w-0">
                    {/* 헤더 */}
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">후기 작성하기</h2>
                        <button
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <p className="font-medium text-gray-900 break-words">
                            {courseName || placeName || "알 수 없는 대상"}
                        </p>
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
                                        className={`text-2xl transition-colors ${
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
                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 resize-none"
                                placeholder="이 곳에 대한 솔직한 후기를 작성해주세요. (최소 10자)"
                            />
                            <div className="mt-1 text-right">
                                <span className={`text-xs ${content.length >= 10 ? "text-gray-500" : "text-red-500"}`}>
                                    {content.length}/500
                                </span>
                            </div>
                        </div>

                        {/* 사진 업로드 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">사진 추가 (선택)</label>
                            <div className="space-y-3">
                                {images.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2">
                                        {images.map((url, index) => (
                                            <div
                                                key={index}
                                                className="relative aspect-square rounded-lg overflow-hidden border border-gray-200"
                                            >
                                                <Image
                                                    src={url}
                                                    alt={`후기 사진 ${index + 1}`}
                                                    fill
                                                    className="object-cover"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveImage(index)}
                                                    className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {images.length < 5 && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingImages}
                                        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 flex items-center justify-center gap-2 text-gray-600 disabled:opacity-50"
                                    >
                                        {uploadingImages ? "업로드 중..." : `사진 추가 (${images.length}/5)`}
                                    </button>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                            </div>
                        </div>

                        {/* 버튼 섹션 */}
                        <div className="flex space-x-3 pt-4">
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || content.trim().length < 10}
                                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
