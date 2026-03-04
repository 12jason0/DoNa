"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "@/components/ImageFallback";
import { useLocale } from "@/context/LocaleContext";

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
    const { t, isLocaleReady } = useLocale();
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
                alert(t("reviewModal.alertSuccess"));

                handleClose(); // 상태 초기화 및 모달 닫기
                // 후기 목록 새로고침을 위한 이벤트 발생
                window.dispatchEvent(new CustomEvent("reviewSubmitted"));
            } else {
                // 서버 에러 메시지 표시
                setError(data?.error || data?.message || t("reviewModal.errorSubmit"));
            }
        } catch (err) {
            console.error("후기 작성 오류:", err);
            setError(t("reviewModal.errorSubmitGeneric"));
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
            setError(t("reviewModal.errorMaxPhotos"));
            return;
        }

        setUploadingImages(true);
        setError("");

        try {
            filesToUpload.forEach((file) => {
                if (file.size > 50 * 1024 * 1024) throw new Error(t("reviewModal.errorFileSize", { name: file.name }));
                if (!file.type.startsWith("image/")) throw new Error(t("reviewModal.errorFileType", { name: file.name }));
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
            setError(error.message || t("reviewModal.errorUpload"));
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
            {/* 바텀시트: 라이트/다크 모드 구분 */}
            <div
                className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-t-2xl bg-white dark:bg-zinc-900 shadow-2xl transition-transform duration-300 ease-out ${
                    mounted ? "translate-y-0" : "translate-y-full"
                }`}
            >
                {/* 드래그 핸들 */}
                <div className="sticky top-0 z-10 flex justify-center pt-3 pb-1 bg-white dark:bg-zinc-900">
                    <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-zinc-600" />
                </div>
                <div className="px-5 pb-8 pt-2 min-w-0">
                    {!isLocaleReady ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
                        </div>
                    ) : (
                    <>
                    {/* 헤더 */}
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{t("reviewModal.title")}</h2>
                        <button
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="p-1 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
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
                    <div className="mb-4 p-3 bg-gray-100 dark:bg-zinc-800 rounded-xl">
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mb-1">{t("reviewModal.targetLabel")}</p>
                        <p className="font-medium text-gray-900 dark:text-white wrap-break-word">
                            {courseName || placeName || t("reviewModal.unknownTarget")}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl">
                            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* 평점 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-2">{t("reviewModal.ratingLabel")}</label>
                            <div className="flex items-center space-x-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        className={`text-2xl transition-colors ${
                                            star <= rating ? "text-yellow-500 dark:text-yellow-400" : "text-gray-300 dark:text-zinc-600"
                                        }`}
                                    >
                                        ★
                                    </button>
                                ))}
                                <span className="ml-2 text-sm text-gray-500 dark:text-zinc-500">{rating}/5</span>
                            </div>
                        </div>

                        {/* 후기 내용 */}
                        <div>
                            <label htmlFor="content" className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-2">
                                {t("reviewModal.contentLabel")}
                            </label>
                            <textarea
                                id="content"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                required
                                minLength={10}
                                maxLength={500}
                                rows={4}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-emerald-500 dark:focus:ring-zinc-500 focus:border-emerald-500 dark:focus:border-zinc-500 resize-none"
                                placeholder={t("reviewModal.contentPlaceholder")}
                            />
                            <div className="mt-1 text-right">
                                <span className={`text-xs ${content.length >= 10 ? "text-gray-500 dark:text-zinc-500" : "text-red-500 dark:text-red-400"}`}>
                                    {content.length}/500
                                </span>
                            </div>
                        </div>

                        {/* 사진 업로드 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-2">{t("reviewModal.photoLabel")}</label>
                            <div className="space-y-3">
                                {images.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2">
                                        {images.map((url, index) => (
                                            <div
                                                key={index}
                                                className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700"
                                            >
                                                <Image
                                                    src={url}
                                                    alt={t("reviewModal.photoAlt", { n: index + 1 })}
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
                                        className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-zinc-600 rounded-xl hover:border-gray-400 dark:hover:border-zinc-500 flex items-center justify-center gap-2 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300 disabled:opacity-50"
                                    >
                                        {uploadingImages ? t("reviewModal.photoUploading") : t("reviewModal.photoAdd", { n: images.length })}
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
                                className="flex-1 py-2.5 border border-gray-300 dark:border-zinc-600 rounded-xl text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                            >
                                {t("reviewModal.cancel")}
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || content.trim().length < 10}
                                className="flex-1 py-2.5 bg-emerald-600 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-sm font-medium hover:bg-emerald-700 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? t("reviewModal.submitting") : t("reviewModal.submit")}
                            </button>
                        </div>
                    </form>
                    </>
                    )}
                </div>
            </div>
        </div>
    );
}
