import React from "react";
import { Image } from "react-native";
import Svg, { Path, G, Rect, ClipPath, Defs } from "react-native-svg";

export const SOCIAL_MARK_SIZE = 34;

type MarkProps = { size?: number };

export function KakaoMark({ size = SOCIAL_MARK_SIZE }: MarkProps) {
    return (
        <Image
            source={require('../../../assets/kakao-logo.png')}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="contain"
        />
    );
}

export function AppleMark({ size = SOCIAL_MARK_SIZE }: MarkProps) {
    return (
        <Svg width={size} height={size} viewBox="0 0 44 44" fill="none">
            <Defs>
                <ClipPath id="apple_clip">
                    <Rect width="44" height="44" rx="22" fill="white" />
                </ClipPath>
            </Defs>
            <G clipPath="url(#apple_clip)">
                <Rect width="44" height="44" rx="22" fill="white" />
                <Path
                    d="M30.1562 34.5966C28.5543 36.0588 26.8053 35.828 25.1217 35.1353C23.34 34.4273 21.7055 34.3966 19.8257 35.1353C17.4719 36.0896 16.2297 35.8126 14.8239 34.5966C6.84722 26.8547 8.02411 15.0647 17.0796 14.6338C19.2863 14.7415 20.8228 15.7727 22.1141 15.8651C24.0429 15.4957 25.89 14.4337 27.9495 14.5722C30.4177 14.7569 32.2811 15.6804 33.5071 17.3427C28.4072 20.2209 29.6168 26.5468 34.2917 28.3169C33.36 30.6256 32.1504 32.919 30.1399 34.612L30.1562 34.5966ZM21.9507 14.5414C21.7055 11.1091 24.664 8.27705 28.064 8C28.538 11.971 24.2391 14.9262 21.9507 14.5414Z"
                    fill="black"
                />
            </G>
            <Rect x="0.5" y="0.5" width="43" height="43" rx="21.5" stroke="#E9EAEB" />
        </Svg>
    );
}
