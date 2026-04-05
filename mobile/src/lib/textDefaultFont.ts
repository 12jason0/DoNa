import React from "react";
import type { TextStyle } from "react-native";
import type { LocalePreference } from "./appSettingsStorage";

/** 전역 Text 패치와 동일한 폰트 — 명시 스타일이 필요한 곳(CTA, 토스트 등)에서 사용 */
export function textFontForLocale(locale: LocalePreference): TextStyle {
    if (locale === "ko") return { fontFamily: "Cafe24Dongdong", fontWeight: "400" };
    if (locale === "en") return { fontFamily: "KalamRegular", fontWeight: "400" };
    if (locale === "ja") return { fontFamily: "HachiMaruPop", fontWeight: "400" };
    if (locale === "zh") return { fontFamily: "ZCOOLKuaiLe", fontWeight: "400" };
    return {};
}

/**
 * RN 0.81 (React 19) 환경에서 전역 폰트 적용 전략:
 *
 * - React 19에서 function component의 defaultProps 지원 삭제됨
 * - RN 0.81 Text는 `component` 문법 → plain function component → Text.render 없음
 *
 * → react-native 모듈 객체의 Text/TextInput 프로퍼티를 직접 래퍼로 교체.
 *   Babel이 ESM named import를 `_rn.Text` 형태(property access)로 컴파일하므로
 *   모듈 평가 이후라도 교체된 프로퍼티가 자동으로 반영됨.
 */

let _currentLocale: LocalePreference = "ko";

function defaultFontStyle(locale: LocalePreference): object {
    if (locale === "ko") return { fontFamily: "Cafe24Dongdong", fontWeight: "300" };
    if (locale === "en") return { fontFamily: "KalamRegular", fontWeight: "400" };
    if (locale === "ja") return { fontFamily: "HachiMaruPop", fontWeight: "400" };
    if (locale === "zh") return { fontFamily: "ZCOOLKuaiLe", fontWeight: "400" };
    return {};
}

function wrapComponent(RNModule: Record<string, unknown>, key: string): void {
    const Orig = RNModule[key] as React.ComponentType<Record<string, unknown>>;
    if (!Orig) return;

    function Styled(props: Record<string, unknown>) {
        const font = defaultFontStyle(_currentLocale);
        const style = props.style != null ? [font, props.style] : font;
        return React.createElement(Orig, { ...props, style });
    }
    Styled.displayName = key;
    // 정적 프로퍼티 (displayName, propTypes 등) 복사
    Object.assign(Styled, Orig);

    try { delete RNModule[key]; } catch { /* frozen object fallback */ }
    RNModule[key] = Styled;
}

// 모듈 평가 시점에 즉시 패치 — _layout.tsx imports 이전에 실행됨
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RNModule = require("react-native") as Record<string, unknown>;
    if (!RNModule._fontWrapped) {
        wrapComponent(RNModule, "Text");
        wrapComponent(RNModule, "TextInput");
        RNModule._fontWrapped = true;
    }
} catch {
    // 패치 실패 시 폰트 미적용으로 graceful fallback
}

export function applyDefaultTextFontForLocale(locale: LocalePreference): void {
    _currentLocale = locale;
}
