"use client";

import React, { useState, useMemo } from "react";
import NextImage, { type ImageProps as NextImageProps } from "next/image";

export type ImageFallbackProps = NextImageProps & {
    fallbackClassName?: string;
    fallbackContent?: React.ReactNode;
};

export default function ImageFallback(props: ImageFallbackProps) {
    const { src, onError, className, fallbackClassName, fallbackContent, fill, width, height, alt, ...rest } = props;
    const [errored, setErrored] = useState(false);

    const shouldShowFallback = !src || src === "" || errored;

    const boxStyle = useMemo(() => {
        if (fill) return undefined; // 부모가 relative/absolute로 크기를 제어
        if (typeof width === "number" && typeof height === "number") {
            return { width, height } as React.CSSProperties;
        }
        // 폭/높이가 명시되지 않았으면 최소 높이만 부여
        return { minHeight: 80 } as React.CSSProperties;
    }, [fill, width, height]);

    if (shouldShowFallback) {
        return (
            <div
                className={[
                    fill ? "absolute inset-0" : "",
                    "bg-gray-200 flex items-center justify-center text-gray-400",
                    className || "",
                    fallbackClassName || "",
                ].join(" ")}
                style={boxStyle}
                aria-label={typeof alt === "string" ? alt : "image"}
                role="img"
            >
                {fallbackContent ?? <span style={{ fontSize: 12 }}>이미지 없음</span>}
            </div>
        );
    }

    // 합리적인 기본값으로 성능 최적화 (필요 시 개별 호출부에서 override 가능)
    const defaultSizes = rest.sizes ?? "(max-width: 768px) 100vw, 500px"; // 카드 최대 폭 ~500px 기준
    const defaultLoading = rest.loading ?? (rest.priority ? undefined : "lazy");
    const defaultQuality = typeof rest.quality === "number" ? rest.quality : 70;

    return (
        <NextImage
            {...rest}
            sizes={defaultSizes}
            loading={defaultLoading as any}
            quality={defaultQuality}
            src={src}
            alt={alt}
            className={className}
            fill={fill}
            width={width}
            height={height}
            onError={(e) => {
                try {
                    setErrored(true);
                } finally {
                    onError?.(e);
                }
            }}
        />
    );
}
