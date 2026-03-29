/**
 * 웹 Footer.tsx — /personalized-home 과 동일 SVG (stroke 아이콘)
 */
import React from 'react';
import Svg, { Path } from 'react-native-svg';

const STROKE = 1.5;

type Props = {
    color: string;
    size?: number;
};

export default function PersonalizedHomeNavIcon({ color, size = 22 }: Props) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M12 6V2H8"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M15 11v2"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M2 12h2"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M20 12h2"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M20 16a2 2 0 0 1-2 2H8.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 4 20.286V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M9 11v2"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}
