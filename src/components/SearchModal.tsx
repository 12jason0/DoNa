"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowLeft, TrendingUp } from "lucide-react";
import { CATEGORY_ICONS, CONCEPTS } from "@/constants/onboardingData";

// [인기 검색어 데이터 예시]
const POPULAR_KEYWORDS = [
  "성수동 카페",
  "비오는날 데이트",
  "전시회",
  "야장 맛집",
  "을지로 힙플",
];

// [추천 태그 데이터 예시]
const RECOMMEND_TAGS = [
  { id: "COST_EFFECTIVE", label: "가성비" },
  { id: "EMOTIONAL", label: "감성데이트" },
  { id: "PHOTO", label: "인생샷" },
  { id: "HEALING", label: "힐링" },
];

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 모달이 열릴 때 input에 포커스 & 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleSearch = (keyword: string) => {
    if (!keyword.trim()) return;
    const sp = new URLSearchParams();
    sp.set("q", keyword.trim());
    router.push(`/nearby?${sp.toString()}`);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch(query);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col animate-fade-in">
      {/* 1. 검색 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={onClose} className="p-2 -ml-2 text-gray-600">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 bg-gray-50 rounded-full flex items-center px-4 py-2.5">
          <Search className="w-4 h-4 text-gray-400 mr-2" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="지역, 테마, 핫플 검색"
            className="flex-1 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="ml-2">
              <X className="w-4 h-4 text-gray-400 bg-gray-200 rounded-full p-0.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. 검색 컨텐츠 영역 */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {/* A. 인기 검색어 */}
        <section className="mb-8">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            지금 인기있는 검색어
          </h3>
          <div className="flex flex-wrap gap-2">
            {POPULAR_KEYWORDS.map((keyword, index) => (
              <button
                key={index}
                onClick={() => handleSearch(keyword)}
                className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:border-emerald-500 hover:text-emerald-600 transition-colors shadow-sm"
              >
                {keyword}
              </button>
            ))}
          </div>
        </section>

        {/* B. 추천 테마 (아이콘 포함) */}
        <section>
          <h3 className="text-sm font-bold text-gray-900 mb-4">
            이런 테마는 어때요?
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {RECOMMEND_TAGS.map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleSearch(tag.label)}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl shadow-sm">
                   {/* 3D 아이콘 활용 (없으면 기본 이모지) */}
                   <img 
                      src={CATEGORY_ICONS[CONCEPTS[tag.id as keyof typeof CONCEPTS] || tag.label] || CATEGORY_ICONS["기타"]} 
                      alt={tag.label}
                      className="w-8 h-8 object-contain"
                   />
                </div>
                <span className="text-sm font-medium text-gray-800">{tag.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

