import React from 'react';
import Image from '@/components/ImageFallback';

interface MemorySavedIconProps {
  imageUrl?: string | null;
}

function MemorySavedIcon({ imageUrl }: MemorySavedIconProps) {
  return (
    // 전체 컨테이너 (더 큰 영역으로 확장)
    <div className="flex justify-center mt-6 mb-4 pointer-events-none select-none">
      <div className="relative w-24 h-24 flex items-center justify-center">
        
        {/* 폴라로이드 카드 베이스 - 크기 증가 */}
        <div
          className="w-16 h-20 rounded-lg border-[1.5px] border-gray-200 bg-white shadow-sm relative overflow-hidden transition-transform duration-300 ease-out hover:rotate-0 origin-bottom"
          style={{ 
            transform: 'rotate(-6deg)', 
            boxShadow: '0 3px 8px -2px rgba(0, 0, 0, 0.08)'
          }}
        >
          {/* 내부 사진 영역 - 사진이 꽉 차도록 여백 최소화 */}
          <div 
            className="absolute top-[3px] left-[3px] right-[3px] bottom-[3px] rounded-[6px] overflow-hidden bg-linear-to-b from-[#FFE5E9] to-[#FFF7E6]"
          >
            {/* 실제 저장된 이미지 */}
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Saved memory"
                className="w-full h-full object-cover rounded-[6px]"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div className="relative w-full h-full">
                {/* 언덕 실루엣 (rounded-tr-full을 이용해 부드러운 언덕 표현) */}
                <div className="absolute bottom-0 left-0 w-6 h-4 bg-[#CDE9D4] rounded-tr-full opacity-90" />
                
                {/* 하트 아이콘 (깔끔한 SVG 사용) */}
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="currentColor" 
                  className="absolute top-2 right-2 w-4 h-4 text-[#FF6B8B]"
                >
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.75 3c1.99 0 3.751.984 4.885 2.524C13.749 3.984 15.51 3 17.5 3c3.036 0 5.5 2.322 5.5 5.25 0 3.925-2.438 7.111-4.739 9.256a25.18 25.18 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MemorySavedIcon;
