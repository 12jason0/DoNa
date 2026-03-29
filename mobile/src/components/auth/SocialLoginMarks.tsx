/**
 * 로그인/회원가입 원형 소셜 버튼용 SVG 마크
 * - Path에 fill 명시 (react-native-svg에서 Svg 루트 fill만으로는 기기별 누락 가능)
 */
import React from "react";
import Svg, { Path } from "react-native-svg";

/** 56px 원 안에 맞춘 기본 아이콘 크기 */
export const SOCIAL_MARK_SIZE = 30;

type MarkProps = { size?: number };

export function KakaoMark({ size = SOCIAL_MARK_SIZE }: MarkProps) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
                fill="#191919"
                d="M12 3C5.9 3 1 6.5 1 10.8c0 2.6 1.7 4.9 4.3 6.3-.2.8-.8 2.8-.8 3 0 .1 0 .2.2.2.1 0 .2-.1.3-.2 3.3-2.3 4.8-3.4 4.8-3.4.4.1.8.1 1.2.1 6.1 0 11-3.5 11-7.8C23 6.5 18.1 3 12 3z"
            />
        </Svg>
    );
}

export function AppleMark({ size = SOCIAL_MARK_SIZE }: MarkProps) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
                fill="#FFFFFF"
                d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
            />
        </Svg>
    );
}
