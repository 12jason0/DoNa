import Link from "next/link";
import { SearchX, Sparkles } from "lucide-react";

interface NoSearchResultProps {
    keyword: string;
    onReset?: () => void; // ✅ 부모에게서 '초기화 함수'를 받을 수 있게 타입 추가
}

export default function NoSearchResult({ keyword, onReset }: NoSearchResultProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            {/* 1. 아이콘 */}
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-5">
                <SearchX className="w-8 h-8 text-gray-400" />
            </div>

            {/* 2. 텍스트 */}
            <h3 className="text-lg font-bold text-gray-900 mb-2">
                <span className="text-emerald-600">'{keyword}'</span> 검색 결과가 없어요
            </h3>

            <p className="text-gray-500 text-sm mb-6 leading-relaxed max-w-xs mx-auto">
                아직 등록되지 않은 테마나 지역인 것 같아요.
                <br />
                빠른 시일 내에 멋진 코스로 채워둘게요! 🏃‍♂️
            </p>

            {/* 3. 버튼 */}
            <div className="flex w-full max-w-xs gap-3">
                {/* 인기 코스로 이동 (페이지 이동이므로 Link 유지) */}
                <Link
                    href="/courses?sort=popular"
                    className="flex-1 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center gap-1.5"
                >
                    🔥 인기 코스
                </Link>

                {/* ✅ [핵심 수정] onReset 함수가 있으면 '버튼'으로 작동하여 필터를 초기화함 */}
                {onReset ? (
                    <button
                        onClick={onReset}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 shadow-sm transition-all flex items-center justify-center gap-1.5"
                    >
                        <Sparkles size={14} /> 전체 보기
                    </button>
                ) : (
                    // onReset이 없는 경우(다른 페이지에서 쓸 때)를 대비해 Link 유지
                    <Link
                        href="/courses"
                        className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 shadow-sm transition-all flex items-center justify-center gap-1.5"
                    >
                        <Sparkles size={14} /> 전체 보기
                    </Link>
                )}
            </div>
        </div>
    );
}
