import type { TextInputProps, TextProps } from "react-native";
import { Text, TextInput } from "react-native";

import type { LocalePreference } from "./appSettingsStorage";

/**
 * 웹: globals.css 의 RoundDisplay(unicode-range) + :lang(ja/zh) 보완.
 * RN: unicode-range 없음 → locale 마다 단일 fontFamily 유지.
 * ko: Cafe24Dongdong / en: KalamRegular / ja: HachiMaruPop / zh: ZCOOLKuaiLe
 */
function defaultTextStyle(locale: LocalePreference): TextProps["style"] {
    if (locale === "ko") {
        return { fontFamily: "Cafe24Dongdong", fontWeight: "300" };
    }
    if (locale === "en") {
        return { fontFamily: "KalamRegular", fontWeight: "400" };
    }
    if (locale === "ja") {
        return { fontFamily: "HachiMaruPop", fontWeight: "400" };
    }
    if (locale === "zh") {
        return { fontFamily: "ZCOOLKuaiLe", fontWeight: "400" };
    }
    return { fontFamily: undefined, fontWeight: "400" };
}

export function applyDefaultTextFontForLocale(locale: LocalePreference): void {
    const textPad = (Text as unknown as { defaultProps?: TextProps }).defaultProps;
    (Text as unknown as { defaultProps?: TextProps }).defaultProps = {
        ...textPad,
        style: defaultTextStyle(locale),
    };

    const inputPad = (TextInput as unknown as { defaultProps?: TextInputProps }).defaultProps;
    (TextInput as unknown as { defaultProps?: TextInputProps }).defaultProps = {
        ...inputPad,
        style: defaultTextStyle(locale),
    };
}
