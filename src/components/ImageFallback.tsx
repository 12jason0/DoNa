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
        if (fill) return undefined;
        if (typeof width === "number" && typeof height === "number") {
            return { width, height } as React.CSSProperties;
        }
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

    // 🟢 성능 최적화 기본값 설정
    const defaultSizes = rest.sizes ?? "(max-width: 768px) 100vw, 500px";
    const defaultQuality = typeof rest.quality === "number" ? rest.quality : 65;

    // 1. rest에서 priority와 loading을 완전히 분리해냅니다.
    const { priority, loading, ...restProps } = rest;

    // 2. restProps에서도 priority와 loading을 명시적으로 제거 (안전장치)
    const cleanRestProps = { ...restProps };
    delete (cleanRestProps as any).priority;
    delete (cleanRestProps as any).loading;

    // 3. 전달할 props 객체를 새로 구성합니다 (priority와 loading 없이 시작)
    const imageProps: any = {
        ...cleanRestProps,
        src,
        alt,
        className,
        fill,
        width,
        height,
        sizes: defaultSizes,
        quality: defaultQuality,
        onError: (e: any) => {
            try {
                setErrored(true);
            } finally {
                onError?.(e);
            }
        },
    };

    // 🟢 핵심 수정: 두 속성이 공존하지 못하도록 명확하게 분기합니다.
    if (priority) {
        // priority가 true(또는 truthy)면 priority만 넣고 loading은 절대 넣지 않습니다.
        imageProps.priority = true;
    } else {
        // priority가 없거나 false일 때만 loading 속성을 추가합니다.
        imageProps.loading = loading ?? "lazy";
    }

    return <NextImage {...imageProps} />;
}
