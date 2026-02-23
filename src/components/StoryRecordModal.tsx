"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "@/components/ImageFallback";
import { X } from "lucide-react";

interface ReviewResponse {
    success?: boolean;
    message?: string;
    error?: string;
}

interface StoryRecordModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId?: number;
    courseName?: string;
}

const SUGGESTED_TAGS = ["낭만적인", "감성", "조용한", "인생샷", "숨겨진", "데이트", "사진", "카페", "맛집"];

export default function StoryRecordModal({ isOpen, onClose, courseId, courseName }: StoryRecordModalProps) {
    const [rating, setRating] = useState(5);
    const [description, setDescription] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [photos, setPhotos] = useState<string[]>([]);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);

    // 모달 열릴 때 body 스크롤 잠금
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    // 태그 토글
    const toggleTag = (tag: string) => {
        setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    };

    // 태그 제거
    const removeTag = (tag: string) => {
        setSelectedTags((prev) => prev.filter((t) => t !== tag));
    };

    // 메인 이미지 업로드
    const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (file.size > 50 * 1024 * 1024) {
            setError("이미지 크기는 50MB 이하여야 합니다.");
            return;
        }

        setUploadingImages(true);
        setError("");

        try {
            const { uploadViaPresign } = await import("@/lib/uploadViaPresign");
            const urls = await uploadViaPresign([file], {
                type: "review",
                courseId: courseId?.toString(),
            });
            if (urls.length > 0) {
                setPhotos([urls[0], ...photos.slice(1)]);
            }
        } catch (err) {
            console.error("이미지 업로드 오류:", err);
            setError("이미지 업로드에 실패했습니다.");
        } finally {
            setUploadingImages(false);
        }
    };

    // 사진 갤러리 업로드
    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const filesToUpload = Array.from(files).slice(0, 10 - photos.length);
        if (filesToUpload.length === 0) {
            setError("최대 10개까지 사진을 업로드할 수 있습니다.");
            return;
        }

        setUploadingImages(true);
        setError("");

        try {
            filesToUpload.forEach((file) => {
                if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name}의 크기가 50MB를 초과합니다.`);
            });
            const { uploadViaPresign } = await import("@/lib/uploadViaPresign");
            const urls = await uploadViaPresign(filesToUpload, {
                type: "review",
                courseId: courseId?.toString(),
            });
            if (urls.length > 0) {
                setPhotos([...photos, ...urls]);
            }
        } catch (err) {
            console.error("이미지 업로드 오류:", err);
            setError("이미지 업로드에 실패했습니다.");
        } finally {
            setUploadingImages(false);
        }
    };

    // 사진 삭제
    const deletePhoto = (index: number) => {
        setPhotos((prev) => prev.filter((_, i) => i !== index));
    };

    // 카카오톡 공유
    const handleKakaoShare = async () => {
        try {
            if (!(window as any).Kakao) {
                const script = document.createElement("script");
                script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
                script.async = true;
                document.head.appendChild(script);

                await new Promise((resolve, reject) => {
                    script.onload = () => resolve(null);
                    script.onerror = () => reject(new Error("Kakao SDK load failed"));
                });
            }

            const Kakao = (window as any).Kakao;
            if (!Kakao.isInitialized()) {
                const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
                if (jsKey) {
                    Kakao.init(jsKey);
                }
            }

            const shareText = `${courseName || "데이트"} 후기\n${description || "오늘 정말 좋은 하루였어요! 💕"}`;

            Kakao.Share.sendDefault({
                objectType: "text",
                text: shareText,
                link: {
                    mobileWebUrl: window.location.href,
                    webUrl: window.location.href,
                },
            });
        } catch (err) {
            console.error("카카오톡 공유 실패:", err);
            alert("카카오톡 공유에 실패했습니다.");
        }
    };

    // 저장하기
    const handleSubmit = async () => {
        if (isSubmitting) return;

        setIsSubmitting(true);
        setError("");

        try {
            const { authenticatedFetch } = await import("@/lib/authClient");
            const data = (await authenticatedFetch("/api/reviews", {
                method: "POST",
                body: JSON.stringify({
                    courseId,
                    rating,
                    content: description.trim(),
                    imageUrls: photos,
                }),
            })) as ReviewResponse;

            if (data && !data.error) {
                alert("스토리가 저장되었습니다! 💕");

                window.dispatchEvent(new CustomEvent("reviewSubmitted"));
                onClose();
            } else {
                setError(data?.error || data?.message || "저장에 실패했습니다.");
            }
        } catch (err) {
            console.error("스토리 저장 오류:", err);
            setError("스토리 저장 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const mainImageUrl = photos[0];
    const galleryPhotos = photos.slice(1);
    const currentDate = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

    return (
        <div className="fixed inset-0 z-5000 bg-black/60 flex items-center justify-center p-0 backdrop-blur-sm animate-fade-in">
            <div className="w-full h-full bg-white overflow-y-auto">
                {/* 상단 미니 헤더 */}
                <div className="sticky top-0 z-100 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-900">DoNa</span>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {/* 🟢 Section 1: 이미지 헤더 제거됨 - 모달에서는 사진 표시하지 않음 */}

                {/* Section 2: 평가 */}
                <div className="px-5 py-6 text-center bg-white">
                    <div className="flex justify-center gap-2 mb-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onClick={() => setRating(star)}
                                className={`text-4xl transition-all ${
                                    rating >= star ? "text-[#ff6b9d] opacity-100 scale-110" : "text-gray-300 opacity-30"
                                }`}
                            >
                                ★
                            </button>
                        ))}
                    </div>
                    <p className="text-sm text-gray-600 font-medium">
                        {rating === 5 && "최고였어요! 💕"}
                        {rating === 4 && "정말 좋았어요! 😊"}
                        {rating === 3 && "보통이었어요 😐"}
                        {rating === 2 && "좀 아쉬웠어요 😕"}
                        {rating === 1 && "별로였어요... 😢"}
                    </p>
                </div>

                {/* Section 3: 감상 */}
                <div className="px-5 pb-6 bg-white">
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={`오늘의 느낌을 한두 문장으로 적어보세요

예: 정말 좋은 하루였어! 
    다음엔 여기 또 와야겠어 💕`}
                        maxLength={200}
                        className="w-full min-h-[100px] p-4 border border-gray-200 rounded-xl text-sm font-normal resize-y outline-none transition-colors focus:border-[#667eea] focus:ring-2 focus:ring-[#667eea]/10"
                    />
                    <div className="text-right text-xs text-gray-400 mt-1">
                        {description.length}/200
                    </div>
                </div>

                {/* Section 4: 태그 */}
                <div className="px-5 pb-6 bg-white">
                    {/* 선택된 태그 */}
                    {selectedTags.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                            {selectedTags.map((tag) => (
                                <div
                                    key={tag}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-medium"
                                >
                                    #{tag}
                                    <button
                                        onClick={() => removeTag(tag)}
                                        className="text-gray-400 hover:text-gray-600 text-sm leading-none"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 제안 태그 */}
                    <div className="flex flex-wrap gap-2">
                        {SUGGESTED_TAGS.map((tag) => (
                            <button
                                key={tag}
                                onClick={() => toggleTag(tag)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                    selectedTags.includes(tag)
                                        ? "bg-[#667eea] text-white border border-[#667eea]"
                                        : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
                                }`}
                            >
                                #{tag}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Section 5: 사진 갤러리 */}
                {galleryPhotos.length > 0 && (
                    <div className="px-5 pb-6 bg-white">
                        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide -webkit-overflow-scrolling-touch">
                            {galleryPhotos.map((url, idx) => (
                                <div key={idx} className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-gray-100">
                                    <Image src={url} alt={`Photo ${idx + 2}`} fill className="object-cover" />
                                    <button
                                        onClick={() => deletePhoto(idx + 1)}
                                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center hover:bg-black/70 transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            {photos.length < 10 && (
                                <label className="w-20 h-20 shrink-0 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-[#667eea] transition-colors">
                                    <input
                                        ref={photoInputRef}
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        onChange={handlePhotoUpload}
                                        style={{ display: "none" }}
                                    />
                                    <span className="text-2xl text-gray-400">+</span>
                                </label>
                            )}
                        </div>
                    </div>
                )}

                {/* 에러 메시지 */}
                {error && (
                    <div className="px-5 pb-4">
                        <p className="text-sm text-red-500 text-center">{error}</p>
                    </div>
                )}

                {/* Section 6: 하단 버튼 */}
                <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-1 h-12 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "저장 중..." : "저장하기"}
                    </button>
                    <button
                        onClick={handleKakaoShare}
                        className="flex-1 h-12 bg-[#FEE500] text-gray-900 rounded-xl font-bold hover:bg-[#FDD835] active:scale-[0.98] transition-all"
                    >
                        카톡 공유
                    </button>
                </div>
            </div>
        </div>
    );
}
