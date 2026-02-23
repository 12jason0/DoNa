"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "@/components/ImageFallback";

interface ReviewResponse {
    success?: boolean;
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
    const [mounted, setMounted] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 아래에서 위로 올라오는 애니메이션
    useEffect(() => {
        if (isOpen) setMounted(true);
        else setMounted(false);
    }, [isOpen]);

    // 🟢 2. 후기 제출 함수 (열람권 지급 로직 포함)
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
                alert("후기가 성공적으로 작성되었습니다!");

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
            filesToUpload.forEach((file) => {
                if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name}의 크기가 50MB를 초과합니다.`);
                if (!file.type.startsWith("image/")) throw new Error(`${file.name}은(는) 이미지 파일이 아닙니다.`);
            });

            const { uploadViaPresign } = await import("@/lib/uploadViaPresign");
            const photoUrls = await uploadViaPresign(filesToUpload, {
                type: "review",
                courseId: courseId?.toString(),
            });
            if (photoUrls.length > 0) {
                setImages([...images, ...photoUrls]);
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
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* 딤드 배경 */}
            <div
                className="absolute inset-0 bg-black/60 transition-opacity duration-300"
                aria-hidden
                onClick={handleClose}
            />
            {/* 바텀시트: 아래에 붙이고 아래에서 위로 올라옴 */}
            <div
                className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-t-2xl bg-zinc-900 shadow-2xl transition-transform duration-300 ease-out ${
                    mounted ? "translate-y-0" : "translate-y-full"
                }`}
            >
                {/* 드래그 핸들 */}
                <div className="sticky top-0 z-10 flex justify-center pt-3 pb-1 bg-zinc-900">
                    <div className="w-10 h-1 rounded-full bg-zinc-600" />
                </div>
                <div className="px-5 pb-8 pt-2 min-w-0">
                    {/* 헤더 */}
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white tracking-tight">후기 작성하기</h2>
                        <button
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="p-1 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-zinc-800"
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
                    <div className="mb-4 p-3 bg-zinc-800 rounded-xl">
                        <p className="text-xs text-zinc-400 mb-1">후기 대상</p>
                        <p className="font-medium text-white wrap-break-word">
                            {courseName || placeName || "알 수 없는 대상"}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded-xl">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* 평점 */}
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-2">평점 *</label>
                            <div className="flex items-center space-x-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        className={`text-2xl transition-colors ${
                                            star <= rating ? "text-yellow-400" : "text-zinc-600"
                                        }`}
                                    >
                                        ★
                                    </button>
                                ))}
                                <span className="ml-2 text-sm text-zinc-500">{rating}/5</span>
                            </div>
                        </div>

                        {/* 후기 내용 */}
                        <div>
                            <label htmlFor="content" className="block text-sm font-medium text-zinc-400 mb-2">
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
                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 resize-none"
                                placeholder="이 곳에 대한 솔직한 후기를 작성해주세요. (최소 10자)"
                            />
                            <div className="mt-1 text-right">
                                <span className={`text-xs ${content.length >= 10 ? "text-zinc-500" : "text-red-400"}`}>
                                    {content.length}/500
                                </span>
                            </div>
                        </div>

                        {/* 사진 업로드 */}
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-2">사진 추가 (선택)</label>
                            <div className="space-y-3">
                                {images.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2">
                                        {images.map((url, index) => (
                                            <div
                                                key={index}
                                                className="relative aspect-square rounded-xl overflow-hidden border border-zinc-700"
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
                                                    className="absolute top-1 right-1 w-6 h-6 bg-black/70 text-white rounded-full flex items-center justify-center hover:bg-black/90"
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
                                        className="w-full py-3 border-2 border-dashed border-zinc-600 rounded-xl hover:border-zinc-500 flex items-center justify-center gap-2 text-zinc-400 hover:text-zinc-300 disabled:opacity-50"
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
                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={isSubmitting}
                                className="flex-1 py-2.5 border border-zinc-600 rounded-xl text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || content.trim().length < 10}
                                className="flex-1 py-2.5 bg-white text-zinc-900 rounded-xl text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
