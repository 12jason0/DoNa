"use client";

import React, { useState, useMemo } from "react";
import NextImage, { type ImageProps as NextImageProps } from "next/image";
import { useLocale } from "@/context/LocaleContext";

export type ImageFallbackProps = NextImageProps & {
    fallbackClassName?: string;
    fallbackContent?: React.ReactNode;
};

export default function ImageFallback(props: ImageFallbackProps) {
    const { t } = useLocale();
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
                {fallbackContent ?? <span style={{ fontSize: 12 }}>{t("common.imagePlaceholder")}</span>}
            </div>
        );
    }

    // 🟢 CDN 이미지는 Next 최적화 경유 시 타임아웃 → 브라우저에서 직접 로드
    const isRemoteCdn =
        typeof src === "string" &&
        (src.startsWith("https://d13xx6k6chk2in.cloudfront.net") ||
            src.includes("cloudfront.net") ||
            src.includes("amazonaws.com"));

    const defaultSizes = rest.sizes ?? "(max-width: 768px) 100vw, 500px";
    const defaultQuality = typeof rest.quality === "number" ? rest.quality : 65;

    const { priority, loading, unoptimized: restUnoptimized, ...restProps } = rest;
    const cleanRestProps = { ...restProps };
    delete (cleanRestProps as any).priority;
    delete (cleanRestProps as any).loading;

    const imageProps: any = {
        ...cleanRestProps,
        src,
        alt,
        className,
        fill,
        width,
        height,
        ...(isRemoteCdn ? { unoptimized: true } : { sizes: defaultSizes, quality: defaultQuality }),
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
